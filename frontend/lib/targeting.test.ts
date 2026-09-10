import { describe, it, expect } from "vitest";
import { nextSchedule, LADDER_DAYS } from "@/lib/targeting";

const NOW = new Date("2026-09-10T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

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
