// NHR: behaviour-only cognitive load score and talk level (R4)
export interface LoadInput {
  ignoredRecent: number;
  quietRequests: number;
  recentHoles: number;
  secsSinceStroke: number;
  gateBlocksMessages?: boolean;
}

export type TalkLevel = "full" | "brief" | "silent" | "inactive";

export const WEIGHTS = { ignored: 35, quiet: 30, pace: 20, stroke: 15 };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function loadScore(i: LoadInput): number | null {
  if (i.gateBlocksMessages) return null;
  const ignored = clamp01(i.ignoredRecent / 3);
  const quiet = clamp01(i.quietRequests / 2);
  const pace = clamp01((i.recentHoles - 3) / 2);
  const stroke = clamp01((90 - i.secsSinceStroke) / 70);
  const raw = WEIGHTS.ignored * ignored + WEIGHTS.quiet * quiet + WEIGHTS.pace * pace + WEIGHTS.stroke * stroke;
  return Math.round(raw);
}

export function talkLevel(score: number | null): TalkLevel {
  if (score === null) return "inactive";
  if (score < 30) return "full";
  if (score <= 60) return "brief";
  return "silent";
}

export interface SpeakContext {
  strokeInProgress: boolean;
  asked: boolean;
  safety?: boolean;
}

export function canSpeak(level: TalkLevel, ctx: SpeakContext): boolean {
  if (ctx.strokeInProgress) return false;
  if (ctx.safety) return true;
  if (level === "silent") return ctx.asked;
  return true;
}
