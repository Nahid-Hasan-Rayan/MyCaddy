// NHR: twin shrinkage, miss tendency and drift
import { describe, it, expect } from "vitest";
import { twinClub, quality, missTendency, drift, type Prior } from "../src/twin";

const prior: Prior = { mean: 150, sd: 10, strength: 5 };

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(r: () => number, mean: number, sd: number) {
  const u = Math.max(r(), 1e-12);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

describe("club twin", () => {
  it("@R4 starts at the prior with no shots", () => {
    expect(twinClub([], prior)).toEqual({ mean: 150, sd: 10, count: 0, quality: "starter" });
  });

  it("@R4 quality labels follow the shot count", () => {
    expect(quality(4)).toBe("starter");
    expect(quality(5)).toBe("learning");
    expect(quality(14)).toBe("learning");
    expect(quality(15)).toBe("reliable");
  });

  it("@R4 few shots stay close to the prior, many shots move to the data", () => {
    const few = twinClub([130, 132], prior);
    const many = twinClub(Array.from({ length: 40 }, (_, i) => 130 + (i % 3)), prior);
    expect(few.mean).toBeGreaterThan(140);
    expect(many.mean).toBeLessThan(134);
  });

  it("@R4 error falls as shots are added (seeded)", () => {
    const r = rng(11);
    const trueMean = 135;
    const err = (n: number) => {
      let total = 0;
      for (let g = 0; g < 300; g++) {
        const shots = Array.from({ length: n }, () => normal(r, trueMean, 8));
        total += Math.abs(twinClub(shots, prior).mean - trueMean);
      }
      return total / 300;
    };
    const e3 = err(3);
    const e10 = err(10);
    const e30 = err(30);
    expect(e10).toBeLessThan(e3);
    expect(e30).toBeLessThan(e10);
  });
});

describe("hole miss tendency", () => {
  it("@R4 stays quiet under three visits", () => {
    expect(missTendency(["left", "left"])).toBeNull();
  });

  it("@R4 speaks after three visits with a clear majority", () => {
    expect(missTendency(["left", "left", "left"])).toBe("left");
    expect(missTendency(["right", "right", "ok", "right", "ok"])).toBe("right");
  });

  it("@R4 half of the visits is not a clear majority", () => {
    expect(missTendency(["left", "left", "ok", "ok"])).toBeNull();
    expect(missTendency(["left", "left", "left", "ok", "ok"])).toBe("left");
  });

  it("@R4 no clear majority means no tendency", () => {
    expect(missTendency(["left", "right", "ok", "ok"])).toBeNull();
    expect(missTendency(["left", "left", "ok", "ok", "ok"])).toBeNull();
  });
});

describe("drift", () => {
  const steady = [150, 152, 148, 151, 149, 150];

  it("@R4 needs enough shots", () => {
    expect(drift([150, 151, 149, 150]).flag).toBe(false);
  });

  it("@R4 flags a clear shift in the last five shots", () => {
    const d = drift([...steady, 138, 139, 137, 140, 138]);
    expect(d.flag).toBe(true);
    expect(d.delta).toBeLessThan(0);
  });

  it("@R4 normal variation is not drift", () => {
    expect(drift([...steady, 151, 149, 150, 152, 148]).flag).toBe(false);
  });
});
