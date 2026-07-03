import { describe, it, expect } from "vitest";
import { PLAN, getPlanDay } from "@/lib/plan";

describe("PLAN data", () => {
  it("has all 56 days, numbered 1..56", () => {
    expect(PLAN).toHaveLength(56);
    expect(PLAN.map((d) => d.day)).toEqual(Array.from({ length: 56 }, (_, i) => i + 1));
  });

  it("day 1 is the alphabet/greetings theme with grammar + speaking present", () => {
    expect(PLAN[0].theme.toLowerCase()).toContain("alphabet");
    expect(PLAN[0].skills.grammar).toBeTruthy();
    expect(PLAN[0].skills.speaking).toBeTruthy();
  });

  it("flags weekly review days (day 7) as isReview", () => {
    expect(PLAN[6].isReview).toBe(true);
  });

  it("getPlanDay clamps out-of-range positions", () => {
    expect(getPlanDay(0).day).toBe(1);
    expect(getPlanDay(999).day).toBe(56);
    expect(getPlanDay(9).day).toBe(9);
  });
});
