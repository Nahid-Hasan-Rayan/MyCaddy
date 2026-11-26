// NHR: hazard risk maths (R3) and shot-line geometry
export interface LatLng {
  lat: number;
  lng: number;
}
export type HazardType = "water" | "bunker" | "ob";
export type Source = "surveyed" | "community" | "virtual" | "missing";
export interface Hazard {
  id: string;
  type: HazardType;
  polygon: LatLng[];
}
export interface ClubSpread {
  mean: number;
  sd: number;
  across?: number;
}
export type Band = "low" | "tight" | "high";

export const GEOMETRY_ERROR: Record<Source, number> = {
  surveyed: 3,
  community: 8,
  virtual: 0,
  missing: 0,
};

const EARTH_R = 6371000;

export const RADIUS68_TO_SIGMA = 1 / Math.sqrt(-2 * Math.log(1 - 0.68));

export function gpsSigmaFromRadius68(radius: number): number {
  return radius * RADIUS68_TO_SIGMA;
}

function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? r : 2 - r;
}

export function phi(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}

export function sigma(sd: number, gpsAccuracy: number, geometryError: number): number {
  return Math.sqrt(sd * sd + gpsAccuracy * gpsAccuracy + geometryError * geometryError);
}

export function pShort(d: number, mu: number, s: number): number {
  return phi((d - mu) / s);
}

export function pHazard(near: number, far: number, mu: number, s: number): number {
  return phi((far - mu) / s) - phi((near - mu) / s);
}

export function band(p: number): Band {
  if (p < 0.1) return "low";
  if (p <= 0.3) return "tight";
  return "high";
}

interface XY {
  x: number;
  y: number;
}

export function toMeters(origin: LatLng, p: LatLng): XY {
  const k = Math.PI / 180;
  const x = (p.lng - origin.lng) * k * EARTH_R * Math.cos(origin.lat * k);
  const y = (p.lat - origin.lat) * k * EARTH_R;
  return { x, y };
}

export function haversine(a: LatLng, b: LatLng): number {
  const k = Math.PI / 180;
  const dLat = (b.lat - a.lat) * k;
  const dLng = (b.lng - a.lng) * k;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * k) * Math.cos(b.lat * k) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const cross = (a: XY, b: XY) => a.x * b.y - a.y * b.x;

function inside(pt: XY, poly: XY[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

export function rayHits(player: LatLng, aim: LatLng, polygon: LatLng[]): { near: number; far: number } | null {
  if (polygon.length < 3) return null;
  const a = toMeters(player, aim);
  const len = Math.hypot(a.x, a.y);
  if (len === 0) return null;
  const u = { x: a.x / len, y: a.y / len };
  const poly = polygon.map((p) => toMeters(player, p));
  const ts: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i]!;
    const p2 = poly[(i + 1) % poly.length]!;
    const s = { x: p2.x - p1.x, y: p2.y - p1.y };
    const denom = cross(u, s);
    if (Math.abs(denom) < 1e-12) continue;
    const t = cross(p1, s) / denom;
    const w = cross(p1, u) / denom;
    if (t >= 0 && w >= 0 && w <= 1) ts.push(t);
  }
  const within = inside({ x: 0, y: 0 }, poly);
  if (ts.length === 0) return within ? { near: 0, far: 0 } : null;
  return { near: within ? 0 : Math.min(...ts), far: Math.max(...ts) };
}

export function fromMeters(origin: LatLng, east: number, north: number): LatLng {
  const k = Math.PI / 180;
  return { lat: origin.lat + north / EARTH_R / k, lng: origin.lng + east / (EARTH_R * Math.cos(origin.lat * k)) / k };
}

export interface Frame {
  u: number;
  v: number;
}

export function toFrame(player: LatLng, aim: LatLng, polygon: LatLng[]): Frame[] {
  const a = toMeters(player, aim);
  const len = Math.hypot(a.x, a.y) || 1;
  const ux = a.x / len;
  const uy = a.y / len;
  return polygon.map((p) => {
    const m = toMeters(player, p);
    return { u: m.x * ux + m.y * uy, v: m.x * uy - m.y * ux };
  });
}

export function pHazard2D(poly: Frame[], mean: number, sdAlong: number, sdAcross: number): number {
  if (poly.length < 3) return 0;
  const lo = (f: (q: Frame) => number) => Math.min(...poly.map(f));
  const hi = (f: (q: Frame) => number) => Math.max(...poly.map(f));
  const u0 = Math.max(lo((q) => q.u), mean - 4 * sdAlong);
  const u1 = Math.min(hi((q) => q.u), mean + 4 * sdAlong);
  const v0 = Math.max(lo((q) => q.v), -4 * sdAcross);
  const v1 = Math.min(hi((q) => q.v), 4 * sdAcross);
  if (u1 <= u0 || v1 <= v0) return 0;
  const step = Math.max(1, Math.max(u1 - u0, v1 - v0) / 150);
  const nu = Math.ceil((u1 - u0) / step);
  const nv = Math.ceil((v1 - v0) / step);
  const mu = Array.from({ length: nu }, (_, i) => phi((u0 + (i + 1) * step - mean) / sdAlong) - phi((u0 + i * step - mean) / sdAlong));
  const mv = Array.from({ length: nv }, (_, j) => phi((v0 + (j + 1) * step) / sdAcross) - phi((v0 + j * step) / sdAcross));
  const xy = poly.map((q) => ({ x: q.u, y: q.v }));
  let total = 0;
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) if (inside({ x: u0 + (i + 0.5) * step, y: v0 + (j + 0.5) * step }, xy)) total += mu[i]! * mv[j]!;
  return Math.min(1, total);
}

export interface AssessInput {
  player: LatLng;
  aim: LatLng;
  club: ClubSpread;
  gpsAccuracy: number;
  source: Source;
  hazards: Hazard[];
}

export interface HazardResult {
  hazard: Hazard;
  near: number;
  far: number;
  p: number;
  pDepth: number;
  band: Band;
  pShortOfNear: number;
}

export function assessHazards(input: AssessInput): HazardResult[] {
  if (input.source === "missing") return [];
  const g = GEOMETRY_ERROR[input.source];
  const sAlong = Math.max(sigma(input.club.sd, input.gpsAccuracy, g), 0.5);
  const sAcross = Math.max(sigma(input.club.across ?? input.club.sd, input.gpsAccuracy, g), 0.5);
  const out: HazardResult[] = [];
  for (const hazard of input.hazards) {
    const hit = rayHits(input.player, input.aim, hazard.polygon);
    const frame = toFrame(input.player, input.aim, hazard.polygon);
    const p = pHazard2D(frame, input.club.mean, sAlong, sAcross);
    if (!hit && p < 0.001) continue;
    const near = hit ? hit.near : Math.max(0, Math.min(...frame.map((q) => q.u)));
    const far = hit ? hit.far : Math.max(0, Math.max(...frame.map((q) => q.u)));
    out.push({ hazard, near, far, p, pDepth: pHazard(near, far, input.club.mean, sAlong), band: band(p), pShortOfNear: pShort(near, input.club.mean, sAlong) });
  }
  return out.sort((x, y) => y.p - x.p);
}
