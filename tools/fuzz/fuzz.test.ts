// NHR: number guard fuzz, 500 mock model outputs
import { describe, it, expect } from "vitest";
import { guard } from "../../engine/src/guard";
import { mockModel } from "./mockModel";

describe("number guard fuzz", () => {
  const cases = mockModel(20261121, 500);

  it("@A53 500 cases: no invented number gets through", () => {
    const leaks = cases.filter((c) => c.hasInvented && guard(c.text, c.allowed).ok);
    expect(leaks.map((c) => c.text)).toEqual([]);
  });

  it("@A53 500 cases: no valid wording is rejected", () => {
    const wrong = cases.filter((c) => !c.hasInvented && !guard(c.text, c.allowed).ok);
    expect(wrong.map((c) => c.text)).toEqual([]);
  });

  it("@A53 the run has both kinds of case", () => {
    expect(cases).toHaveLength(500);
    const bad = cases.filter((c) => c.hasInvented).length;
    expect(bad).toBeGreaterThan(200);
    expect(bad).toBeLessThan(300);
  });
});
