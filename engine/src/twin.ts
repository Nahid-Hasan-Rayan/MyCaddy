// NHR: player twin: club shrinkage, hole miss tendency, drift flag (R4)
export type Quality = "starter" | "learning" | "reliable";
export type Miss = "left" | "right" | "short" | "long";
export type Visit = Miss | "ok";

export interface Prior {
  mean: number;
  sd: number;
  strength: number;
}

export interface ClubTwin {
  mean: number;
  sd: number;
  count: number;
  quality: Quality;
}

export const LEARNING_AT = 5;
export const RELIABLE_AT = 15;
export const MIN_VISITS = 3;
export const MAJORITY = 0.6;
export const RECENT = 5;
export const DRIFT_SD = 1;

export function quality(n: number): Quality {
  if (n >= RELIABLE_AT) return "reliable";
  if (n >= LEARNING_AT) return "learning";
  return "starter";
}

export function twinClub(shots: number[], prior: Prior): ClubTwin {
  const n = shots.length;
  if (n === 0) return { mean: prior.mean, sd: prior.sd, count: 0, quality: quality(0) };
  const xbar = shots.reduce((a, b) => a + b, 0) / n;
  const ss = shots.reduce((a, b) => a + (b - xbar) ** 2, 0);
  const k = prior.strength;
  const mean = (k * prior.mean + n * xbar) / (k + n);
  const variance = (k * prior.sd ** 2 + ss) / (k + n - 1);
  return { mean, sd: Math.sqrt(variance), count: n, quality: quality(n) };
}

export function missTendency(visits: Visit[]): Miss | null {
  if (visits.length < MIN_VISITS) return null;
  const counts: Record<Miss, number> = { left: 0, right: 0, short: 0, long: 0 };
  for (const v of visits) if (v !== "ok") counts[v]++;
  let best: Miss | null = null;
  for (const m of Object.keys(counts) as Miss[]) if (best === null || counts[m] > counts[best]) best = m;
  if (best === null || counts[best] / visits.length < MAJORITY) return null;
  return best;
}

export function drift(shots: number[]): { flag: boolean; delta: number } {
  if (shots.length < RECENT + 3) return { flag: false, delta: 0 };
  const earlier = shots.slice(0, -RECENT);
  const recent = shots.slice(-RECENT);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const m = avg(earlier);
  const sd = Math.max(1, Math.sqrt(earlier.reduce((a, b) => a + (b - m) ** 2, 0) / (earlier.length - 1)));
  const delta = avg(recent) - m;
  return { flag: Math.abs(delta) > DRIFT_SD * sd, delta };
}
