// NHR: relay abuse cases: takeover, floods, bad players, odd names, origin, limits
import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { Relay, MAX_LOBBIES, CREATES_PER_MINUTE } from "../src/relay";
import { startRelay, MAX_MESSAGE } from "../src/server";
import { parseClient, type ServerMsg } from "../../../contracts/src";

function conn(id: string, address = "1.1.1.1") {
  const out: ServerMsg[] = [];
  return { id, address, out, send: (m: ServerMsg) => void out.push(m), last: (t: string) => [...out].reverse().find((m) => m.t === t) as any };
}
const mk = () => {
  const t = { v: 1_000_000 };
  const relay = new Relay({ secret: "s", publicUrl: "http://x", now: () => t.v });
  const org = conn("org");
  relay.handle(org, { t: "create", name: "Boss", mode: "play", holes: 18 });
  return { relay, org, code: org.last("created").code as string, t };
};
const ev = (id: string, playerId: string) => ({ id, playerId, hole: 1, strokes: 4, ts: 1, kind: "score" as const });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("relay abuse", () => {
  it("@R1 joining with the organiser's device id does not give organiser rights", () => {
    const { relay, org, code } = mk();
    for (const id of ["organiser", "org:0000000000000000", "dev"]) {
      const evil = conn(`e-${id}`, `6.6.6.${id.length}`);
      relay.handle(evil, { t: "join", code, name: "Evil", deviceId: id });
      expect(evil.last("pending")).toBeTruthy();
      expect(evil.last("approved")).toBeUndefined();
      relay.handle(evil, { t: "lock", mode: "competition" });
      expect(evil.last("error").code).toBe("DENIED");
    }
    expect(org.last("state").lock).toBeNull();
  });

  it("@R1 even the real organiser device id cannot be used to join as the organiser", () => {
    const { relay, org, code } = mk();
    const lobby: any = [...(relay as any).lobbies.values()][0];
    const realId = lobby.players.get("p1").deviceId;
    const evil = conn("evil", "6.6.6.6");
    relay.handle(evil, { t: "join", code, name: "Evil", deviceId: realId });
    expect(evil.last("approved")).toBeUndefined();
    expect(evil.last("pending").playerId).toBe("p2");
    expect(org.last("state").players).toHaveLength(1);
  });

  it("@R1 a lobby is closed at exactly twelve hours", () => {
    const { relay, code, t } = mk();
    t.v += 12 * 3_600_000 - 1;
    const early = conn("early", "4.4.4.4");
    relay.handle(early, { t: "join", code, name: "E", deviceId: "d1" });
    expect(early.last("pending")).toBeTruthy();
    t.v += 1;
    const late = conn("late", "4.4.4.5");
    relay.handle(late, { t: "join", code, name: "L", deviceId: "d2" });
    expect(late.last("error").code).toBe("EXPIRED");
  });

  it("@R1 one address cannot fill the relay with lobbies", () => {
    const { relay } = mk();
    const c = conn("many", "5.5.5.5");
    for (let i = 0; i < CREATES_PER_MINUTE + 10; i++) relay.handle(c, { t: "create", name: "S", mode: "play", holes: 9 });
    expect(relay.stats().lobbies).toBe(1 + CREATES_PER_MINUTE);
    expect(c.last("error").code).toBe("RATE");
  });

  it("@R1 the relay refuses new lobbies at its global cap", () => {
    const { relay } = mk();
    for (let i = 0; i < MAX_LOBBIES; i++) relay.handle(conn(`c${i}`, `9.9.${Math.floor(i / 200)}.${i % 200}`), { t: "create", name: "S", mode: "play", holes: 9 });
    const late = conn("late", "8.8.8.8");
    relay.handle(late, { t: "create", name: "S", mode: "play", holes: 9 });
    expect(late.last("error").code).toBe("CAP");
  });

  it("@R1 events for a player who is not in the lobby are ignored and reported", () => {
    const { relay, org, code } = mk();
    relay.handle(org, { t: "events", batch: [ev("e1", "p1"), ev("e2", "p9")] });
    expect(relay.eventCount(code)).toBe(1);
    expect(org.last("error").code).toBe("BAD");
  });

  it("@R1 a resume snapshot with duplicate or odd player ids is refused", () => {
    const a = mk();
    const created = a.org.last("created");
    const b = new Relay({ secret: "s", publicUrl: "http://x" });
    const snap = (players: any[], events: any[] = []) => ({ mode: "play" as const, holes: 18 as const, lock: null, createdAt: Date.now() - 1000, expiresAt: Date.now() + 1e7, players, events });
    const ask = (players: any[], events?: any[]) => {
      const c = conn(`r${Math.random()}`);
      b.handle(c, { t: "resume", lobbyId: created.lobbyId, code: created.code, organiserToken: created.organiserToken, snapshot: snap(players, events) });
      return c;
    };
    expect(ask([{ id: "p1", name: "A", deviceId: "d", approved: true }, { id: "p1", name: "B", deviceId: "e", approved: true }]).last("error").code).toBe("BAD");
    expect(ask([{ id: "p1", name: "A", deviceId: "d", approved: true }, { id: "p2", name: "B", deviceId: "d", approved: true }]).last("error").code).toBe("BAD");
    expect(ask([{ id: "x1", name: "A", deviceId: "d", approved: true }]).last("error").code).toBe("BAD");
    const ok = ask([{ id: "p1", name: "A", deviceId: "d", approved: true }], [ev("e1", "p1"), ev("e2", "p7")]);
    expect(ok.last("state")).toBeTruthy();
    expect(b.eventCount(created.code)).toBe(1);
  });

  it("@R1 names lose control, zero-width and direction-override characters", () => {
    const ok = (name: string) => parseClient({ t: "create", name, mode: "play", holes: 9 });
    const r: any = ok("\u202Eevil\u200B name\u0007");
    expect(r.msg.name).toBe("evil name");
    expect(ok("\u200B\u202E").ok).toBe(false);
    expect(ok("x".repeat(25)).ok).toBe(false);
    expect(ok("a".repeat(121)).ok).toBe(false);
  });
});

