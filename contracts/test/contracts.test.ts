// NHR: every fixture parses, every invalid fixture is rejected
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  parseClient,
  parseServer,
  ProxyReq,
  ProxyRes,
  CoursePack,
  ExportV1,
  RULES,
} from "../src";

const dir = join(__dirname, "../fixtures");
const load = (p: string) => JSON.parse(readFileSync(join(dir, p), "utf8"));
const names = (sub = "") => readdirSync(join(dir, sub)).filter((f) => f.endsWith(".json"));

describe("valid fixtures", () => {
  for (const f of names().filter((n) => n.startsWith("client-")))
    it(`@R1 client message ${f}`, () => expect(parseClient(load(f)).ok).toBe(true));

  for (const f of names().filter((n) => n.startsWith("server-")))
    it(`@R1 server message ${f}`, () => expect(parseServer(load(f)).ok).toBe(true));

  it("@R1 proxy request and response", () => {
    expect(ProxyReq.safeParse(load("proxy-request.json")).success).toBe(true);
    expect(ProxyRes.safeParse(load("proxy-response.json")).success).toBe(true);
  });

  it("@R1 course pack", () => expect(CoursePack.safeParse(load("pack.json")).success).toBe(true));
  it("@R1 export", () => expect(ExportV1.safeParse(load("export.json")).success).toBe(true));
});

describe("invalid fixtures", () => {
  for (const f of names("invalid").filter((n) => n.startsWith("client-")))
    it(`@R1 rejects ${f} as BAD`, () => {
      const r = parseClient(load(`invalid/${f}`));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("BAD");
    });

  it("@R1 proxy refuses competition mode", () =>
    expect(ProxyReq.safeParse(load("invalid/proxy-competition.json")).success).toBe(false));

  it("@R1 pack must label virtual hazards as simulated", () =>
    expect(CoursePack.safeParse(load("invalid/pack-unlabelled-virtual.json")).success).toBe(false));

  it("@R1 export refuses secret-like keys", () =>
    expect(ExportV1.safeParse(load("invalid/export-with-token.json")).success).toBe(false));
});

describe("parsing rules", () => {
  it("@R1 unknown fields are dropped", () => {
    const r = parseClient({ t: "join", code: "K7M2QX", name: "Ghazi", deviceId: "d", admin: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect("admin" in r.msg).toBe(false);
  });

  it("@R1 raw json strings and garbage are handled", () => {
    expect(parseClient(JSON.stringify(load("client-ping.json"))).ok).toBe(true);
    expect(parseClient("{not json").ok).toBe(false);
    expect(parseClient(null).ok).toBe(false);
    expect(parseClient(42).ok).toBe(false);
  });

  it("@R1 names are trimmed", () => {
    const r = parseClient({ t: "create", name: "  Nahid  ", mode: "play", holes: 9 });
    expect(r.ok && r.msg.t === "create" && r.msg.name).toBe("Nahid");
  });

  it("@R1 oversized event batches are rejected", () => {
    const e = { id: "x", playerId: "p", hole: 1, strokes: 3, ts: 1 };
    const batch = Array.from({ length: RULES.maxBatch + 1 }, (_, i) => ({ ...e, id: `x${i}` }));
    expect(parseClient({ t: "events", batch }).ok).toBe(false);
  });

  it("@R1 code alphabet has no look-alike characters", () => {
    for (const c of "01OIL") expect(RULES.codeAlphabet.includes(c)).toBe(false);
    expect(RULES.codeAlphabet).toHaveLength(31);
  });
});
