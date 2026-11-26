// NHR: collects requirement tags (@Q3, @C6, @R2) from test titles
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export interface Hit {
  tag: string;
  title: string;
  file: string;
  line: number;
}

const TITLE = /\b(?:it|test)\(\s*(["'`])(.*?)\1/;
const TAG = /@([A-Z]{1,3}\d{1,3})\b/g;
const SKIP = new Set(["node_modules", ".git", "dist", "types"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

export function collect(root: string): Hit[] {
  const hits: Hit[] = [];
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, i) => {
      const m = TITLE.exec(text);
      if (!m) return;
      const title = m[2] ?? "";
      for (const t of title.matchAll(TAG)) hits.push({ tag: t[1]!, title, file: relative(root, file), line: i + 1 });
    });
  }
  return hits.sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }) || a.file.localeCompare(b.file));
}

export function toMarkdown(hits: Hit[]): string {
  const byTag = new Map<string, Hit[]>();
  for (const h of hits) byTag.set(h.tag, [...(byTag.get(h.tag) ?? []), h]);
  const rows = [...byTag.entries()].map(([tag, hs]) => {
    const files = [...new Set(hs.map((h) => h.file))].join(", ");
    return `| ${tag} | ${hs.length} | ${files} |`;
  });
  return ["# Test trace", "", "| Tag | Tests | Files |", "|---|---|---|", ...rows, ""].join("\n");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.cwd();
  const hits = collect(root);
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs/trace.json"), JSON.stringify(hits, null, 2) + "\n");
  writeFileSync(join(root, "docs/TRACE.md"), toMarkdown(hits));
  console.log(`${hits.length} tagged tests, ${new Set(hits.map((h) => h.tag)).size} tags`);
}
