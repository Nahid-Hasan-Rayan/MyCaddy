// NHR: resolve score events into final scores, same result for any arrival order
export interface ScoreEv {
  id: string;
  playerId: string;
  hole: number;
  strokes: number;
  ts: number;
  kind: "score" | "correction";
  supersedes?: string;
  resolves?: string[];
}

export interface Resolved {
  playerId: string;
  hole: number;
  strokes: number;
  eventId: string;
  history: string[];
}

const key = (e: ScoreEv) => `${e.playerId}:${e.hole}`;
const order = (a: ScoreEv, b: ScoreEv) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const same = (a: ScoreEv, b: ScoreEv) => JSON.stringify(a) <= JSON.stringify(b);

export function mergeEvents(...sets: ScoreEv[][]): ScoreEv[] {
  const byId = new Map<string, ScoreEv>();
  for (const e of sets.flat()) {
    const have = byId.get(e.id);
    if (!have || (have !== e && !same(have, e))) byId.set(e.id, have && same(have, e) ? have : e);
  }
  return [...byId.values()].sort(order);
}

interface Group {
  list: ScoreEv[];
  heads: ScoreEv[];
  pick: ScoreEv;
}

function grouped(events: ScoreEv[]): Map<string, Group> {
  const all = mergeEvents(events);
  const byId = new Map(all.map((e) => [e.id, e]));
  const hidden = new Set<string>();
  for (const e of all) {
    if (e.kind !== "correction") continue;
    for (const id of [e.supersedes, ...(e.resolves ?? [])]) {
      const target = id ? byId.get(id) : undefined;
      if (target && key(target) === key(e) && target.id !== e.id) hidden.add(target.id);
    }
  }
  const groups = new Map<string, ScoreEv[]>();
  for (const e of all) groups.set(key(e), [...(groups.get(key(e)) ?? []), e]);
  const out = new Map<string, Group>();
  for (const [k, list] of groups) {
    const heads = list.filter((e) => !hidden.has(e.id));
    const pick = (heads.length ? heads : list).reduce((a, b) => (order(a, b) >= 0 ? a : b));
    out.set(k, { list, heads: heads.length ? heads : [pick], pick });
  }
  return out;
}

export function resolveScores(events: ScoreEv[]): Map<string, Resolved> {
  const out = new Map<string, Resolved>();
  for (const [k, g] of grouped(events)) out.set(k, { playerId: g.pick.playerId, hole: g.pick.hole, strokes: g.pick.strokes, eventId: g.pick.id, history: g.list.map((e) => e.id) });
  return out;
}

export interface Conflict {
  playerId: string;
  hole: number;
  heads: ScoreEv[];
}

export function conflicts(events: ScoreEv[]): Conflict[] {
  const out: Conflict[] = [];
  for (const g of grouped(events).values()) if (g.heads.length > 1) out.push({ playerId: g.pick.playerId, hole: g.pick.hole, heads: g.heads });
  return out;
}

export function totals(resolved: Map<string, Resolved>): Map<string, number> {
  const t = new Map<string, number>();
  for (const r of resolved.values()) t.set(r.playerId, (t.get(r.playerId) ?? 0) + r.strokes);
  return t;
}
