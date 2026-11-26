// NHR: pack signing, validation, building and the demo course
import { describe, it, expect } from "vitest";
import { canonicalize, signingBytes } from "./canonical";
import { generateKeys, signPack, verifyPack } from "./sign";
import { validatePack } from "./validate";
import { buildPack } from "./build";
import { campusDemo } from "./virtual";
import { assessHazards, fromMeters, haversine, type LatLng } from "../../engine/src/hazards";
import { greenDistances, centroidOf } from "../../engine/src/green";
import type { Feat } from "../osm/coverage";

const origin: LatLng = { lat: 1.5586, lng: 103.6376 };
const keys = generateKeys();
const demo = () => JSON.parse(JSON.stringify(campusDemo(origin)));

describe("canonical json", () => {
  it("@C7 key order and undefined values do not change the bytes", () => {
    expect(canonicalize({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}');
  });

  it("@C7 the signature field is left out of the signed bytes", () => {
    expect(signingBytes({ a: 1, signature: "x" }).toString()).toBe('{"a":1}');
  });
});

describe("signing", () => {
  it("@C7 a signed pack verifies and the signature fits the contract", () => {
    const s = signPack(demo(), keys.privateKey);
    expect(s.signature).toHaveLength(88);
    expect(verifyPack(s, keys.publicKey)).toBe(true);
  });

  it("@C7 a tampered pack is rejected", () => {
    const s = signPack(demo(), keys.privateKey);
    const a = JSON.parse(JSON.stringify(s));
    a.holes[0].par = 4;
    const b = JSON.parse(JSON.stringify(s));
    b.holes[0].hazards[0].polygon[0].lat += 0.00001;
    const c = JSON.parse(JSON.stringify(s));
    c.simulatedHazards = false;
    const d = JSON.parse(JSON.stringify(s));
    d.holes[1].hazards.pop();
    for (const t of [a, b, c, d]) expect(verifyPack(t, keys.publicKey)).toBe(false);
  });

  it("@C7 the wrong key, a missing signature and a bad key are rejected", () => {
    const s = signPack(demo(), keys.privateKey);
    expect(verifyPack(s, generateKeys().publicKey)).toBe(false);
    expect(verifyPack(demo(), keys.publicKey)).toBe(false);
    expect(verifyPack(s, "not-a-key")).toBe(false);
  });
});

describe("validation", () => {
  it("@C7 the demo pack is valid, signed or not", () => {
    expect(validatePack(demo()).ok).toBe(true);
    expect(validatePack(signPack(demo(), keys.privateKey), { publicKey: keys.publicKey, requireSignature: true }).ok).toBe(true);
  });

  it("@C7 a tampered pack fails validation with a key, an unsigned pack fails when a signature is required", () => {
    const s: any = signPack(demo(), keys.privateKey);
    s.holes[0].par = 5;
    expect(validatePack(s, { publicKey: keys.publicKey }).errors).toContain("signature does not match the pack");
    expect(validatePack(demo(), { requireSignature: true }).errors).toContain("pack is not signed");
  });

  it("@C7 catches duplicate ids, crossing polygons and wrong hole order", () => {
    const p = demo();
    p.holes[0].hazards[1].id = p.holes[0].hazards[0].id;
    const z = p.holes[0].hazards[0].polygon;
    [z[1], z[2]] = [z[2], z[1]];
    p.holes[1].n = 5;
    const e = validatePack(p).errors.join(" | ");
    expect(e).toContain("used twice");
    expect(e).toContain("crosses itself");
    expect(e).toContain("in order");
  });

  it("@C7 catches a missing hole that still has geometry and a silent hole that is not marked", () => {
    const p = demo();
    p.holes[0].source = "missing";
    p.holes[1].green = [];
    p.holes[1].hazards = [];
    const e = validatePack(p).errors.join(" | ");
    expect(e).toContain("marked missing but has geometry");
    expect(e).toContain("not marked missing");
  });

  it("@C7 a hazard with no area is refused", () => {
    const p = demo();
    const z = p.holes[0].hazards[0].polygon;
    p.holes[0].hazards[0].polygon = [z[0], z[0], z[0]];
    expect(validatePack(p).errors.join(" ")).toContain("has no area");
  });

  it("@C7 rejects virtual hazards that are not labelled as simulated", () => {
    const p = demo();
    p.simulatedHazards = false;
    expect(validatePack(p).ok).toBe(false);
  });
});

describe("campus demo course with the engine", () => {
  const pack = demo();
  const h1 = pack.holes[0];
  const aim = centroidOf(h1.green);

  it("@R3 green distances from the tee match the layout", () => {
    const d = greenDistances(h1.tee, h1.green)!;
    expect(d.front).toBeCloseTo(118, 0);
    expect(d.middle).toBeCloseTo(130, 0);
    expect(d.back).toBeCloseTo(142, 0);
    expect(haversine(h1.tee, aim)).toBeCloseTo(130, 0);
  });

  it("@R3 the engine finds the water in front of the green at the laid-out distance", () => {
    const r = assessHazards({ player: h1.tee, aim, club: { mean: 105, sd: 9 }, gpsAccuracy: 3, source: "virtual", hazards: h1.hazards });
    const water = r.find((x) => x.hazard.type === "water")!;
    expect(water.near).toBeCloseTo(90, 0);
    expect(water.far).toBeCloseTo(110, 0);
    expect(water.band).toBe("high");
  });

  it("@R3 a longer club clears the water and the risk falls", () => {
    const risk = (mean: number) => assessHazards({ player: h1.tee, aim, club: { mean, sd: 9 }, gpsAccuracy: 3, source: "virtual", hazards: h1.hazards }).find((x) => x.hazard.type === "water")!.p;
    expect(risk(125)).toBeLessThan(risk(105) / 4);
  });
});

const K = Math.PI / 180;
const O = { lat: 3.1, lng: 101.6 };
const pos = (e: number, n: number) => { const p = fromMeters(O, e, n); return [p.lng, p.lat]; };
const sq = (e: number, n: number, h: number) => [[pos(e - h, n - h), pos(e + h, n - h), pos(e + h, n + h), pos(e - h, n + h), pos(e - h, n - h)]];
const poly = (props: Record<string, unknown>, e: number, n: number, h: number): Feat => ({ properties: props, geometry: { type: "Polygon", coordinates: sq(e, n, h) } });
const line = (props: Record<string, unknown>, pts: number[][]): Feat => ({ properties: props, geometry: { type: "LineString", coordinates: pts.map(([e, n]) => pos(e!, n!)) } });
void K;

describe("pack from an Overpass export", () => {
  const course = poly({ leisure: "golf_course", name: "Test Golf Club" }, 0, 200, 500);
  const features: Feat[] = [
    course,
    line({ golf: "hole", ref: "1", par: "4" }, [[0, 0], [0, 350]]),
    line({ golf: "hole", ref: "2" }, [[200, 0], [200, 150]]),
    poly({ golf: "green" }, 0, 350, 12),
    poly({ golf: "bunker" }, 15, 330, 5),
    poly({ golf: "water_hazard", natural: "water" }, 30, 150, 8),
    poly({ golf: "bunker" }, 1000, 1000, 5),
  ];

  it("@R3 assigns greens and hazards to holes and marks silent holes as missing", () => {
    const { pack, report } = buildPack(features, { courseName: "test golf", id: "test" });
    expect(report).toMatchObject({ holes: 2, withGreen: 1, missing: 1, hazards: 2 });
    expect(pack.holes[0]!.par).toBe(4);
    expect(pack.holes[0]!.hazards.map((h) => h.type).sort()).toEqual(["bunker", "water"]);
    expect(pack.holes[1]!.source).toBe("missing");
    expect(validatePack(pack).ok).toBe(true);
  });

  it("@R3 refuses an export with no hole lines, like the KLGCC one", () => {
    const flat = features.filter((f) => f.properties?.["golf"] !== "hole");
    expect(() => buildPack(flat, { courseName: "test golf", id: "x" })).toThrow(/hole lines/);
  });

  it("@R3 refuses an unknown course name", () => {
    expect(() => buildPack(features, { courseName: "nowhere", id: "x" })).toThrow(/no golf course/);
  });
});
