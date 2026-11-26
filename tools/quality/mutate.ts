// NHR: small mutation test, breaks key logic one line at a time and checks the tests notice
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface Mutant {
  file: string;
  from: string;
  to: string;
  tests: string[];
  why: string;
}

export const mutants: Mutant[] = [
  { file: "engine/src/rules.ts", from: 'if (level === "request") return ask.requested === true;', to: 'if (level === "request") return true;', tests: ["engine/test/rules"], why: "request-only messages always allowed" },
  { file: "engine/src/rules.ts", from: 'if (mode === "competition" && !flags.distanceAllowed)', to: "if (false)", tests: ["engine/test/rules"], why: "devices-banned column ignored" },
  { file: "engine/src/rules.ts", from: 'club_chart: row("yes", "yes", "yes", "yes", "prior_rounds", "no")', to: 'club_chart: row("yes", "yes", "yes", "yes", "yes", "no")', tests: ["engine/test/rules"], why: "club chart open in Competition" },
  { file: "engine/src/hazards.ts", from: 'if (p < 0.1) return "low";', to: 'if (p <= 0.1) return "low";', tests: ["engine/test/hazards"], why: "band edge at 10%" },
  { file: "engine/src/hazards.ts", from: 'if (p <= 0.3) return "tight";', to: 'if (p < 0.3) return "tight";', tests: ["engine/test/hazards"], why: "band edge at 30%" },
  { file: "engine/src/hazards.ts", from: "sd * sd + gpsAccuracy * gpsAccuracy + geometryError * geometryError", to: "sd * sd + gpsAccuracy * gpsAccuracy - geometryError * geometryError", tests: ["engine/test/hazards"], why: "geometry error subtracted" },
  { file: "engine/src/hazards.ts", from: "return radius * RADIUS68_TO_SIGMA;", to: "return radius;", tests: ["engine/test/hazards"], why: "GPS radius not converted" },
  { file: "engine/src/twin.ts", from: "export const MAJORITY = 0.6;", to: "export const MAJORITY = 0.5;", tests: ["engine/test/twin"], why: "miss majority threshold" },
  { file: "engine/src/twin.ts", from: "export const MIN_VISITS = 3;", to: "export const MIN_VISITS = 2;", tests: ["engine/test/twin"], why: "visits needed for a tendency" },
  { file: "engine/src/load.ts", from: "export const WEIGHTS = { ignored: 35,", to: "export const WEIGHTS = { ignored: 30,", tests: ["engine/test/load"], why: "load weight changed" },
  { file: "engine/src/load.ts", from: 'if (score <= 60) return "brief";', to: 'if (score < 60) return "brief";', tests: ["engine/test/load"], why: "talk level edge at 60" },
  { file: "engine/src/guard.ts", from: "Math.abs(a - n) <= tolerance", to: "Math.abs(a - n) < tolerance", tests: ["engine/test/guard", "tools/fuzz"], why: "guard rejects exact matches" },
  { file: "engine/src/scoring.ts", from: "if (target && key(target) === key(e) && target.id !== e.id) hidden.add(target.id);", to: "if (target && target.id !== e.id) hidden.add(target.id);", tests: ["engine/test/scoring"], why: "correction can hide another player's score" },
  { file: "engine/src/priors.ts", from: "export const YARD = 0.9144;", to: "export const YARD = 0.9;", tests: ["engine/test/priors"], why: "yard length" },
  { file: "server/relay/src/relay.ts", from: "if (lobby.events.has(e.id)) continue;", to: "if (false) continue;", tests: ["server/relay/test/relay"], why: "events not deduped" },
  { file: "server/relay/src/relay.ts", from: "if (lobby.players.size >= RULES.maxPlayers) return this.fail(conn, \"CAP\");", to: "if (lobby.players.size > RULES.maxPlayers) return this.fail(conn, \"CAP\");", tests: ["server/relay/test/relay"], why: "player cap off by one" },
  { file: "server/relay/src/relay.ts", from: "return a.length === b.length && timingSafeEqual(a, b);", to: "return true;", tests: ["server/relay/test"], why: "organiser token not checked" },
  { file: "server/relay/src/relay.ts", from: "x.id !== RULES.organiserId && x.deviceId === msg.deviceId", to: "x.deviceId === msg.deviceId", tests: ["server/relay/test/security"], why: "organiser takeover by device id" },
  { file: "server/relay/src/relay.ts", from: "private expired(l: Lobby) {\n    return this.now() >= l.expiresAt;", to: "private expired(l: Lobby) {\n    return this.now() > l.expiresAt;", tests: ["server/relay/test"], why: "expiry boundary" },
  { file: "server/relay/src/relay.ts", from: "if (this.limited(this.createLog, conn.address, CREATES_PER_MINUTE)) return this.fail(conn, \"RATE\");", to: "", tests: ["server/relay/test/security"], why: "lobby creation not limited" },
  { file: "tools/pack/canonical.ts", from: "const { signature: _signature, ...rest } = pack;", to: "const rest = pack;", tests: ["tools/pack"], why: "signature included in signed bytes" },
  { file: "tools/pack/validate.ts", from: "if (area(z.polygon) < 1)", to: "if (area(z.polygon) < 0)", tests: ["tools/pack"], why: "zero-area hazards accepted" },
  { file: "contracts/src/relay.ts", from: "joinAttemptsPerMinute: 10,", to: "joinAttemptsPerMinute: 11,", tests: ["server/relay/test/relay"], why: "join rate limit" },
];

export function run(list = mutants) {
  const results: { m: Mutant; killed: boolean; note: string }[] = [];
  for (const m of list) {
    const original = readFileSync(m.file, "utf8");
    if (!original.includes(m.from)) {
      results.push({ m, killed: false, note: "pattern not found" });
      continue;
    }
    try {
      writeFileSync(m.file, original.replace(m.from, m.to));
      const r = spawnSync("npx", ["vitest", "run", ...m.tests], { encoding: "utf8", timeout: 120_000 });
      results.push({ m, killed: r.status !== 0, note: r.status !== 0 ? "killed" : "SURVIVED" });
    } finally {
      writeFileSync(m.file, original);
    }
  }
  return results;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const r = run();
  for (const x of r) console.log(`${x.note.padEnd(9)} ${x.m.file}  ${x.m.why}`);
  const killed = r.filter((x) => x.killed).length;
  console.log(`\nmutation score: ${killed}/${r.length} (${Math.round((100 * killed) / r.length)}%)`);
  process.exit(killed === r.length ? 0 : 1);
}
