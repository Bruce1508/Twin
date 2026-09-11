import { describe, it, expect } from "vitest";
import {
  computeWindow,
  splitByWindow,
  makeDelta,
  computeActivity,
  type ReportSubmission,
  type ReportError,
} from "@/lib/report";

const NOW = new Date("2026-09-11T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

const sub = (days: number, over: Partial<ReportSubmission> = {}): ReportSubmission => ({
  source: "free_practice",
  wordCount: 100,
  metrics: {},
  createdAt: ago(days),
  ...over,
});

const err = (days: number, over: Partial<ReportError> = {}): ReportError => ({
  errorTag: "accord_adjectif",
  category: "grammaire",
  excerpt: "une homme grand",
  correction: "un homme grand",
  createdAt: ago(days),
  ...over,
});

describe("computeWindow", () => {
  it("uses rolling 7-day windows anchored on now", () => {
    const w = computeWindow(NOW);
    expect(w.generatedAt.getTime()).toBe(NOW.getTime());
    expect(w.thisWeekStart.getTime()).toBe(NOW.getTime() - 7 * DAY_MS);
    expect(w.prevWeekStart.getTime()).toBe(NOW.getTime() - 14 * DAY_MS);
  });
});

describe("splitByWindow", () => {
  it("puts rows in exactly one window and drops anything older", () => {
    const rows = [sub(1), sub(8), sub(20)];
    const { current, previous } = splitByWindow(rows, computeWindow(NOW));
    expect(current).toHaveLength(1);
    expect(previous).toHaveLength(1);
  });

  it("treats windows as half-open: a row exactly at thisWeekStart is previous", () => {
    const w = computeWindow(NOW);
    const rows = [sub(0, { createdAt: new Date(w.thisWeekStart) })];
    const { current, previous } = splitByWindow(rows, w);
    expect(current).toHaveLength(0);
    expect(previous).toHaveLength(1);
  });

  it("includes a row exactly at now in the current window", () => {
    const w = computeWindow(NOW);
    const rows = [sub(0, { createdAt: new Date(NOW) })];
    expect(splitByWindow(rows, w).current).toHaveLength(1);
  });
});

describe("makeDelta", () => {
  it("reports null change when there is no previous data", () => {
    expect(makeDelta(5, null)).toEqual({ current: 5, previous: null, change: null });
  });

  it("distinguishes a real zero from missing data", () => {
    expect(makeDelta(5, 0)).toEqual({ current: 5, previous: 0, change: 5 });
  });

  it("computes a signed change", () => {
    expect(makeDelta(3, 8)).toEqual({ current: 3, previous: 8, change: -5 });
  });
});

describe("computeActivity", () => {
  it("counts submissions, words and errors per window", () => {
    const a = computeActivity(
      [sub(1), sub(2), sub(9)],
      [err(1), err(9), err(9)],
      computeWindow(NOW),
    );
    expect(a.submissions).toEqual({ current: 2, previous: 1, change: 1 });
    expect(a.words).toEqual({ current: 200, previous: 100, change: 100 });
    expect(a.errors).toEqual({ current: 1, previous: 2, change: -1 });
  });

  it("normalises errors per 100 words", () => {
    const a = computeActivity([sub(1, { wordCount: 200 })], [err(1), err(2)], computeWindow(NOW));
    expect(a.errorsPer100Words.current).toBe(1);
  });

  it("returns 0 rather than NaN or Infinity when the window has no words", () => {
    const a = computeActivity([], [err(1)], computeWindow(NOW));
    expect(a.errorsPer100Words.current).toBe(0);
    expect(Number.isFinite(a.errorsPer100Words.current)).toBe(true);
  });

  it("marks previous as null when there is no prior-window activity at all", () => {
    const a = computeActivity([sub(1)], [err(1)], computeWindow(NOW));
    expect(a.submissions.previous).toBeNull();
    expect(a.errorsPer100Words.previous).toBeNull();
  });
});
