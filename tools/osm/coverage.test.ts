// NHR: coverage report on a small synthetic export
import { describe, it, expect } from "vitest";
import { report, kindOf, formatText, type Feat } from "./coverage";

const K = Math.PI / 180;
const R = 6371000;
const O = { lat: 3.1, lng: 101.6 };
const ll = (e: number, n: number) => [O.lng + e / (R * Math.cos(O.lat * K)) / K, O.lat + n / R / K];
const sq = (e: number, n: number, h: number) => [[ll(e - h, n - h), ll(e + h, n - h), ll(e + h, n + h), ll(e - h, n + h), ll(e - h, n - h)]];
const poly = (id: string, props: Record<string, unknown>, e: number, n: number, h: number): Feat => ({
  id,
  properties: props,
  geometry: { type: "Polygon", coordinates: sq(e, n, h) },
});
const line = (id: string, props: Record<string, unknown>, pts: number[][]): Feat => ({
  id,
  properties: props,
  geometry: { type: "LineString", coordinates: pts.map(([e, n]) => ll(e!, n!)) },
});

const features: Feat[] = [
  poly("a", { leisure: "golf_course", name: "Course A" }, 0, 200, 400),
  poly("b", { leisure: "golf_course", name: "Course B" }, 2000, 200, 400),
  line("h1", { golf: "hole", ref: "1" }, [[0, 0], [0, 350]]),
  line("h2", { golf: "hole", ref: "2" }, [[200, 0], [200, 300]]),
  poly("t1", { golf: "tee" }, 0, 0, 5),
  poly("g1", { golf: "green" }, 0, 350, 12),
  poly("b1", { golf: "bunker", natural: "sand" }, 15, 330, 5),
  poly("b2", { golf: "bunker", natural: "sand" }, 190, 100, 5),
  poly("w1", { golf: "water_hazard", natural: "water" }, 30, 150, 8),
  poly("p1", { natural: "water" }, -100, 100, 10),
  poly("ww", { natural: "water", water: "wastewater" }, -100, 150, 10),
  poly("bb", { golf: "bunker", natural: "sand" }, 2000, 200, 5),
  poly("far", { golf: "bunker", natural: "sand" }, 5000, 5000, 5),
  line("cp", { golf: "cartpath", highway: "service" }, [[0, 0], [100, 100]]),
];

describe("coverage report", () => {
  const r = report(features);
  const a = r.courses.find((c) => c.name === "Course A")!;
  const b = r.courses.find((c) => c.name === "Course B")!;

  it("@R3 classifies tags and skips cart paths and wastewater", () => {
    expect(kindOf({ golf: "cartpath" })).toBeNull();
    expect(kindOf({ natural: "sand" })).toBe("bunker");
    expect(kindOf({ golf: "lateral_water_hazard" })).toBe("water");
    expect(kindOf({ natural: "water", water: "wastewater" })).toBeNull();
    expect(kindOf({ natural: "water" })).toBe("pond");
  });

  it("@R3 counts features inside each course", () => {
    expect(a.counts).toMatchObject({ green: 1, tee: 1, hole: 2, bunker: 2, water: 1, pond: 1 });
    expect(b.counts).toMatchObject({ bunker: 1, green: 0 });
  });

  it("@R3 counts features outside every course", () => {
    expect(r.unassigned.bunker).toBe(1);
  });

  it("@R3 assigns features to the nearest hole", () => {
    expect(a.holes).toEqual([
      { hole: "1", green: 1, tee: 1, fairway: 0, bunkers: 1, water: 1 },
      { hole: "2", green: 0, tee: 0, fairway: 0, bunkers: 1, water: 0 },
    ]);
  });

  it("@R3 notes missing greens and missing hole lines", () => {
    expect(a.notes).toContain("greens on 1 of 2 holes");
    expect(a.notes).toContain("tees missing on 1 holes");
    expect(b.notes.some((n) => n.includes("no golf=hole lines"))).toBe(true);
    expect(b.notes).toContain("no greens mapped");
  });

  it("@R3 text report names both courses", () => {
    const t = formatText(r);
    expect(t).toContain("# Course A");
    expect(t).toContain("# Course B");
  });
});
