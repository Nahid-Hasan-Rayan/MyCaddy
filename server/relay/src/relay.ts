// NHR: in-memory lobby logic for the relay, no sockets, no logging of names or scores
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { RULES, type ClientMsg, type ServerMsg, type ScoreEvent, type ErrorCode } from "../../../contracts/src";

export interface Conn {
  id: string;
  address: string;
  send(msg: ServerMsg): void;
}

interface Player {
  id: string;
  name: string;
  deviceId: string;
  approved: boolean;
  conn: Conn | null;
  lastSeen: number;
}

interface Lobby {
  id: string;
  code: string;
  mode: "play" | "competition";
  holes: 9 | 18;
  lock: "competition" | null;
  createdAt: number;
  expiresAt: number;
  nextPlayer: number;
  players: Map<string, Player>;
  events: Map<string, ScoreEvent>;
  lastState: string;
}

export interface RelayOptions {
  secret: string;
  publicUrl: string;
  now?: () => number;
}

const HOUR = 3_600_000;
export const AWAY_MS = 60_000;
export const MAX_EVENTS = 2000;
export const MAX_LOBBIES = 1000;
export const CREATES_PER_MINUTE = 5;

export class Relay {
  private lobbies = new Map<string, Lobby>();
  private byCode = new Map<string, Lobby>();
  private bound = new Map<string, { lobby: Lobby; player: Player }>();
  private joinLog = new Map<string, number[]>();
  private createLog = new Map<string, number[]>();
  private counters = { rateLimited: 0, badMessages: 0, capped: 0, denied: 0 };
  private now: () => number;

  constructor(private opt: RelayOptions) {
    this.now = opt.now ?? Date.now;
  }

  stats() {
    return { lobbies: this.lobbies.size, connections: this.bound.size, ...this.counters };
  }

  isBound(connId: string): boolean {
    return this.bound.has(connId);
  }

  private limited(log: Map<string, number[]>, key: string, max: number): boolean {
    const t = this.now();
    const recent = (log.get(key) ?? []).filter((x) => t - x < 60_000);
    const hit = recent.length >= max;
    if (!hit) recent.push(t);
    log.set(key, recent);
    return hit;
  }

  eventCount(code: string): number {
    return this.byCode.get(code)?.events.size ?? 0;
  }

  private token(lobbyId: string): string {
    return createHmac("sha256", this.opt.secret).update(lobbyId).digest("hex");
  }

