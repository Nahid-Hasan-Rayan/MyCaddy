// NHR: relay rules with fake connections and a fake clock
import { describe, it, expect } from "vitest";
import { Relay, AWAY_MS } from "../src/relay";
import { RULES, type ServerMsg, type ClientMsg } from "../../../contracts/src";

const SECRET = "test-secret";
const HOUR = 3_600_000;

function setup(secret = SECRET) {
  let t = 1_000_000;
  const clock = { now: () => t, tick: (ms: number) => (t += ms) };
  const relay = new Relay({ secret, publicUrl: "http://x", now: clock.now });
  return { relay, clock };
}
function conn(id: string, address = "1.1.1.1") {
  const out: ServerMsg[] = [];
  return { id, address, out, send: (m: ServerMsg) => void out.push(m), last: (t: string) => [...out].reverse().find((m) => m.t === t) as any };
}
const ev = (id: string, playerId = "p1", hole = 1) => ({ id, playerId, hole, strokes: 4, ts: 1, kind: "score" as const });
type C = ReturnType<typeof conn>;

function lobby(relay: Relay, extra = 0) {
  const org = conn("org");
  relay.handle(org, { t: "create", name: "Nahid", mode: "play", holes: 18 });
  const created = org.last("created");
  const phones: C[] = [];
  for (let i = 0; i < extra; i++) {
    const c = conn(`c${i}`, `9.9.9.${i}`);
    relay.handle(c, { t: "join", code: created.code, name: `P${i}`, deviceId: `dev${i}` });
    relay.handle(org, { t: "approve", playerId: c.last("pending").playerId, ok: true });
    phones.push(c);
  }
  return { org, created, phones };
}

describe("relay lobby", () => {
  it("@R1 create returns a code, invite link and organiser token", () => {
    const { relay } = setup();
    const { created } = lobby(relay);
    expect(created.code).toMatch(new RegExp(`^[${RULES.codeAlphabet}]{6}$`));
    expect(created.inviteUrl).toBe(`http://x/join/${created.code}`);
    expect(created.organiserToken).toHaveLength(64);
  });

  it("@R1 join needs approval and the organiser sees the name", () => {
    const { relay } = setup();
    const { org, created } = lobby(relay);
    const c = conn("a");
    relay.handle(c, { t: "join", code: created.code, name: "Ayham", deviceId: "d1" });
    expect(c.last("pending").playerId).toBe("p2");
    expect(org.last("pending")).toMatchObject({ playerId: "p2", name: "Ayham", deviceId: "d1" });
    relay.handle(c, { t: "events", batch: [ev("e1")] });
    expect(c.last("error").code).toBe("DENIED");
    relay.handle(org, { t: "approve", playerId: "p2", ok: true });
    expect(c.last("approved").playerId).toBe("p2");
    expect(org.last("state").players).toHaveLength(2);
  });

  it("@R1 a denied player is removed", () => {
    const { relay } = setup();
    const { org, created } = lobby(relay);
    const c = conn("a");
    relay.handle(c, { t: "join", code: created.code, name: "X", deviceId: "d1" });
    relay.handle(org, { t: "approve", playerId: "p2", ok: false });
    expect(c.last("denied").playerId).toBe("p2");
    expect(org.last("state").players).toHaveLength(1);
  });

  it("@R1 a fifth person is refused: cap of 4 players", () => {
    const { relay } = setup();
    const { created } = lobby(relay, 3);
    const late = conn("late", "8.8.8.8");
    relay.handle(late, { t: "join", code: created.code, name: "Late", deviceId: "dx" });
    expect(late.last("error").code).toBe("CAP");
  });

  it("@R1 joins are limited to 10 a minute per address", () => {
    const { relay, clock } = setup();
    const { created } = lobby(relay);
    const c = conn("spam", "7.7.7.7");
    const join = (i: number) => relay.handle(c, { t: "join", code: "ZZZZZZ", name: "S", deviceId: `d${i}` } as ClientMsg);
    for (let i = 0; i < 10; i++) join(i);
    expect(c.last("error").code).toBe("UNKNOWN_LOBBY");
    join(10);
    expect(c.last("error").code).toBe("RATE");
    const other = conn("other", "6.6.6.6");
    relay.handle(other, { t: "join", code: created.code, name: "O", deviceId: "o1" });
    expect(other.last("pending")).toBeTruthy();
    clock.tick(61_000);
    join(11);
    expect(c.last("error").code).toBe("UNKNOWN_LOBBY");
  });

  it("@R1 unknown codes and unbound sockets are refused", () => {
    const { relay } = setup();
    const c = conn("z");
    relay.handle(c, { t: "events", batch: [ev("e1")] });
    expect(c.last("error").code).toBe("UNKNOWN_LOBBY");
    relay.handle(c, { t: "lock", mode: "competition" });
    expect(c.last("error").code).toBe("UNKNOWN_LOBBY");
  });
});

