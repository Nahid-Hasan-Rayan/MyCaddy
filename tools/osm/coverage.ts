// NHR: coverage report for an Overpass GeoJSON export of golf features
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toMeters, type LatLng } from "../../engine/src/hazards";

type Pos = number[];
export interface Feat {
  id?: string | number;
  properties?: Record<string, unknown> | null;
  geometry?: { type: string; coordinates: any } | null;
}
export type Kind = "green" | "tee" | "hole" | "fairway" | "bunker" | "water" | "pond";
const KINDS: Kind[] = ["green", "tee", "hole", "fairway", "bunker", "water", "pond"];

export const str = (v: unknown) => (typeof v === "string" ? v : "");

export function kindOf(p: Record<string, unknown>): Kind | null {
  const g = str(p["golf"]);
  if (g === "green") return "green";
  if (g === "tee") return "tee";
  if (g === "hole") return "hole";
  if (g === "fairway") return "fairway";
  if (g === "bunker" || str(p["natural"]) === "sand") return "bunker";
  if (g === "water_hazard" || g === "lateral_water_hazard") return "water";
  if (str(p["natural"]) === "water" && g === "" && str(p["water"]) !== "wastewater") return "pond";
  return null;
}

export function points(f: Feat): Pos[] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === "Point") return [g.coordinates];
  if (g.type === "LineString") return g.coordinates;
  if (g.type === "Polygon") return g.coordinates[0] ?? [];
  if (g.type === "MultiPolygon") return g.coordinates[0]?.[0] ?? [];
  return [];
}

export function centroid(pts: Pos[]): Pos {
  const n = pts.length || 1;
  return [pts.reduce((a, p) => a + p[0]!, 0) / n, pts.reduce((a, p) => a + p[1]!, 0) / n];
}

export function inRing(pt: Pos, ring: Pos[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a[1]! > pt[1]! !== b[1]! > pt[1]! && pt[0]! < ((b[0]! - a[0]!) * (pt[1]! - a[1]!)) / (b[1]! - a[1]!) + a[0]!) c = !c;
  }
  return c;
}

export function ringArea(ring: Pos[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += ring[j]![0]! * ring[i]![1]! - ring[i]![0]! * ring[j]![1]!;
  return Math.abs(s / 2);
}

const ll = (p: Pos): LatLng => ({ lng: p[0]!, lat: p[1]! });

function segDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
  return Math.hypot(a.x + t * dx, a.y + t * dy);
}

export function distToLine(pt: Pos, line: Pos[]): number {
  const m = line.map((q) => toMeters(ll(pt), ll(q)));
  if (m.length === 1) return Math.hypot(m[0]!.x, m[0]!.y);
  let best = Infinity;
  for (let i = 0; i < m.length - 1; i++) best = Math.min(best, segDist(m[i]!, m[i + 1]!));
  return best;
}

export const distToPoint = (pt: Pos, q: Pos) => {
  const m = toMeters(ll(pt), ll(q));
  return Math.hypot(m.x, m.y);
};

export interface HoleRow {
  hole: string;
  green: number;
  tee: number;
  fairway: number;
  bunkers: number;
  water: number;
}
export interface CourseReport {
  name: string;
  counts: Record<Kind, number>;
  holes: HoleRow[];
  notes: string[];
}
export interface Report {
  courses: CourseReport[];
  unassigned: Record<Kind, number>;
}

const zero = (): Record<Kind, number> => ({ green: 0, tee: 0, hole: 0, fairway: 0, bunker: 0, water: 0, pond: 0 });

export const NEAR_LINE = 60;
export const NEAR_END = 50;

