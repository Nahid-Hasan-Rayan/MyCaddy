// NHR: pack validator, checks schema, geometry and signature
import { CoursePack } from "../../contracts/src";
import { toMeters, type LatLng } from "../../engine/src/hazards";
import { verifyPack } from "./sign";

export interface Validation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}
export interface ValidateOptions {
  publicKey?: string;
  requireSignature?: boolean;
}

const cross = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function area(poly: LatLng[]): number {
  const m = poly.map((p) => toMeters(poly[0]!, p));
  let s = 0;
  for (let i = 0; i < m.length; i++) {
    const a = m[i]!;
    const b = m[(i + 1) % m.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s / 2);
}

function selfIntersects(poly: LatLng[]): boolean {
  const m = poly.map((p) => toMeters(poly[0]!, p));
  const n = m.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const a = m[i]!, b = m[(i + 1) % n]!, c = m[j]!, d = m[(j + 1) % n]!;
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
    }
  }
  return false;
}

export function validatePack(raw: unknown, opt: ValidateOptions = {}): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = CoursePack.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 5)) errors.push(`schema: ${i.path.join(".") || "pack"}: ${i.message}`);
    return { ok: false, errors, warnings };
  }
  const pack = parsed.data;
  const seen = new Set<number>();
  pack.holes.forEach((h, i) => {
    if (seen.has(h.n)) errors.push(`hole ${h.n}: number used twice`);
    seen.add(h.n);
    if (h.n !== i + 1) errors.push(`hole ${h.n}: holes must run 1..${pack.holes.length} in order`);
    if (h.source === "missing" && (h.green.length || h.hazards.length)) errors.push(`hole ${h.n}: marked missing but has geometry`);
    if (h.source !== "missing" && !h.green.length && !h.hazards.length) errors.push(`hole ${h.n}: has no geometry but is not marked missing`);
    if (h.green.length) {
      const a = area(h.green);
      if (a < 30 || a > 3000) warnings.push(`hole ${h.n}: green area ${Math.round(a)} m2 looks wrong`);
      if (selfIntersects(h.green)) errors.push(`hole ${h.n}: green crosses itself`);
    }
    const ids = new Set<string>();
    for (const z of h.hazards) {
      if (ids.has(z.id)) errors.push(`hole ${h.n}: hazard id ${z.id} used twice`);
      ids.add(z.id);
      if (area(z.polygon) < 1) errors.push(`hole ${h.n}: hazard ${z.id} has no area`);
      if (selfIntersects(z.polygon)) errors.push(`hole ${h.n}: hazard ${z.id} crosses itself`);
      const ref = h.green[0] ?? h.tee;
      if (ref) {
        const d = toMeters(ref, z.polygon[0]!);
        if (Math.hypot(d.x, d.y) > 800) warnings.push(`hole ${h.n}: hazard ${z.id} is over 800 m from the green`);
      }
    }
  });
  const sig = (raw as Record<string, unknown>)["signature"];
  if (typeof sig === "string") {
    if (!opt.publicKey) warnings.push("signature present but no public key given, not checked");
    else if (!verifyPack(raw as Record<string, unknown>, opt.publicKey)) errors.push("signature does not match the pack");
  } else if (opt.requireSignature) errors.push("pack is not signed");
  return { ok: errors.length === 0, errors, warnings };
}
