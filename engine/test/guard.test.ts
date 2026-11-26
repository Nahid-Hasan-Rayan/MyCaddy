// NHR: number guard behaviour on single cases
import { describe, it, expect } from "vitest";
import { numbersIn, guard } from "../src/guard";

describe("number guard", () => {
  it("@A53 reads digits, decimals, thousands and percentages", () => {
    expect(numbersIn("142 m, give or take 6.5, 30% risk, 1,200 total")).toEqual([142, 6.5, 30, 1200]);
    expect(numbersIn("1,5 km")).toEqual([1.5]);
    expect(numbersIn("140-160")).toEqual([140, 160]);
  });

  it("@A53 reads English number words", () => {
    expect(numbersIn("forty-two metres")).toEqual([42]);
    expect(numbersIn("a hundred and forty")).toEqual([140]);
    expect(numbersIn("two hundred fifty five")).toEqual([255]);
    expect(numbersIn("six seven")).toEqual([6, 7]);
    expect(numbersIn("thirteen")).toEqual([13]);
  });

  it("@A53 reads Malay number words", () => {
    expect(numbersIn("seratus empat puluh meter")).toEqual([140]);
    expect(numbersIn("dua belas")).toEqual([12]);
    expect(numbersIn("lima puluh lima")).toEqual([55]);
    expect(numbersIn("sepuluh dan tiga")).toEqual([10, 3]);
    expect(numbersIn("dua ratus lima")).toEqual([205]);
  });

  it("@A53 reads full-width, Arabic-Indic and superscript digits", () => {
    expect(numbersIn("１４２ m")).toEqual([142]);
    expect(numbersIn("٣٥ meter")).toEqual([35]);
    expect(numbersIn("club ⁷")).toEqual([7]);
    expect(numbersIn("½ club")).toEqual([0.5]);
  });

  it("@A53 flags a number that is not in the facts", () => {
    expect(guard("Take a 7-iron, 142 m", [7, 142]).ok).toBe(true);
    expect(guard("Take a 7-iron, 143 m", [7, 142])).toEqual({ ok: false, invented: [143] });
    expect(guard("no numbers here", []).ok).toBe(true);
  });

  it("@A53 a tolerance lets rounded values pass", () => {
    expect(guard("about 142", [142.4], 0.5).ok).toBe(true);
    expect(guard("about 142", [145], 0.5).ok).toBe(false);
  });
});
