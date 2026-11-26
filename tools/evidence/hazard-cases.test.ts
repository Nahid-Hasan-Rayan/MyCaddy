// NHR: every hand-calculated hazard case matches the engine
import { describe, it, expect } from "vitest";
import { run } from "./hazard-cases";

describe("hazard hand cases", () => {
  it("@R3 all cases match within rounding", () => {
    const bad = run().filter((r) => !r.ok);
    expect(bad.map((r) => r.name)).toEqual([]);
  });
});