export function report(features: Feat[]): Report {
  const courses = features
    .filter((f) => str(f.properties?.["leisure"]) === "golf_course" && (f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"))
    .map((f) => ({ name: str(f.properties?.["name"]) || "unnamed course", ring: points(f), area: ringArea(points(f)) }));

  const unassigned = zero();
  const byCourse = new Map<string, Feat[]>();
  const counts = new Map<string, Record<Kind, number>>();
  for (const c of courses) {
    byCourse.set(c.name, []);
    counts.set(c.name, zero());
  }

  for (const f of features) {
    const kind = kindOf(f.properties ?? {});
    if (!kind) continue;
    const c = centroid(points(f));
    const home = courses.filter((k) => inRing(c, k.ring)).sort((a, b) => a.area - b.area)[0];
    if (!home) {
      unassigned[kind]++;
      continue;
    }
    counts.get(home.name)![kind]++;
    byCourse.get(home.name)!.push(f);
  }

  const out: CourseReport[] = courses.map((course) => {
    const feats = byCourse.get(course.name)!;
    const cnt = counts.get(course.name)!;
    const notes: string[] = [];
    const holeLines = feats
      .filter((f) => kindOf(f.properties ?? {}) === "hole" && f.geometry?.type === "LineString")
      .map((f) => ({ ref: str(f.properties?.["ref"]) || "?", line: points(f) }))
      .sort((a, b) => Number(a.ref) - Number(b.ref));
    const rows: HoleRow[] = holeLines.map((h) => ({ hole: h.ref, green: 0, tee: 0, fairway: 0, bunkers: 0, water: 0 }));

    if (holeLines.length === 0) notes.push("no golf=hole lines, so features cannot be assigned to holes");
    else {
      for (const f of feats) {
        const kind = kindOf(f.properties ?? {})!;
        if (kind === "hole" || kind === "pond") continue;
        const c = centroid(points(f));
        let best = -1;
        let bestD = Infinity;
        holeLines.forEach((h, i) => {
          const d =
            kind === "green"
              ? distToPoint(c, h.line[h.line.length - 1]!)
              : kind === "tee"
                ? distToPoint(c, h.line[0]!)
                : distToLine(c, h.line);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        const limit = kind === "green" || kind === "tee" ? NEAR_END : NEAR_LINE;
        if (best < 0 || bestD > limit) continue;
        const row = rows[best]!;
        if (kind === "green") row.green++;
        else if (kind === "tee") row.tee++;
        else if (kind === "fairway") row.fairway++;
        else if (kind === "bunker") row.bunkers++;
        else if (kind === "water") row.water++;
      }
      const withGreen = rows.filter((r) => r.green > 0).length;
      notes.push(`greens on ${withGreen} of ${rows.length} holes`);
      if (rows.some((r) => r.tee === 0)) notes.push(`tees missing on ${rows.filter((r) => r.tee === 0).length} holes`);
    }
    if (cnt.green === 0) notes.push("no greens mapped");
    if (cnt.bunker === 0) notes.push("no bunkers mapped");
    if (cnt.water === 0) notes.push("no water hazards mapped");
    return { name: course.name, counts: cnt, holes: rows, notes };
  });

  return { courses: out, unassigned };
}

export function formatText(r: Report): string {
  const lines: string[] = [];
  for (const c of r.courses) {
    lines.push(`# ${c.name}`);
    lines.push(KINDS.map((k) => `${k}: ${c.counts[k]}`).join("  "));
    if (c.holes.length) {
      lines.push("", "hole  green  tee  fairway  bunkers  water");
      for (const h of c.holes)
        lines.push(`${h.hole.padEnd(4)}  ${String(h.green).padEnd(5)}  ${String(h.tee).padEnd(3)}  ${String(h.fairway).padEnd(7)}  ${String(h.bunkers).padEnd(7)}  ${h.water}`);
    }
    for (const n of c.notes) lines.push(`note: ${n}`);
    lines.push("");
  }
  lines.push(`outside any course: ${KINDS.map((k) => `${k} ${r.unassigned[k]}`).join(", ")}`);
  return lines.join("\n");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: npx tsx tools/osm/coverage.ts export.geojson [--json]");
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(file, "utf8")) as { features: Feat[] };
  const r = report(data.features);
  console.log(process.argv.includes("--json") ? JSON.stringify(r, null, 2) : formatText(r));
}
