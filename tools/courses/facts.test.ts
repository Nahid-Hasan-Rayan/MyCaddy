// NHR: course facts files stay valid and match the club page totals
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CourseFacts, summary } from "./facts";

const files = readdirSync(__dirname).filter((f) => f.endsWith(".facts.json"));
const load = (f: string) => JSON.parse(readFileSync(join(__dirname, f), "utf8"));

describe("course facts", () => {
  for (const f of files)
    it(`@R3 ${f} passes the schema`, () => {
      const r = CourseFacts.safeParse(load(f));
      expect(r.success).toBe(true);
    });

  it("@R3 KLGCC West is par 72 and 6372 m from the first tee set", () => {
    const s = summary(CourseFacts.parse(load("klgcc-west.facts.json")));
    expect(s.par).toBe(72);
    expect(s.totals[0]).toBe(6372);
  });

  it("@R3 the club page names water on 10 holes", () => {
    expect(summary(CourseFacts.parse(load("klgcc-west.facts.json"))).waterHoles).toBe(10);
  });

  it("@R3 rejects tee lengths that grow and missing lengths", () => {
    const c = load("klgcc-west.facts.json");
    c.holes[0].lengths = [300, 351, 316, 308];
    expect(CourseFacts.safeParse(c).success).toBe(false);
    const d = load("klgcc-west.facts.json");
    d.holes[1].lengths = [406, 391];
    expect(CourseFacts.safeParse(d).success).toBe(false);
  });
});
