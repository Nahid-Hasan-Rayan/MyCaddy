// NHR: black-box abuse probe for any relay that speaks the v1 contract
import WebSocket from "ws";
import { fileURLToPath } from "node:url";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

interface Session {
  ws: WebSocket;
  msgs: any[];
  closed: boolean;
  code: number;
  send(m: unknown): void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function open(url: string, headers: Record<string, string> = {}): Promise<Session> {
  return new Promise((ok, bad) => {
    const ws = new WebSocket(url, { headers });
    const s: Session = { ws, msgs: [], closed: false, code: 0, send: (m) => ws.send(typeof m === "string" ? m : JSON.stringify(m)) };
    ws.on("message", (d) => {
      try {
        s.msgs.push(JSON.parse(d.toString()));
      } catch {
        s.msgs.push({ t: "garbage" });
      }
    });
    ws.on("close", (c) => ((s.closed = true), (s.code = c)));
    ws.once("open", () => ok(s));
    ws.once("unexpected-response", (_r, res) => bad(new Error(`http ${res.statusCode}`)));
    ws.once("error", bad);
  });
}

const errors = (s: Session) => s.msgs.filter((m) => m.t === "error").map((m) => m.code);

export async function probe(url: string, headersOk: Record<string, string> = {}): Promise<Check[]> {
  const out: Check[] = [];
  const add = (name: string, ok: boolean, detail = "") => out.push({ name, ok, detail });

  const a = await open(url, headersOk);
  a.send("{nope");
  a.send({ t: "kick" });
  await wait(200);
  add("bad json and unknown messages get BAD", errors(a).filter((c) => c === "BAD").length >= 2, `errors: ${errors(a).join(",")}`);

  a.send({ t: "create", name: "Probe", mode: "play", holes: 9 });
  await wait(300);
  const created = a.msgs.find((m) => m.t === "created");
  add("a lobby can be created", !!created);
  if (created) {
    const guesses = ["organiser", "organizer", "org", "admin", "host", "owner", "p1", "null", "undefined", "0"];
    let leaked = "";
    for (let i = 0; i < guesses.length; i++) {
      const b = await open(url, headersOk);
      b.send({ t: "join", code: created.code, name: "Guess", deviceId: guesses[i] });
      await wait(120);
      if (b.msgs.some((m) => m.t === "approved")) leaked = guesses[i]!;
      b.ws.terminate();
    }
    add("no device id guess is approved without the organiser", leaked === "", leaked ? `approved with "${leaked}"` : "");

    const c = await open(url, headersOk);
    c.send({ t: "resume", lobbyId: created.lobbyId, code: created.code, organiserToken: "0".repeat(64), snapshot: { mode: "play", holes: 9, lock: null, createdAt: Date.now(), expiresAt: Date.now() + 1e6, players: [{ id: "p1", name: "X", deviceId: "d", approved: true }], events: [] } });
    await wait(200);
    add("resume with a wrong token is refused", errors(c).length > 0 && !c.msgs.some((m) => m.t === "state"), `got: ${c.msgs.map((m) => m.t).join(",")}`);
    c.ws.terminate();
  }

  const big = await open(url, headersOk);
  big.send("x".repeat(70 * 1024));
  await wait(300);
  add("a 70 KB message is refused or the socket is closed", big.closed || errors(big).length > 0, big.closed ? `closed ${big.code}` : errors(big).join(","));

  const flood = await open(url, headersOk);
  for (let i = 0; i < 300; i++) flood.send({ t: "ping" });
  await wait(400);
  add("a burst of 300 messages is limited", flood.closed || errors(flood).includes("RATE"), flood.closed ? "closed" : errors(flood).slice(0, 2).join(","));

  const maker = await open(url, headersOk);
  for (let i = 0; i < 20; i++) maker.send({ t: "create", name: "Flood", mode: "play", holes: 9 });
  await wait(400);
  add("repeated lobby creation is limited", errors(maker).some((c) => c === "RATE" || c === "CAP") || maker.closed, `errors: ${[...new Set(errors(maker))].join(",")}`);

  let refused = false;
  try {
    const o = await open(url, { Origin: "https://evil.example" });
    o.ws.terminate();
  } catch {
    refused = true;
  }
  add("a browser origin that is not listed is refused", refused);

  for (const s of [a, big, flood, maker]) s.ws.terminate();
  return out;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.argv[2];
  if (!url) {
    console.error("usage: npx tsx tools/quality/probe.ts wss://your-relay");
    process.exit(2);
  }
  probe(url).then((r) => {
    for (const c of r) console.log(`${c.ok ? "pass" : "FAIL"}  ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
    process.exit(r.every((c) => c.ok) ? 0 : 1);
  });
}