  private tokenOk(lobbyId: string, given: string): boolean {
    const a = Buffer.from(this.token(lobbyId));
    const b = Buffer.from(given);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private fail(conn: Conn, code: ErrorCode) {
    if (code === "RATE") this.counters.rateLimited++;
    else if (code === "BAD") this.counters.badMessages++;
    else if (code === "CAP") this.counters.capped++;
    else if (code === "DENIED") this.counters.denied++;
    conn.send({ t: "error", code });
  }

  private newCode(): string {
    for (;;) {
      let c = "";
      for (let i = 0; i < RULES.codeLength; i++) c += RULES.codeAlphabet[randomInt(RULES.codeAlphabet.length)];
      if (!this.byCode.has(c)) return c;
    }
  }

  private expired(l: Lobby) {
    return this.now() >= l.expiresAt;
  }

  private attach(conn: Conn, lobby: Lobby, player: Player) {
    const prev = this.bound.get(conn.id);
    if (prev && prev.player !== player) prev.player.conn = null;
    if (player.conn && player.conn.id !== conn.id) this.bound.delete(player.conn.id);
    this.bound.set(conn.id, { lobby, player });
    player.conn = conn;
    player.lastSeen = this.now();
  }

  private pstate(p: Player): "online" | "offline" | "away" {
    if (!p.conn) return "offline";
    return this.now() - p.lastSeen > AWAY_MS ? "away" : "online";
  }

  private stateMsg(l: Lobby): ServerMsg {
    const players = [...l.players.values()].filter((p) => p.approved).map((p) => ({ id: p.id, name: p.name, state: this.pstate(p) }));
    return { t: "state", players, lock: l.lock };
  }

  private broadcastState(l: Lobby) {
    const msg = this.stateMsg(l);
    l.lastState = JSON.stringify(msg);
    for (const p of l.players.values()) if (p.approved && p.conn) p.conn.send(msg);
  }

  handle(conn: Conn, msg: ClientMsg) {
    switch (msg.t) {
      case "create": return this.create(conn, msg);
      case "resume": return this.resume(conn, msg);
      case "join": return this.join(conn, msg);
      case "approve": return this.approve(conn, msg);
      case "events": return this.events(conn, msg);
      case "lock": return this.lock(conn, msg);
      case "ping": {
        const b = this.bound.get(conn.id);
        if (b) b.player.lastSeen = this.now();
        return;
      }
    }
  }

  private create(conn: Conn, msg: Extract<ClientMsg, { t: "create" }>) {
    if (this.limited(this.createLog, conn.address, CREATES_PER_MINUTE)) return this.fail(conn, "RATE");
    if (this.lobbies.size >= MAX_LOBBIES) return this.fail(conn, "CAP");
    const t = this.now();
    const lobby: Lobby = {
      id: randomBytes(6).toString("hex"),
      code: this.newCode(),
      mode: msg.mode,
      holes: msg.holes,
      lock: null,
      createdAt: t,
      expiresAt: t + RULES.expiryHours * HOUR,
      nextPlayer: 2,
      players: new Map(),
      events: new Map(),
      lastState: "",
    };
    const org: Player = { id: RULES.organiserId, name: msg.name, deviceId: `org:${randomBytes(8).toString("hex")}`, approved: true, conn: null, lastSeen: t };
    lobby.players.set(org.id, org);
    this.lobbies.set(lobby.id, lobby);
    this.byCode.set(lobby.code, lobby);
    this.attach(conn, lobby, org);
    conn.send({
      t: "created",
      lobbyId: lobby.id,
      code: lobby.code,
      inviteUrl: `${this.opt.publicUrl}/join/${lobby.code}`,
      expiresAt: lobby.expiresAt,
      organiserToken: this.token(lobby.id),
    });
    this.broadcastState(lobby);
  }

  private resume(conn: Conn, msg: Extract<ClientMsg, { t: "resume" }>) {
    if (!this.tokenOk(msg.lobbyId, msg.organiserToken)) return this.fail(conn, "DENIED");
    const t = this.now();
    let lobby = this.lobbies.get(msg.lobbyId);
    if (!lobby) {
      const s = msg.snapshot;
      if (s.expiresAt <= t) return this.fail(conn, "EXPIRED");
      const ids = new Set(s.players.map((p) => p.id));
      const devices = new Set(s.players.map((p) => p.deviceId));
      const valid = ids.size === s.players.length && devices.size === s.players.length && s.players.every((p) => /^p\d+$/.test(p.id)) && ids.has(RULES.organiserId);
      if (this.byCode.has(msg.code) || !valid) return this.fail(conn, "BAD");
      if (this.lobbies.size >= MAX_LOBBIES) return this.fail(conn, "CAP");
      const createdAt = Math.min(s.createdAt, t);
      lobby = {
        id: msg.lobbyId,
        code: msg.code,
        mode: s.mode,
        holes: s.holes,
        lock: s.lock,
        createdAt,
        expiresAt: Math.min(s.expiresAt, createdAt + RULES.expiryHours * HOUR),
        nextPlayer: 2,
        players: new Map(),
        events: new Map(),
        lastState: "",
      };
      for (const p of s.players) {
        const device = p.id === RULES.organiserId ? `org:${randomBytes(8).toString("hex")}` : p.deviceId;
        lobby.players.set(p.id, { id: p.id, name: p.name, deviceId: device, approved: p.approved, conn: null, lastSeen: t });
        const n = /^p(\d+)$/.exec(p.id);
        if (n) lobby.nextPlayer = Math.max(lobby.nextPlayer, Number(n[1]) + 1);
      }
      this.lobbies.set(lobby.id, lobby);
      this.byCode.set(lobby.code, lobby);
    } else if (lobby.code !== msg.code) return this.fail(conn, "BAD");
    if (this.expired(lobby)) return this.fail(conn, "EXPIRED");
    this.addEvents(lobby, msg.snapshot.events.filter((e) => lobby!.players.get(e.playerId)?.approved));
    this.attach(conn, lobby, lobby.players.get(RULES.organiserId)!);
    this.broadcastState(lobby);
  }

  private join(conn: Conn, msg: Extract<ClientMsg, { t: "join" }>) {
    const t = this.now();
    if (this.limited(this.joinLog, conn.address, RULES.joinAttemptsPerMinute)) return this.fail(conn, "RATE");
    const lobby = this.byCode.get(msg.code);
    if (!lobby) return this.fail(conn, "UNKNOWN_LOBBY");
    if (this.expired(lobby)) return this.fail(conn, "EXPIRED");
    const org = lobby.players.get(RULES.organiserId)!;
    let p = [...lobby.players.values()].find((x) => x.id !== RULES.organiserId && x.deviceId === msg.deviceId);
    if (p) {
      this.attach(conn, lobby, p);
      if (p.approved) {
        conn.send({ t: "approved", playerId: p.id });
        if (lobby.events.size) conn.send({ t: "events", batch: [...lobby.events.values()] });
        this.broadcastState(lobby);
      } else {
        conn.send({ t: "pending", playerId: p.id });
        org.conn?.send({ t: "pending", playerId: p.id, name: p.name, deviceId: p.deviceId });
      }
      return;
    }
    if (lobby.players.size >= RULES.maxPlayers) return this.fail(conn, "CAP");
    p = { id: `p${lobby.nextPlayer++}`, name: msg.name, deviceId: msg.deviceId, approved: false, conn: null, lastSeen: t };
    lobby.players.set(p.id, p);
    this.attach(conn, lobby, p);
    conn.send({ t: "pending", playerId: p.id });
    org.conn?.send({ t: "pending", playerId: p.id, name: p.name, deviceId: p.deviceId });
  }

  private organiser(conn: Conn) {
    const b = this.bound.get(conn.id);
    if (!b) {
      this.fail(conn, "UNKNOWN_LOBBY");
      return null;
    }
    if (b.player.id !== RULES.organiserId) {
      this.fail(conn, "DENIED");
      return null;
    }
    return b.lobby;
  }

  private approve(conn: Conn, msg: Extract<ClientMsg, { t: "approve" }>) {
    const lobby = this.organiser(conn);
    if (!lobby) return;
    const target = lobby.players.get(msg.playerId);
    if (!target || target.approved) return;
    if (msg.ok) {
      target.approved = true;
      target.conn?.send({ t: "approved", playerId: target.id });
      if (lobby.events.size) target.conn?.send({ t: "events", batch: [...lobby.events.values()] });
    } else {
      target.conn?.send({ t: "denied", playerId: target.id });
      if (target.conn) this.bound.delete(target.conn.id);
      lobby.players.delete(target.id);
    }
    this.broadcastState(lobby);
  }

  private addEvents(lobby: Lobby, batch: ScoreEvent[]): ScoreEvent[] | "CAP" {
    const fresh: ScoreEvent[] = [];
    for (const e of batch) {
      if (lobby.events.has(e.id)) continue;
      if (lobby.events.size >= MAX_EVENTS) return "CAP";
      lobby.events.set(e.id, e);
      fresh.push(e);
    }
    return fresh;
  }

  private events(conn: Conn, msg: Extract<ClientMsg, { t: "events" }>) {
    const b = this.bound.get(conn.id);
    if (!b) return this.fail(conn, "UNKNOWN_LOBBY");
    if (!b.player.approved) return this.fail(conn, "DENIED");
    if (this.expired(b.lobby)) return this.fail(conn, "EXPIRED");
    b.player.lastSeen = this.now();
    const known = msg.batch.filter((e) => b.lobby.players.get(e.playerId)?.approved);
    if (known.length < msg.batch.length) this.fail(conn, "BAD");
    const fresh = this.addEvents(b.lobby, known);
    if (fresh === "CAP") return this.fail(conn, "CAP");
    if (!fresh.length) return;
    for (const p of b.lobby.players.values()) if (p.approved && p.conn && p !== b.player) p.conn.send({ t: "events", batch: fresh });
  }

  private lock(conn: Conn, msg: Extract<ClientMsg, { t: "lock" }>) {
    const lobby = this.organiser(conn);
    if (!lobby) return;
    lobby.lock = msg.mode;
    this.broadcastState(lobby);
  }

  close(conn: Conn) {
    const b = this.bound.get(conn.id);
    if (!b) return;
    this.bound.delete(conn.id);
    if (b.player.conn?.id === conn.id) b.player.conn = null;
    this.broadcastState(b.lobby);
  }

  sweep() {
    const t = this.now();
    for (const l of [...this.lobbies.values()]) {
      if (t >= l.createdAt + RULES.deleteAfterHours * HOUR) {
        for (const p of l.players.values()) if (p.conn) this.bound.delete(p.conn.id);
        this.lobbies.delete(l.id);
        this.byCode.delete(l.code);
      } else if (JSON.stringify(this.stateMsg(l)) !== l.lastState) this.broadcastState(l);
    }
    for (const logs of [this.joinLog, this.createLog]) for (const [a, log] of logs) if (!log.some((x) => t - x < 60_000)) logs.delete(a);
  }
}
