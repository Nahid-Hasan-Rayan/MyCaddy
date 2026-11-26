// NHR: end-to-end lobby on real websockets, including a relay restart
import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { fourPhones } from "../sim/fourPhones";
import { startRelay } from "../src/server";

describe("relay over real websockets", () => {
  it("@Q3 @F3 four phones, one drop and rejoin, one relay restart, 0 lost events", async () => {
    const r = await fourPhones();
    expect(r.lost).toBe(0);
    expect(r.perPhone).toEqual([12, 12, 12, 12]);
    expect(r.relayEvents).toBe(12);
  }, 20_000);

  it("@R1 bad json and bad messages get BAD, health check answers", async () => {
    const s = await startRelay({ secret: "s" });
    const ws = new WebSocket(s.url);
    await new Promise((ok) => ws.once("open", ok));
    const got: any[] = [];
    ws.on("message", (m) => got.push(JSON.parse(m.toString())));
    ws.send("{nope");
    ws.send(JSON.stringify({ t: "kick" }));
    ws.send(JSON.stringify({ t: "create", name: "X", mode: "play", holes: 18, admin: true }));
    await new Promise((r) => setTimeout(r, 100));
    expect(got.filter((m) => m.t === "error").map((m) => m.code)).toEqual(["BAD", "BAD"]);
    expect(got.some((m) => m.t === "created")).toBe(true);
    const res = await fetch(`http://localhost:${s.port}/health`);
    expect(await res.json()).toMatchObject({ ok: true, lobbies: 1 });
    ws.close();
    await s.close();
  });

  it("@R1 a socket that floods messages gets RATE and is dropped", async () => {
    const s = await startRelay({ secret: "s" });
    const ws = new WebSocket(s.url);
    await new Promise((ok) => ws.once("open", ok));
    const codes: string[] = [];
    let closed = false;
    ws.on("message", (m) => codes.push(JSON.parse(m.toString()).code));
    ws.on("close", () => (closed = true));
    for (let i = 0; i < 400; i++) ws.send(JSON.stringify({ t: "ping" }));
    await new Promise((r) => setTimeout(r, 300));
    expect(codes).toContain("RATE");
    expect(closed).toBe(true);
    await s.close();
  });
});
