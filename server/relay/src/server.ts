// NHR: http and websocket wrapper around the relay
import { createServer, type IncomingMessage } from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { parseClient } from "../../../contracts/src";
import { Relay } from "./relay";

export interface StartOptions {
  port?: number;
  secret: string;
  publicUrl?: string;
  now?: () => number;
  allowedOrigins?: string[];
  maxPerAddress?: number;
  maxConnections?: number;
  bindTimeoutMs?: number;
}

const BURST = 30;
const REFILL = 2;
export const MAX_MESSAGE = 64 * 1024;

function addressOf(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

export async function startRelay(opt: StartOptions) {
  const started = Date.now();
  const server = { originDenied: 0, limitRefused: 0, floods: 0, bindTimeouts: 0 };
  const perAddress = new Map<string, number>();
  const allowed = opt.allowedOrigins ?? [];
  const maxPer = opt.maxPerAddress ?? 20;
  const maxAll = opt.maxConnections ?? 2000;
  let open = 0;
  let relayRef: Relay | undefined;
  const http = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, uptime: Math.round((Date.now() - started) / 1000), ...relayRef?.stats(), ...server }));
    } else if (req.url?.startsWith("/join/")) {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("Open MyCaddy to join this lobby.");
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  const wss = new WebSocketServer({
    server: http,
    maxPayload: MAX_MESSAGE,
    verifyClient: (info, done) => {
      const origin = info.origin || info.req.headers.origin;
      if (origin && !allowed.includes(origin)) {
        server.originDenied++;
        return done(false, 403, "origin not allowed");
      }
      if (open >= maxAll || (perAddress.get(addressOf(info.req)) ?? 0) >= maxPer) {
        server.limitRefused++;
        return done(false, 429, "too many connections");
      }
      done(true);
    },
  });
  await new Promise<void>((ok) => http.listen(opt.port ?? 0, ok));
  const port = (http.address() as { port: number }).port;
  const relay = new Relay({ secret: opt.secret, publicUrl: opt.publicUrl ?? `http://localhost:${port}`, now: opt.now });
  relayRef = relay;

  const alive = new WeakMap<WebSocket, boolean>();
  wss.on("connection", (ws, req) => {
    const conn = {
      id: randomBytes(6).toString("hex"),
      address: addressOf(req),
      send: (m: unknown) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m)),
    };
    alive.set(ws, true);
    open++;
    perAddress.set(conn.address, (perAddress.get(conn.address) ?? 0) + 1);
    const bind = setTimeout(() => {
      if (!relay.isBound(conn.id)) {
        server.bindTimeouts++;
        ws.terminate();
      }
    }, opt.bindTimeoutMs ?? 10_000);
    bind.unref();
    let tokens = BURST;
    let stamp = Date.now();
    let refused = 0;
    ws.on("pong", () => alive.set(ws, true));
    ws.on("message", (raw) => {
      const t = Date.now();
      tokens = Math.min(BURST, tokens + ((t - stamp) / 1000) * REFILL);
      stamp = t;
      if (tokens < 1) {
        conn.send({ t: "error", code: "RATE" });
        if (++refused > 20) {
          server.floods++;
          ws.terminate();
        }
        return;
      }
      tokens -= 1;
      const r = parseClient(raw.toString());
      if (!r.ok) return conn.send({ t: "error", code: "BAD" });
      try {
        relay.handle(conn as never, r.msg);
      } catch {
        conn.send({ t: "error", code: "BAD" });
      }
    });
    ws.on("close", () => {
      clearTimeout(bind);
      open--;
      const left = (perAddress.get(conn.address) ?? 1) - 1;
      if (left <= 0) perAddress.delete(conn.address);
      else perAddress.set(conn.address, left);
      relay.close(conn as never);
    });
    ws.on("error", () => { if (ws.readyState === ws.OPEN) ws.terminate(); });
  });

  const beat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) ws.terminate();
      else {
        alive.set(ws, false);
        ws.ping();
      }
    }
  }, 25_000);
  const sweep = setInterval(() => relay.sweep(), 30_000);
  beat.unref();
  sweep.unref();

  return {
    port,
    url: `ws://localhost:${port}`,
    relay,
    close: () =>
      new Promise<void>((ok) => {
        clearInterval(beat);
        clearInterval(sweep);
        for (const ws of wss.clients) ws.terminate();
        wss.close(() => http.close(() => ok()));
      }),
  };
}