describe("relay events and lock", () => {
  it("@R1 events are forwarded once, never echoed, and deduped by id", () => {
    const { relay } = setup();
    const { org, created, phones } = lobby(relay, 2);
    relay.handle(org, { t: "events", batch: [ev("e1"), ev("e2")] });
    relay.handle(org, { t: "events", batch: [ev("e1"), ev("e3")] });
    const got = phones[0]!.out.filter((m) => m.t === "events").flatMap((m: any) => m.batch.map((e: any) => e.id));
    expect(got).toEqual(["e1", "e2", "e3"]);
    expect(org.out.filter((m) => m.t === "events")).toHaveLength(0);
    expect(relay.eventCount(created.code)).toBe(3);
  });

  it("@R1 only the organiser can approve or lock", () => {
    const { relay } = setup();
    const { org, created, phones } = lobby(relay, 1);
    const c = conn("n");
    relay.handle(c, { t: "join", code: created.code, name: "N", deviceId: "dn" });
    relay.handle(phones[0]!, { t: "approve", playerId: "p3", ok: true });
    expect(phones[0]!.last("error").code).toBe("DENIED");
    relay.handle(phones[0]!, { t: "lock", mode: "competition" });
    expect(phones[0]!.last("error").code).toBe("DENIED");
    relay.handle(org, { t: "lock", mode: "competition" });
    expect(phones[0]!.last("state").lock).toBe("competition");
    relay.handle(org, { t: "lock", mode: null });
    expect(phones[0]!.last("state").lock).toBeNull();
  });

  it("@R1 the same device rejoins without approval and gets every event", () => {
    const { relay } = setup();
    const { org, created, phones } = lobby(relay, 1);
    relay.handle(org, { t: "events", batch: [ev("e1"), ev("e2")] });
    relay.close(phones[0]!);
    expect(org.last("state").players.find((p: any) => p.id === "p2").state).toBe("offline");
    relay.handle(org, { t: "events", batch: [ev("e3")] });
    const back = conn("back", "9.9.9.0");
    relay.handle(back, { t: "join", code: created.code, name: "P0", deviceId: "dev0" });
    expect(back.last("approved").playerId).toBe("p2");
    expect(back.last("events").batch.map((e: any) => e.id)).toEqual(["e1", "e2", "e3"]);
    expect(org.last("state").players.find((p: any) => p.id === "p2").state).toBe("online");
  });

  it("@R1 a quiet player shows as away after a minute", () => {
    const { relay, clock } = setup();
    const { org, phones } = lobby(relay, 1);
    clock.tick(AWAY_MS + 1);
    relay.handle(org, { t: "ping" });
    relay.sweep();
    expect(org.last("state").players.find((p: any) => p.id === "p2").state).toBe("away");
    relay.handle(phones[0]!, { t: "ping" });
    relay.sweep();
    expect(org.last("state").players.find((p: any) => p.id === "p2").state).toBe("online");
  });
});

