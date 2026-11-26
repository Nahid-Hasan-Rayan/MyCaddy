// NHR: GPS analysis on synthetic readings with a known error
import { describe, it, expect } from "vitest";
import { analyse, parseCsv, cdfSvg, report, type Reading } from "./gps";
import { rng } from "../fuzz/mockModel";
import { fromMeters } from "../../engine/src/hazards";
import { RADIUS68_TO_SIGMA } from "../../engine/src/hazards";

function synth(sigma: number, n: number, accuracyScale = 1): Reading[] {
  const r = rng(7);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
  const base = { lat: 1.5586, lng: 103.6376 };
  return Array.from({ length: n }, (_, i) => {
    const m = fromMeters(base, gauss() * sigma, gauss() * sigma);
    return { point: `P${i % 15}`, trueLat: base.lat, trueLng: base.lng, lat: m.lat, lng: m.lng, accuracy: (sigma / RADIUS68_TO_SIGMA) * accuracyScale };
  });
}

describe("gps analysis", () => {
  it("@Q7 finds the median, p90 and sigma of a known error", () => {
    const st = analyse(synth(3, 4000));
    expect(st.median).toBeCloseTo(3 * 1.1774, 0);
    expect(st.p90).toBeCloseTo(3 * 2.1460, 0);
    expect(st.sigmaMeasured).toBeCloseTo(3, 0);
    expect(st.points).toBe(15);
  });

  it("@Q7 a correct 68% radius contains about 68% of readings", () => {
    expect(analyse(synth(3, 4000)).withinReported).toBeGreaterThan(0.64);
    expect(analyse(synth(3, 4000)).withinReported).toBeLessThan(0.72);
  });

  it("@Q7 an over-confident radius is reported as such", () => {
    const st = analyse(synth(3, 2000, 0.4));
    expect(report(st, "x")).toContain("over-confident");
  });

  it("@Q7 the 5 m target is measured against the readings", () => {
    expect(analyse(synth(1.5, 2000)).within5).toBeGreaterThan(0.95);
    expect(analyse(synth(6, 2000)).within5).toBeLessThan(0.6);
  });

  it("@Q7 reads a csv and refuses a bad one", () => {
    const csv = "point,true_lat,true_lng,lat,lng,accuracy_m\nA,1.5,103.6,1.50001,103.60001,4\n";
    expect(parseCsv(csv)).toHaveLength(1);
    expect(() => parseCsv("point,lat\nA,1")).toThrow(/missing column/);
    expect(() => parseCsv("point,true_lat,true_lng,lat,lng,accuracy_m\nA,x,1,1,1,1")).toThrow(/bad number/);
  });

  it("@Q7 draws a plot", () => {
    expect(cdfSvg(analyse(synth(3, 200)).errors)).toContain("<polyline");
  });
});
