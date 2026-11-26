// NHR: rules matrix (R2) as data, plus the always-banned inputs
export const MODES = ["play", "learn", "relax", "practice", "competition"] as const;
export type Mode = (typeof MODES)[number];

export const MESSAGE_TYPES = [
  "distance",
  "hazard_distance",
  "club_advice",
  "hazard_warning",
  "tee_insight",
  "twin_insight",
  "game_plan",
  "debrief",
  "club_chart",
  "safety_alert",
  "scoring",
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export type Level = "yes" | "request" | "no" | "before_round" | "prior_rounds";
export type Column = Mode | "competition_banned";

export interface Flags {
  distanceAllowed: boolean;
}

export interface Ask {
  requested?: boolean;
  madeBeforeRound?: boolean;
  priorRoundsOnly?: boolean;
}

type Row = Record<Column, Level>;

const row = (play: Level, learn: Level, relax: Level, practice: Level, competition: Level, banned: Level): Row => ({
  play,
  learn,
  relax,
  practice,
  competition,
  competition_banned: banned,
});

export const MATRIX: Record<MessageType, Row> = {
  distance: row("yes", "yes", "request", "yes", "yes", "no"),
  hazard_distance: row("yes", "yes", "request", "yes", "yes", "no"),
  club_advice: row("yes", "yes", "request", "yes", "no", "no"),
  hazard_warning: row("yes", "yes", "request", "yes", "no", "no"),
  tee_insight: row("yes", "yes", "no", "yes", "no", "no"),
  twin_insight: row("yes", "yes", "no", "yes", "no", "no"),
  game_plan: row("yes", "yes", "yes", "yes", "before_round", "no"),
  debrief: row("yes", "yes", "yes", "yes", "no", "no"),
  club_chart: row("yes", "yes", "yes", "yes", "prior_rounds", "no"),
  safety_alert: row("yes", "yes", "yes", "yes", "yes", "yes"),
  scoring: row("yes", "yes", "yes", "yes", "yes", "yes"),
};

export const ALWAYS_ON: MessageType[] = ["safety_alert", "scoring"];
export const LEARN_WITH_WHY: MessageType[] = ["club_advice"];

export const BANNED_INPUTS = ["elevation", "slope", "plays_like", "heart_rate", "mental_state"] as const;

export function isBannedInput(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (BANNED_INPUTS as readonly string[]).includes(n);
}

export function column(mode: Mode, flags: Flags): Column {
  if (mode === "competition" && !flags.distanceAllowed) return "competition_banned";
  return mode;
}

export function levelFor(type: MessageType, mode: Mode, flags: Flags): Level {
  return MATRIX[type][column(mode, flags)];
}

export function isAllowed(type: MessageType, mode: Mode, flags: Flags, ask: Ask = {}): boolean {
  const level = levelFor(type, mode, flags);
  if (level === "yes") return true;
  if (level === "request") return ask.requested === true;
  if (level === "before_round") return ask.madeBeforeRound === true;
  if (level === "prior_rounds") return ask.priorRoundsOnly === true;
  return false;
}

export function needsWhy(type: MessageType, mode: Mode): boolean {
  return mode === "learn" && LEARN_WITH_WHY.includes(type);
}
