// NHR: four simulated phones on real websockets, one drop and rejoin, one relay restart
import WebSocket from "ws";
import { parseServer, type ClientMsg, type ScoreEvent, type ServerMsg } from "../../../contracts/src";
import { startRelay } from "../src/server";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(test: () => boolean, what: string, ms = 4000) {
  const end = Date.now() + ms;
  while (!test()) {
    if (Date.now() > end) throw new Error(`timed out: ${what}`);
    await sleep(10);
  }
}

class Phone {
  ws!: WebSocket;
  events = new Map<string, ScoreEvent>();
  last: Partial<Record<ServerMsg["t"], any>> = {};
  pending: { playerId: string; name?: string; deviceId?: string }[] = [];
  me = "";
  closed = true;
  constructor(public url: string, public name: string, public deviceId: string) {}

  async open() {
    this.ws = new WebSocket(this.url);
    this.closed = false;
    this.ws.on("close", () => (this.closed = true));
    this.ws.on("message", (raw) => {
      const r = parseServer(raw.toString());
      if (!r.ok) throw new Error("relay sent a message that fails the contract");
      const m = r.msg;
      this.last[m.t] = m;
      if (m.t === "events") for (const e of m.batch) this.events.set(e.id, e);
      if (m.t === "pending" && m.name) this.pending.push(m);
      if (m.t === "approved") this.me = m.playerId;
    });
    await new Promise<void>((ok, bad) => {
      this.ws.once("open", () => ok());
      this.ws.once("error", bad);
    });
  }
  send(m: ClientMsg) {
    this.ws.send(JSON.stringify(m));
  }
  record(hole: number, strokes: number) {
    const e: ScoreEvent = { id: `${this.deviceId}-h${hole}`, playerId: this.me || "p1", hole, strokes, ts: Date.now(), kind: "score" };
    this.events.set(e.id, e);
    return e;
  }
  sendAll() {
    this.send({ t: "events", batch: [...this.events.values()] });
  }
}

export interface SimResult {
  perPhone: number[];
  relayEvents: number;
  lost: number;
}

export async function fourPhones(): Promise<SimResult> {
  const secret = "sim-secret";
  let relay = await startRelay({ secret });
  const port = relay.port;
  const url = relay.url;
  const org = new Phone(url, "Nahid", "organiser");
  const others = [new Phone(url, "Ayham", "dev-a"), new Phone(url, "Alfian", "dev-b"), new Phone(url, "Ghazi", "dev-c")];
  const all = [org, ...others];
  const sent = new Set<string>();

  await org.open();
  org.send({ t: "create", name: org.name, mode: "play", holes: 18 });
  await until(() => !!org.last.created, "lobby created");
  const created = org.last.created;
  org.me = "p1";

  for (const p of others) {
    await p.open();
    p.send({ t: "join", code: created.code, name: p.name, deviceId: p.deviceId });
  }
  await until(() => org.pending.length === 3, "three join requests");
  for (const q of org.pending) org.send({ t: "approve", playerId: q.playerId, ok: true });
  await until(() => others.every((p) => !!p.last.approved), "all approved");
  const roster = [{ id: "p1", name: org.name, deviceId: "organiser", approved: true }, ...org.pending.map((q) => ({ id: q.playerId, name: q.name!, deviceId: q.deviceId!, approved: true }))];

  const play = async (hole: number, who: Phone[]) => {
    for (const p of who) {
      const e = p.record(hole, 3 + (hole % 3));
      sent.add(e.id);
      if (!p.closed) p.send({ t: "events", batch: [e] });
    }
  };

  await play(1, all);
  await until(() => all.every((p) => p.events.size === 4), "hole 1 everywhere");

  const c = others[2]!;
  c.ws.close();
  await until(() => org.last.state?.players.find((p: any) => p.name === "Ghazi")?.state === "offline", "C offline");
  await play(2, all);
  await until(() => [org, others[0]!, others[1]!].every((p) => p.events.size === 7), "hole 2 without C");
  await c.open();
  c.send({ t: "join", code: created.code, name: c.name, deviceId: c.deviceId });
  await until(() => c.events.size === 8, "C catches up");
  c.sendAll();
  await until(() => all.every((p) => p.events.size === 8), "hole 2 everywhere");

  await relay.close();
  await until(() => all.every((p) => p.closed), "all sockets closed");
  relay = await startRelay({ secret, port });
  const snapshot = { mode: "play" as const, holes: 18 as const, lock: null, createdAt: created.expiresAt - 12 * 3_600_000, expiresAt: created.expiresAt, players: roster, events: [...org.events.values()] };
  await org.open();
  org.last = {};
  org.send({ t: "resume", lobbyId: created.lobbyId, code: created.code, organiserToken: created.organiserToken, snapshot });
  await until(() => !!org.last.state, "lobby resumed");
  for (const p of others) {
    await p.open();
    p.last = {};
    p.send({ t: "join", code: created.code, name: p.name, deviceId: p.deviceId });
  }
  await until(() => others.every((p) => !!p.last.approved), "rejoined without approval");
  for (const p of all) p.sendAll();
  await play(3, all);
  await until(() => all.every((p) => p.events.size === 12), "hole 3 everywhere");
  await sleep(50);

  const result: SimResult = {
    perPhone: all.map((p) => p.events.size),
    relayEvents: relay.relay.eventCount(created.code),
    lost: [...sent].filter((id) => !all.every((p) => p.events.has(id))).length,
  };
  for (const p of all) p.ws.close();
  await relay.close();
  return result;
}
