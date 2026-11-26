// NHR: rules matrix cells and banned inputs
import { describe, it, expect } from "vitest";
import { isAllowed, levelFor, column, needsWhy, isBannedInput, MATRIX, MESSAGE_TYPES } from "../src/rules";

const on = { distanceAllowed: true };
const off = { distanceAllowed: false };

describe("rules matrix", () => {
  it("@R2 every message type has a full row", () => {
    for (const t of MESSAGE_TYPES) expect(Object.keys(MATRIX[t])).toHaveLength(6);
  });

  it("@R2 relax gives distance and club advice only on request", () => {
    expect(isAllowed("distance", "relax", on)).toBe(false);
    expect(isAllowed("distance", "relax", on, { requested: true })).toBe(true);
    expect(isAllowed("club_advice", "relax", on, { requested: true })).toBe(true);
    expect(isAllowed("tee_insight", "relax", on, { requested: true })).toBe(false);
  });

  it("@R2 competition keeps distance but drops advice and warnings", () => {
    expect(isAllowed("distance", "competition", on)).toBe(true);
    expect(isAllowed("hazard_distance", "competition", on)).toBe(true);
    expect(isAllowed("club_advice", "competition", on)).toBe(false);
    expect(isAllowed("hazard_warning", "competition", on)).toBe(false);
    expect(isAllowed("tee_insight", "competition", on)).toBe(false);
  });

  it("@R2 devices banned switches the competition column", () => {
    expect(column("competition", off)).toBe("competition_banned");
    expect(column("play", off)).toBe("play");
    expect(isAllowed("distance", "competition", off)).toBe(false);
    expect(isAllowed("safety_alert", "competition", off)).toBe(true);
    expect(isAllowed("scoring", "competition", off)).toBe(true);
  });

  it("@R2 game plan in competition needs to be made before the round", () => {
    expect(levelFor("game_plan", "competition", on)).toBe("before_round");
    expect(isAllowed("game_plan", "competition", on)).toBe(false);
    expect(isAllowed("game_plan", "competition", on, { madeBeforeRound: true })).toBe(true);
    expect(isAllowed("game_plan", "competition", off, { madeBeforeRound: true })).toBe(false);
  });

  it("@R2 a club distance chart is allowed in competition only when built from prior rounds", () => {
    expect(isAllowed("club_chart", "competition", on)).toBe(false);
    expect(isAllowed("club_chart", "competition", on, { priorRoundsOnly: true })).toBe(true);
    expect(isAllowed("club_chart", "competition", off, { priorRoundsOnly: true })).toBe(false);
    expect(isAllowed("club_chart", "play", on)).toBe(true);
  });

  it("@R2 learn explains club advice", () => {
    expect(needsWhy("club_advice", "learn")).toBe(true);
    expect(needsWhy("club_advice", "play")).toBe(false);
    expect(needsWhy("distance", "learn")).toBe(false);
  });

  it("@R2 banned inputs are caught in any spelling", () => {
    for (const n of ["elevation", "Slope", "plays like", "plays-like", "heart_rate", "Heart Rate", "mental_state"])
      expect(isBannedInput(n)).toBe(true);
    expect(isBannedInput("distance")).toBe(false);
  });
});
