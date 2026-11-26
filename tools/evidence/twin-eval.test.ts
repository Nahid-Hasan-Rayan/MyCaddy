// NHR: twin error falls as shots are added
import { describe, it, expect } from "vitest";
import { evaluate } from "./twin-eval";

describe("twin evaluation", () => {
  const rows = evaluate();
  const at = (n: number) => rows.find((r) => r.shots === n)!;

  it("@R4 the mean error falls from the prior to 40 shots", () => {
    expect(at(40).meanRmse).toBeLessThan(at(0).meanRmse / 2);
    expect(at(10).meanRmse).toBeLessThan(at(3).meanRmse);
    expect(at(20).meanRmse).toBeLessThan(at(10).meanRmse);
  });

  it("@R4 the spread error falls too", () => {
    expect(at(20).sdRmse).toBeLessThan(at(0).sdRmse);
    expect(at(40).sdRmse).toBeLessThan(at(5).sdRmse);
  });
});
