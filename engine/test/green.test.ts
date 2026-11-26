// NHR: green distances
import { describe, it, expect } from "vitest";
import { greenDistances } from "../src/green";
import { fromMeters, type LatLng } from "../src/hazards";

const o: LatLng = { lat: 1.56, lng: 103.64 };
const green = (n0: number, n1: number): LatLng[] => [fromMeters(o, -10, n0), fromMeters(o, 10, n0), fromMeters(o, 10, n1), fromMeters(o, -10, n1)];

describe("green distances", () => {
  it("@R3 front, middle and back along the line to the centre", () => {
    const d = greenDistances(o, green(140, 160))!;
    expect(d.front).toBeCloseTo(140, 0);
    expect(d.middle).toBeCloseTo(150, 0);
    expect(d.back).toBeCloseTo(160, 0);
  });

  it("@R3 standing on the green gives a front of zero", () => {
    const d = greenDistances(fromMeters(o, 0, 150), green(140, 160))!;
    expect(d.front).toBe(0);
    expect(d.back).toBeGreaterThan(0);
  });

  it("@R3 no green polygon gives no distances", () => {
    expect(greenDistances(o, [])).toBeNull();
  });
});
