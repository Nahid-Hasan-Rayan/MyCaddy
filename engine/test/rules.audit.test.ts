// NHR: policy audit over every type, mode, flag and ask
import { describe, it, expect } from "vitest";
import { MESSAGE_TYPES, MODES, isAllowed, ALWAYS_ON, type Ask } from "../src/rules";

const asks: Ask[] = [{}, { requested: true }, { madeBeforeRound: true }, { priorRoundsOnly: true }, { requested: true, madeBeforeRound: true, priorRoundsOnly: true }];
const flagSet = [{ distanceAllowed: true }, { distanceAllowed: false }];

describe("policy audit", () => {
  it("@C6 competition never leaks advice, insight or debrief", () => {
    const blocked = ["club_advice", "hazard_warning", "tee_insight", "twin_insight", "debrief"] as const;
    let leaks = 0;
    for (const t of blocked)
      for (const f of flagSet)
        for (const a of asks) if (isAllowed(t, "competition", f, a)) leaks++;
    expect(leaks).toBe(0);
  });

  it("@C6 devices banned blocks everything except safety and scoring", () => {
    let leaks = 0;
    for (const t of MESSAGE_TYPES) {
      if (ALWAYS_ON.includes(t)) continue;
      for (const a of asks) if (isAllowed(t, "competition", { distanceAllowed: false }, a)) leaks++;
    }
    expect(leaks).toBe(0);
  });

  it("@C6 safety and scoring are allowed in every mode and flag", () => {
    for (const t of ALWAYS_ON)
      for (const m of MODES)
        for (const f of flagSet)
          for (const a of asks) expect(isAllowed(t, m, f, a)).toBe(true);
  });

  it("@C6 the distance flag changes nothing outside competition", () => {
    for (const t of MESSAGE_TYPES)
      for (const m of MODES) {
        if (m === "competition") continue;
        for (const a of asks)
          expect(isAllowed(t, m, { distanceAllowed: true }, a)).toBe(isAllowed(t, m, { distanceAllowed: false }, a));
      }
  });

  it("@C6 asking never unlocks a blocked cell", () => {
    for (const t of MESSAGE_TYPES)
      for (const m of MODES)
        for (const f of flagSet)
          if (!isAllowed(t, m, f, { requested: true, madeBeforeRound: true, priorRoundsOnly: true }))
            for (const a of asks) expect(isAllowed(t, m, f, a)).toBe(false);
  });
});
