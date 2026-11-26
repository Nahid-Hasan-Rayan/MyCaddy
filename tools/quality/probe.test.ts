// NHR: the abuse probe passes on this relay and catches a weak one
import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { probe } from "./probe";
import { startRelay } from "../../server/relay/src/server";

describe("relay abuse probe", () => {
  it("@C8 every check passes on this relay", async () => {
    const s = await startRelay({ secret: "s" });
    const r = await probe(s.url);
    await s.close();
    expect(r.filter((c) => !c.ok)).toEqual([]);
    expect(r.length).toBeGreaterThanOrEqual(8);
  }, 20_000);

  it("@C8 a relay with no limits and a guessable organiser device id fails the checks", async () => {
    const http = createServer();
    const wss = new WebSocketServer({ server: http });
    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        let m: any;
        try { m = JSON.parse(raw.toString()); } catch { return; }
        if (m.t === "create") ws.send(JSON.stringify({ t: "created", lobbyId: "l1", code: "AAAAAA", inviteUrl: "http://x", expiresAt: 1, organiserToken: "t" }));
        if (m.t === "join") ws.send(JSON.stringify({ t: "approved", playerId: "p2" }));
        if (m.t === "resume") ws.send(JSON.stringify({ t: "state", players: [], lock: null }));
      });
    });
    await new Promise<void>((ok) => http.listen(0, ok));
    const url = `ws://localhost:${(http.address() as any).port}`;
    const r = await probe(url);
    wss.close();
    http.close();
    const failed = r.filter((c) => !c.ok).map((c) => c.name);
    expect(failed).toContain("no device id guess is approved without the organiser");
    expect(failed).toContain("resume with a wrong token is refused");
    expect(failed).toContain("repeated lobby creation is limited");
    expect(failed).toContain("a burst of 300 messages is limited");
  }, 20_000);
});
