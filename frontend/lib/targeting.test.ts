import { describe, it, expect } from "vitest";
import { nextSchedule, LADDER_DAYS } from "@/lib/targeting";

const NOW = new Date("2026-09-10T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

import { selectDueCandidate } from "@/lib/targeting";

describe("nextSchedule", () => {
  it("advances the streak by one step on improving", () => {
    const r = nextSchedule(0, "improving", NOW);
    expect(r.consecutiveImproving).toBe(1);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + LADDER_DAYS[1] * DAY_MS);
  });

  it("caps the streak at the last ladder rung", () => {
    const lastIndex = LADDER_DAYS.length - 1;
    const r = nextSchedule(lastIndex, "improving", NOW);
    expect(r.consecutiveImproving).toBe(lastIndex);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + LADDER_DAYS[lastIndex] * DAY_MS);
  });

  it("resets the streak to 0 on still_struggling", () => {
    const r = nextSchedule(3, "still_struggling", NOW);
    expect(r.consecutiveImproving).toBe(0);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + LADDER_DAYS[0] * DAY_MS);
  });

  it("leaves the streak unchanged on mixed and reuses the same interval", () => {
    const r = nextSchedule(2, "mixed", NOW);
    expect(r.consecutiveImproving).toBe(2);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + LADDER_DAYS[2] * DAY_MS);
  });

  it("mixed at streak 0 stays at the first rung", () => {
    const r = nextSchedule(0, "mixed", NOW);
    expect(r.consecutiveImproving).toBe(0);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + LADDER_DAYS[0] * DAY_MS);
  });
});

describe("selectDueCandidate", () => {
  it("picks the highest-frequency tag with no schedule row", () => {
    const freq = { accord_adjectif: 3, accord_sujet_verbe: 7 };
    const result = selectDueCandidate(freq, new Map(), NOW);
    expect(result).toBe("accord_sujet_verbe");
  });

  it("excludes uncategorized", () => {
    const freq = { uncategorized: 99, accord_adjectif: 1 };
    const result = selectDueCandidate(freq, new Map(), NOW);
    expect(result).toBe("accord_adjectif");
  });

  it("excludes whole-text-only tags that canRouteToDrill rejects", () => {
    const freq = { connecteur_logique_absent: 99, accord_adjectif: 1 };
    const result = selectDueCandidate(freq, new Map(), NOW);
    expect(result).toBe("accord_adjectif");
  });

  it("excludes a tag whose dueAt is in the future", () => {
    const future = new Date(NOW.getTime() + 5 * DAY_MS);
    const freq = { accord_sujet_verbe: 9, accord_adjectif: 1 };
    const dueMap = new Map([["accord_sujet_verbe", future]]);
    const result = selectDueCandidate(freq, dueMap, NOW);
    expect(result).toBe("accord_adjectif");
  });

  it("includes a tag whose dueAt is in the past", () => {
    const past = new Date(NOW.getTime() - DAY_MS);
    const freq = { accord_sujet_verbe: 9 };
    const dueMap = new Map([["accord_sujet_verbe", past]]);
    const result = selectDueCandidate(freq, dueMap, NOW);
    expect(result).toBe("accord_sujet_verbe");
  });

  it("returns null when no candidate is eligible", () => {
    const result = selectDueCandidate({}, new Map(), NOW);
    expect(result).toBeNull();
  });
});
