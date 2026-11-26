// NHR: sensitivity table behaves as expected
import { describe, it, expect } from "vitest";
import { table } from "./sensitivity";

describe("sensitivity table", () => {
  it("@R3 converting the GPS radius lowers the risk when the hazard sits on the tail", () => {
    const rows = table(135, 150, 165, 6, 3).filter((r) => r.sd === 8);
    expect(rows[1]!.p).toBeLessThan(rows[0]!.p);
  });

  it("@R3 a wider spread prior raises tail risk and can change the band", () => {
    const rows = table(135, 150, 165, 6, 3).filter((r) => r.gps === "radius converted");
    expect(rows[2]!.p).toBeGreaterThan(rows[0]!.p);
    expect(rows[0]!.band).not.toBe(rows[2]!.band);
  });
});
