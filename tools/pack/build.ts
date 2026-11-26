// NHR: course pack from an Overpass export, honest about what is missing
import { CoursePack } from "../../contracts/src";
import type { LatLng } from "../../engine/src/hazards";
import { centroid, distToLine, distToPoint, inRing, kindOf, points, str, ringArea, type Feat } from "../osm/coverage";

type Pos = number[];
const ll = (p: Pos): LatLng => ({ lat: p[1]!, lng: p[0]! });
const ring = (f: Feat): LatLng[] => {
  const pts = points(f);
  const out = pts.length > 1 && pts[0]![0] === pts[pts.length - 1]![0] && pts[0]![1] === pts[pts.length - 1]![1] ? pts.slice(0, -1) : pts;
  return out.map(ll);
};

export interface BuildOptions {
  courseName: string;
  id: string;
  version?: number;
  nearLine?: number;
  nearEnd?: number;
}
export interface BuildReport {
  holes: number;
  withGreen: number;
  missing: number;
  hazards: number;
  dropped: number;
}

export function buildPack(features: Feat[], opt: BuildOptions): { pack: CoursePack; report: BuildReport } {
  const wanted = opt.courseName.toLowerCase();
  const course = features.find(
    (f) => str(f.properties?.["leisure"]) === "golf_course" && str(f.properties?.["name"]).toLowerCase().includes(wanted) && f.geometry?.type !== "LineString"
  );
  if (!course) throw new Error(`no golf course matching "${opt.courseName}"`);
  const cring = points(course);
  const inside = features.filter((f) => f !== course && inRing(centroid(points(f)), cring));
  const holeLines = inside
    .filter((f) => kindOf(f.properties ?? {}) === "hole" && f.geometry?.type === "LineString")
    .map((f) => ({ n: Number(str(f.properties?.["ref"])), line: points(f), par: Number(str(f.properties?.["par"])) }))
    .filter((h) => Number.isInteger(h.n) && h.n > 0 && h.line.length >= 2)
    .sort((a, b) => a.n - b.n);
  if (holeLines.length === 0) throw new Error("no golf=hole lines with a ref number: features cannot be assigned to holes");

  const nearLine = opt.nearLine ?? 60;
  const nearEnd = opt.nearEnd ?? 50;
  const holes = holeLines.map((h) => ({ ...h, green: [] as LatLng[], tee: ll(h.line[0]!), hazards: [] as CoursePack["holes"][number]["hazards"] }));
  let dropped = 0;

  const nearest = (c: Pos, limit: number, dist: (h: (typeof holeLines)[number]) => number) => {
    let best = -1;
    let bestD = Infinity;
    holeLines.forEach((h, i) => {
      const d = dist(h);
      if (d < bestD) (bestD = d), (best = i);
    });
    return bestD <= limit ? best : -1;
  };

  const greenArea: number[] = holes.map(() => 0);
  for (const f of inside) {
    const kind = kindOf(f.properties ?? {});
    if (!kind || f.geometry?.type === "LineString" || f.geometry?.type === "Point") continue;
    const c = centroid(points(f));
    if (kind === "green") {
      const i = nearest(c, nearEnd, (h) => distToPoint(c, h.line[h.line.length - 1]!));
      const a = ringArea(points(f));
      if (i >= 0 && a > greenArea[i]!) (holes[i]!.green = ring(f)), (greenArea[i] = a);
    } else if (kind === "tee") {
      const i = nearest(c, nearEnd, (h) => distToPoint(c, h.line[0]!));
      if (i >= 0) holes[i]!.tee = ll(c);
    } else if (kind === "bunker" || kind === "water") {
      const i = nearest(c, nearLine, (h) => distToLine(c, h.line));
      const poly = ring(f);
      if (i < 0 || poly.length < 3) continue;
      const hz = holes[i]!.hazards;
      if (hz.length >= 40) {
        dropped++;
        continue;
      }
      hz.push({ id: `h${holes[i]!.n}-${kind === "water" ? "w" : "b"}${hz.length + 1}`, type: kind === "water" ? "water" : "bunker", polygon: poly });
    }
  }

  const pack = CoursePack.parse({
    id: opt.id,
    name: course.properties?.["name"] ?? opt.courseName,
    version: opt.version ?? 1,
    simulatedHazards: false,
    holes: holes.map((h) => ({
      n: h.n,
      par: Number.isInteger(h.par) && h.par >= 3 && h.par <= 6 ? h.par : 4,
      green: h.green,
      tee: h.tee,
      hazards: h.hazards,
      source: h.green.length || h.hazards.length ? "community" : "missing",
    })),
  });
  return {
    pack,
    report: {
      holes: pack.holes.length,
      withGreen: pack.holes.filter((h) => h.green.length > 0).length,
      missing: pack.holes.filter((h) => h.source === "missing").length,
      hazards: pack.holes.reduce((a, h) => a + h.hazards.length, 0),
      dropped,
    },
  };
}
