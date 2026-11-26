// NHR: score resolution and merge-order independence
import { describe, it, expect } from "vitest";
import { resolveScores, mergeEvents, totals, conflicts, type ScoreEv } from "../src/scoring";
import { rng } from "../../tools/fuzz/mockModel";

const e = (id: string, playerId: string, hole: number, strokes: number, ts: number, supersedes?: string, resolves?: string[]): ScoreEv => ({ id, playerId, hole, strokes, ts, kind: supersedes ? "correction" : "score", supersedes, resolves });
const final = (events: ScoreEv[]) => JSON.stringify([...resolveScores(events)].sort(([a], [b]) => (a < b ? -1 : 1)));

describe("score resolution", () => {
  it("@A97 a correction replaces the score and the history keeps both", () => {
    const r = resolveScores([e("a", "p1", 1, 4, 1), e("b", "p1", 1, 5, 2, "a")]);
    expect(r.get("p1:1")).toMatchObject({ strokes: 5, eventId: "b", history: ["a", "b"] });
  });

  it("@A97 a chain of corrections ends at the last one", () => {
    const r = resolveScores([e("a", "p1", 1, 4, 1), e("c", "p1", 1, 6, 3, "b"), e("b", "p1", 1, 5, 2, "a")]);
    expect(r.get("p1:1")!.strokes).toBe(6);
  });

  it("@A97 two corrections of the same score: the later one wins, ties break by id", () => {
    expect(resolveScores([e("a", "p1", 1, 4, 1), e("b", "p1", 1, 5, 5, "a"), e("c", "p1", 1, 6, 6, "a")]).get("p1:1")!.strokes).toBe(6);
    expect(resolveScores([e("a", "p1", 1, 4, 1), e("b", "p1", 1, 5, 5, "a"), e("c", "p1", 1, 6, 5, "a")]).get("p1:1")!.strokes).toBe(6);
  });

  it("@A97 a correction whose target has not arrived still stands, then replaces it when it does", () => {
    expect(resolveScores([e("b", "p1", 1, 5, 2, "a")]).get("p1:1")!.strokes).toBe(5);
    expect(resolveScores([e("b", "p1", 1, 5, 2, "a"), e("a", "p1", 1, 4, 1)]).get("p1:1")!.strokes).toBe(5);
  });

  it("@A97 a correction cannot reach a different player or hole", () => {
    const r = resolveScores([e("a", "p1", 1, 4, 1), e("x", "p2", 1, 9, 2, "a")]);
    expect(r.get("p1:1")!.strokes).toBe(4);
    expect(r.get("p2:1")!.strokes).toBe(9);
  });

  it("@A97 a correction for another player cannot hide a competing score", () => {
    const r = resolveScores([e("a", "p1", 1, 4, 1), e("b", "p1", 1, 6, 2), e("x", "p2", 1, 7, 3, "b")]);
    expect(r.get("p1:1")!.strokes).toBe(6);
  });

  it("@A97 a loop of corrections still gives one stable answer", () => {
    const a = [e("a", "p1", 1, 4, 1, "b"), e("b", "p1", 1, 5, 2, "a")];
    expect(final(a)).toBe(final([...a].reverse()));
  });

  it("@A97 totals add the final score of each hole", () => {
    const t = totals(resolveScores([e("a", "p1", 1, 4, 1), e("b", "p1", 2, 5, 2), e("c", "p1", 2, 6, 3, "b"), e("d", "p2", 1, 3, 1)]));
    expect(t.get("p1")).toBe(10);
    expect(t.get("p2")).toBe(3);
  });

  it("@A97 the same id with different content resolves the same way in any order", () => {
    const x = e("a", "p1", 1, 4, 1);
    const y = { ...x, strokes: 7 };
    expect(final([x, y])).toBe(final([y, x]));
    expect(mergeEvents([x], [y])).toEqual(mergeEvents([y], [x]));
  });
});

describe("conflicts", () => {
  const two = [e("a", "p1", 1, 4, 1), e("b", "p1", 1, 5, 2)];

  it("@A97 two competing scores for one hole are listed as a conflict", () => {
    const c = conflicts(two);
    expect(c).toHaveLength(1);
    expect(c[0]!.heads.map((h) => h.id)).toEqual(["a", "b"]);
  });

  it("@A97 one correction can resolve both competing scores", () => {
    const fixed = [...two, e("c", "p1", 1, 4, 3, "a", ["b"])];
    expect(conflicts(fixed)).toEqual([]);
    expect(resolveScores(fixed).get("p1:1")).toMatchObject({ strokes: 4, eventId: "c" });
  });

  it("@A97 a resolving correction does nothing to other players or holes", () => {
    const r = resolveScores([...two, e("x", "p2", 1, 7, 1), e("c", "p1", 1, 4, 3, "a", ["b", "x"])]);
    expect(r.get("p2:1")!.strokes).toBe(7);
  });

  it("@A97 a normal round has no conflicts", () => {
    expect(conflicts([e("a", "p1", 1, 4, 1), e("b", "p1", 1, 5, 2, "a"), e("c", "p2", 1, 3, 1)])).toEqual([]);
  });
});

describe("merge order", () => {
  const r = rng(97);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const events: ScoreEv[] = [];
  let n = 0;
  for (const p of ["p1", "p2", "p3", "p4"])
    for (let hole = 1; hole <= 9; hole++) {
      let prev = `e${n++}`;
      events.push(e(prev, p, hole, 3 + Math.floor(r() * 4), n));
      const fixes = Math.floor(r() * 3);
      for (let k = 0; k < fixes; k++) {
        const id = `e${n++}`;
        events.push(e(id, p, hole, 2 + Math.floor(r() * 6), n + 100, r() < 0.3 ? `e${Math.max(0, n - 5)}` : prev, r() < 0.25 ? [`e${Math.max(0, n - 3)}`, `e${Math.max(0, n - 2)}`] : undefined));
        if (r() < 0.7) prev = id;
      }
    }
  const shuffle = <T,>(a: T[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [b[i], b[j]] = [b[j]!, b[i]!];
    }
    return b;
  };
  const baseline = final(events);

  it("@A97 1,000 random merge orders with duplicates and splits give the same result", () => {
    for (let i = 0; i < 1000; i++) {
      const order = shuffle(events);
      const cut1 = Math.floor(r() * order.length);
      const cut2 = Math.floor(r() * order.length);
      const dup = Array.from({ length: Math.floor(r() * 20) }, () => pick(events));
      const replicaA = mergeEvents(order.slice(0, cut1), dup);
      const replicaB = mergeEvents(order.slice(cut2), shuffle(dup));
      const merged = mergeEvents(i % 2 ? replicaA : replicaB, i % 2 ? replicaB : replicaA, order);
      expect(final(merged)).toBe(baseline);
    }
  });

  it("@A97 merging is idempotent and commutative", () => {
    const half = events.slice(0, 50);
    const rest = events.slice(30);
    expect(mergeEvents(half, rest)).toEqual(mergeEvents(rest, half));
    expect(mergeEvents(events, events)).toEqual(mergeEvents(events));
  });
});
