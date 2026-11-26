// NHR: spread priors from the within-5-yard rate
import { describe, it, expect } from "vitest";
import { inverseNormal, sigmaFromWithin, sevenIronSpreadYd, spreadPrior, YARD } from "../src/priors";

describe("spread priors", () => {
  it("@R4 a yard is 0.9144 m and the 15 handicap prior holds in plain metres", () => {
    expect(YARD).toBe(0.9144);
    expect(spreadPrior(15, 140.8)).toBeCloseTo(25.9, 0);
  });

  it("@R4 the inverse normal matches known quantiles", () => {
    expect(inverseNormal(0.5)).toBeCloseTo(0, 6);
    expect(inverseNormal(0.975)).toBeCloseTo(1.959964, 4);
  });

  it("@R4 14% of shots within 5 yards implies a spread of about 28 yards", () => {
    expect(sigmaFromWithin(0.14, 5)).toBeCloseTo(28.35, 1);
  });

  it("@R4 a 15 handicap 7-iron prior is about 26 m", () => {
    expect(spreadPrior(15, 154 * YARD)).toBeCloseTo(25.9, 0);
  });

  it("@R4 better players are tighter, and the prior scales with club distance", () => {
    expect(sevenIronSpreadYd(0)).toBeLessThan(sevenIronSpreadYd(15));
    expect(sevenIronSpreadYd(15)).toBeLessThan(sevenIronSpreadYd(25));
    expect(spreadPrior(15, 100)).toBeLessThan(spreadPrior(15, 200));
  });

  it("@R4 handicaps outside the data range are clamped", () => {
    expect(sevenIronSpreadYd(-3)).toBe(sevenIronSpreadYd(0));
    expect(sevenIronSpreadYd(40)).toBe(sevenIronSpreadYd(25));
  });
});
