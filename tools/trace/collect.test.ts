// NHR: trace collector finds tags in test titles only
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collect, toMarkdown } from "./collect";

const FN = "it";

function sample() {
  const root = mkdtempSync(join(tmpdir(), "trace-"));
  mkdirSync(join(root, "a"));
  mkdirSync(join(root, "node_modules"));
  writeFileSync(
    join(root, "a/x.test.ts"),
    [`${FN}("@Q3 @F3 restart keeps events", () => {});`, `${FN}("no tag here", () => {});`].join("\n")
  );
  writeFileSync(join(root, "node_modules/y.test.ts"), `${FN}("@Q9 hidden", () => {});`);
  return root;
}

describe("trace collector", () => {
  it("reads several tags from one title and skips node_modules", () => {
    const tags = collect(sample()).map((h) => h.tag);
    expect(tags).toContain("Q3");
    expect(tags).toContain("F3");
    expect(tags).not.toContain("Q9");
  });

  it("reports file and line", () => {
    const h = collect(sample()).find((x) => x.tag === "Q3")!;
    expect(h.file).toBe(join("a", "x.test.ts"));
    expect(h.line).toBe(1);
  });

  it("writes one markdown row per tag", () => {
    const md = toMarkdown(collect(sample()));
    expect(md).toContain("| Q3 | 1 |");
    expect(md.split("\n").filter((l) => l.startsWith("| F3"))).toHaveLength(1);
  });
});
