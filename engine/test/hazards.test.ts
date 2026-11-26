// NHR: hazard maths against hand-checked values, and shot-line geometry
import { describe, it, expect } from "vitest";
import { phi, sigma, gpsSigmaFromRadius68, pHazard2D, toFrame, pShort, pHazard, band, rayHits, assessHazards, haversine, type LatLng } from "../src/hazards";

const origin: LatLng = { lat: 1.56, lng: 103.64 };
const K = Math.PI / 180;
const R = 6371000;
const at = (east: number, north: number): LatLng => ({
  lat: origin.lat + north / R / K,
  lng: origin.lng + east / (R * Math.cos(origin.lat * K)) / K,
});
const box = (n0: number, n1: number, half = 10): LatLng[] => [at(-half, n0), at(half, n0), at(half, n1), at(-half, n1)];

describe("normal cdf and sigma", () => {
  it("@R3 phi matches reference values", () => {
    expect(phi(0)).toBeCloseTo(0.5, 6);
    expect(phi(1)).toBeCloseTo(0.8413447, 6);
    expect(phi(1.96)).toBeCloseTo(0.9750021, 6);
    expect(phi(-0.5)).toBeCloseTo(0.3085375, 6);
  });

  it("@R3 sigma combines club, gps and geometry", () => {
    expect(sigma(8, 4, 3)).toBeCloseTo(9.433981, 5);
  });
});

describe("gps accuracy conversion", () => {
  it("@R3 a 68% radius becomes a one-axis sigma of about two thirds of it", () => {
    expect(gpsSigmaFromRadius68(6)).toBeCloseTo(3.9747, 3);
    expect(gpsSigmaFromRadius68(0)).toBe(0);
  });

  it("@R3 the converted sigma puts 68% of fixes inside the reported radius", () => {
    const s = gpsSigmaFromRadius68(10);
    expect(1 - Math.exp(-(10 * 10) / (2 * s * s))).toBeCloseTo(0.68, 6);
  });
});

describe("hazard probability", () => {
  const s = sigma(8, 4, 3);

  it("@R3 hand case: short of 145 m with mean 150", () => {
    expect(pShort(145, 150, s)).toBeCloseTo(0.2980563, 5);
  });

  it("@R3 hand case: landing between 140 and 160 m", () => {
    expect(pHazard(140, 160, 150, s)).toBeCloseTo(0.7108544, 5);
  });

  it("@R3 hand case: hazard 170 to 185 m with mean 165", () => {
    expect(pHazard(170, 185, 165, sigma(10, 5, 8))).toBeCloseTo(0.2851781, 5);
  });

  it("@R3 bands use the 10 and 30 percent edges", () => {
    expect(band(0.0999)).toBe("low");
    expect(band(0.1)).toBe("tight");
    expect(band(0.3)).toBe("tight");
    expect(band(0.3001)).toBe("high");
  });
});

describe("shot line geometry", () => {
  const aim = at(0, 200);

  it("@R3 finds entry and exit along the line", () => {
    const hit = rayHits(origin, aim, box(140, 160));
    expect(hit).not.toBeNull();
    expect(hit!.near).toBeCloseTo(140, 0);
    expect(hit!.far).toBeCloseTo(160, 0);
  });

  it("@R3 returns null when the line misses", () => {
    expect(rayHits(origin, aim, [at(30, 140), at(50, 140), at(50, 160), at(30, 160)])).toBeNull();
  });

  it("@R3 ignores hazards behind the player", () => {
    expect(rayHits(origin, aim, box(-60, -40))).toBeNull();
  });

  it("@R3 near is zero when the player stands inside", () => {
    const hit = rayHits(origin, aim, box(-5, 25));
    expect(hit!.near).toBe(0);
    expect(hit!.far).toBeCloseTo(25, 0);
  });

  it("@R3 haversine agrees with the local projection", () => {
    expect(haversine(origin, at(0, 150))).toBeCloseTo(150, 0);
  });
});

describe("assessHazards", () => {
  const water = { id: "w1", type: "water" as const, polygon: box(140, 160) };
  const bunker = { id: "b1", type: "bunker" as const, polygon: box(220, 230) };
  const base = { player: origin, aim: at(0, 200), club: { mean: 150, sd: 8 }, gpsAccuracy: 4, hazards: [water, bunker] };

  it("@R3 ranks by risk and drops hazards off the line", () => {
    const r = assessHazards({ ...base, source: "surveyed" });
    expect(r[0]!.hazard.id).toBe("w1");
    expect(r[0]!.band).toBe("high");
    expect(r[1]!.hazard.id).toBe("b1");
    expect(r[1]!.band).toBe("low");
  });

  it("@R3 a missing source gives no hazards", () => {
    expect(assessHazards({ ...base, source: "missing" })).toEqual([]);
  });

  it("@R3 worse geometry widens the spread and lowers peak risk", () => {
    const tight = assessHazards({ ...base, source: "virtual" })[0]!.p;
    const loose = assessHazards({ ...base, source: "community" })[0]!.p;
    expect(loose).toBeLessThan(tight);
  });
});

describe("two-dimensional hazard risk", () => {
  const frame = (e0: number, e1: number, n0: number, n1: number) =>
    toFrame(origin, at(0, 200), [at(e0, n0), at(e1, n0), at(e1, n1), at(e0, n1)]);

  it("@R3 a hazard wider than the spread matches the depth-only formula", () => {
    const p = pHazard2D(frame(-100, 100, 140, 160), 150, 9.434, 9.434);
    expect(p).toBeCloseTo(pHazard(140, 160, 150, 9.434), 3);
  });

  it("@R3 a hazard far to one side is much less likely than one on the line", () => {
    const onLine = pHazard2D(frame(-10, 10, 140, 160), 150, 9, 9);
    const aside = pHazard2D(frame(25, 45, 140, 160), 150, 9, 9);
    expect(aside).toBeLessThan(onLine / 10);
  });

  it("@R3 left and right are mirror images", () => {
    const right = pHazard2D(frame(15, 35, 140, 160), 150, 9, 9);
    const left = pHazard2D(frame(-35, -15, 140, 160), 150, 9, 9);
    expect(left).toBeCloseTo(right, 6);
  });

  it("@R3 a small hazard at the mean matches area times density", () => {
    const p = pHazard2D(frame(-2, 2, 148, 152), 150, 10, 10);
    expect(p).toBeCloseTo(16 / (2 * Math.PI * 100), 3);
  });

  it("@R3 a wider sideways spread makes a side hazard more likely", () => {
    const tight = pHazard2D(frame(15, 35, 140, 160), 150, 9, 6);
    const loose = pHazard2D(frame(15, 35, 140, 160), 150, 9, 12);
    expect(loose).toBeGreaterThan(tight);
  });

  it("@R3 assessHazards keeps a side hazard that the shot line misses", () => {
    const side = { id: "s1", type: "water" as const, polygon: [at(15, 140), at(35, 140), at(35, 160), at(15, 160)] };
    const r = assessHazards({ player: origin, aim: at(0, 200), club: { mean: 150, sd: 8, across: 10 }, gpsAccuracy: 3, source: "surveyed", hazards: [side] });
    expect(r).toHaveLength(1);
    expect(r[0]!.p).toBeGreaterThan(0.01);
    expect(r[0]!.p).toBeLessThan(r[0]!.pDepth);
  });
});