describe("relay restart and expiry", () => {
  const snapshotOf = (created: any, events: any[]) => ({
    mode: "play" as const,
    holes: 18 as const,
    lock: null,
    createdAt: 1_000_000,
    expiresAt: created.expiresAt,
    players: [
      { id: "p1", name: "Nahid", deviceId: "organiser", approved: true },
      { id: "p2", name: "P0", deviceId: "dev0", approved: true },
    ],
    events,
  });

  it("@Q3 @F3 a restarted relay rebuilds the lobby from the organiser snapshot", () => {
    const a = setup();
    const { created } = lobby(a.relay, 1);
    const events = [ev("e1"), ev("e2")];
    const b = setup();
    const org = conn("org2");
    b.relay.handle(org, { t: "resume", lobbyId: created.lobbyId, code: created.code, organiserToken: created.organiserToken, snapshot: snapshotOf(created, events) });
    expect(org.last("state").players).toHaveLength(2);
    expect(b.relay.eventCount(created.code)).toBe(2);
    const phone = conn("ph", "9.9.9.0");
    b.relay.handle(phone, { t: "join", code: created.code, name: "P0", deviceId: "dev0" });
    expect(phone.last("approved").playerId).toBe("p2");
    expect(phone.last("events").batch).toHaveLength(2);
    b.relay.handle(phone, { t: "events", batch: [ev("e2"), ev("e3", "p2")] });
    expect(b.relay.eventCount(created.code)).toBe(3);
  });

  it("@Q3 resuming a lobby that still exists merges events instead of rebuilding", () => {
    const { relay } = setup();
    const { created } = lobby(relay, 1);
    const org2 = conn("org2");
    relay.handle(org2, { t: "resume", lobbyId: created.lobbyId, code: created.code, organiserToken: created.organiserToken, snapshot: snapshotOf(created, [ev("e9")]) });
    expect(relay.eventCount(created.code)).toBe(1);
    expect(relay.stats().lobbies).toBe(1);
  });

  it("@R1 a wrong token, a wrong secret or a wrong code is refused", () => {
    const a = setup();
    const { created } = lobby(a.relay);
    const snap = snapshotOf(created, []);
    const c = conn("x");
    a.relay.handle(c, { t: "resume", lobbyId: created.lobbyId, code: created.code, organiserToken: "0".repeat(64), snapshot: snap });
    expect(c.last("error").code).toBe("DENIED");
    const other = setup("another-secret");
    other.relay.handle(c, { t: "resume", lobbyId: created.lobbyId, code: created.code, organiserToken: created.organiserToken, snapshot: snap });
    expect(c.out.filter((m) => m.t === "error").map((m: any) => m.code)).toEqual(["DENIED", "DENIED"]);
    a.relay.handle(c, { t: "resume", lobbyId: created.lobbyId, code: "AAAAAA", organiserToken: created.organiserToken, snapshot: snap });
    expect(c.last("error").code).toBe("BAD");
  });

  it("@R1 an expired snapshot is refused", () => {
    const a = setup();
    const { created } = lobby(a.relay);
    const b = setup();
    b.clock.tick(13 * HOUR);
    const c = conn("x");
    b.relay.handle(c, { t: "resume", lobbyId: created.lobbyId, code: created.code, organiserToken: created.organiserToken, snapshot: snapshotOf(created, []) });
    expect(c.last("error").code).toBe("EXPIRED");
  });

  it("@R1 lobbies expire after 12 hours and are deleted after 24", () => {
    const { relay, clock } = setup();
    const { created, org } = lobby(relay);
    clock.tick(12 * HOUR + 1);
    const c = conn("late", "5.5.5.5");
    relay.handle(c, { t: "join", code: created.code, name: "L", deviceId: "dl" });
    expect(c.last("error").code).toBe("EXPIRED");
    relay.handle(org, { t: "events", batch: [ev("e1")] });
    expect(org.last("error").code).toBe("EXPIRED");
    clock.tick(12 * HOUR);
    relay.sweep();
    expect(relay.stats().lobbies).toBe(0);
    relay.handle(c, { t: "join", code: created.code, name: "L", deviceId: "dl" });
    expect(c.last("error").code).toBe("UNKNOWN_LOBBY");
  });
});
