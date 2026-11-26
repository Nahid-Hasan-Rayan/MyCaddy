// NHR: load score, talk level and speech guard
import { describe, it, expect } from "vitest";
import { loadScore, talkLevel, canSpeak } from "../src/load";

const calm = { ignoredRecent: 0, quietRequests: 0, recentHoles: 2, secsSinceStroke: 300 };

describe("load score", () => {
  it("@R4 calm round scores zero", () => {
    expect(loadScore(calm)).toBe(0);
  });

  it("@R4 every signal pushes the score up", () => {
    const base = loadScore(calm)!;
    expect(loadScore({ ...calm, ignoredRecent: 2 })!).toBeGreaterThan(base);
    expect(loadScore({ ...calm, quietRequests: 1 })!).toBeGreaterThan(base);
    expect(loadScore({ ...calm, recentHoles: 5 })!).toBeGreaterThan(base);
    expect(loadScore({ ...calm, secsSinceStroke: 10 })!).toBeGreaterThan(base);
  });

  it("@R4 score stays between 0 and 100", () => {
    const max = loadScore({ ignoredRecent: 99, quietRequests: 99, recentHoles: 99, secsSinceStroke: 0 })!;
    expect(max).toBe(100);
  });

  it("@R4 inactive when the gate blocks messages", () => {
    expect(loadScore({ ...calm, ignoredRecent: 3, gateBlocksMessages: true })).toBeNull();
    expect(talkLevel(null)).toBe("inactive");
  });
});

describe("talk level", () => {
  it("@R4 uses the 30 and 60 edges", () => {
    expect(talkLevel(29)).toBe("full");
    expect(talkLevel(30)).toBe("brief");
    expect(talkLevel(60)).toBe("brief");
    expect(talkLevel(61)).toBe("silent");
  });
});

describe("speech guard", () => {
  it("@R4 never speaks during a stroke", () => {
    expect(canSpeak("full", { strokeInProgress: true, asked: true })).toBe(false);
    expect(canSpeak("full", { strokeInProgress: true, asked: false, safety: true })).toBe(false);
  });

  it("@R4 silent level speaks only when asked", () => {
    expect(canSpeak("silent", { strokeInProgress: false, asked: false })).toBe(false);
    expect(canSpeak("silent", { strokeInProgress: false, asked: true })).toBe(true);
  });

  it("@R4 safety alerts get through the silent level", () => {
    expect(canSpeak("silent", { strokeInProgress: false, asked: false, safety: true })).toBe(true);
  });

  it("@R4 inactive load does not restrict speech", () => {
    expect(canSpeak("inactive", { strokeInProgress: false, asked: false })).toBe(true);
  });
});