describe("server limits", () => {
  const open = (url: string, headers: Record<string, string> = {}) =>
    new Promise<WebSocket>((ok, bad) => {
      const ws = new WebSocket(url, { headers });
      ws.once("open", () => ok(ws));
      ws.once("unexpected-response", (_r, res) => bad(new Error(String(res.statusCode))));
      ws.once("error", bad);
    });

  it("@R1 a browser origin is refused unless it is on the list", async () => {
    const s = await startRelay({ secret: "s", allowedOrigins: ["https://ok.example"] });
    await expect(open(s.url, { Origin: "https://evil.example" })).rejects.toThrow("403");
    const good = await open(s.url, { Origin: "https://ok.example" });
    const none = await open(s.url);
    good.close();
    none.close();
    const h: any = await (await fetch(`http://localhost:${s.port}/health`)).json();
    expect(h.originDenied).toBe(1);
    await s.close();
  });

  it("@R1 an address is limited to a number of open connections", async () => {
    const s = await startRelay({ secret: "s", maxPerAddress: 2 });
    const a = await open(s.url);
    const b = await open(s.url);
    await expect(open(s.url)).rejects.toThrow("429");
    a.close();
    await wait(50);
    (await open(s.url)).close();
    b.close();
    await s.close();
  });

  it("@R1 a socket that never joins or creates a lobby is closed", async () => {
    const s = await startRelay({ secret: "s", bindTimeoutMs: 80 });
    const ws = await open(s.url);
    let closed = false;
    ws.on("close", () => (closed = true));
    await wait(250);
    expect(closed).toBe(true);
    await s.close();
  });

  it("@R1 a message over the size limit closes the socket", async () => {
    const s = await startRelay({ secret: "s" });
    const ws = await open(s.url);
    let code = 0;
    ws.on("close", (c) => (code = c));
    ws.send("x".repeat(MAX_MESSAGE + 10));
    await wait(200);
    expect(code).toBe(1009);
    await s.close();
  });

  it("@R1 health reports counts only, never names or scores", async () => {
    const s = await startRelay({ secret: "s" });
    const ws = await open(s.url);
    ws.send(JSON.stringify({ t: "create", name: "SecretName", mode: "play", holes: 9 }));
    await wait(100);
    const text = await (await fetch(`http://localhost:${s.port}/health`)).text();
    expect(text).not.toContain("SecretName");
    expect(JSON.parse(text)).toMatchObject({ ok: true, lobbies: 1, connections: 1 });
    ws.close();
    await s.close();
  });
});

describe("oversized input", () => {
  it("@R1 the largest allowed message full of empty objects is rejected quickly", () => {
    const body = `{"t":"events","batch":[${Array(Math.floor(MAX_MESSAGE / 3) - 20).fill("{}").join(",")}]}`;
    expect(body.length).toBeLessThanOrEqual(MAX_MESSAGE);
    const start = performance.now();
    const r = parseClient(body);
    expect(r.ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(100);
  });
});
