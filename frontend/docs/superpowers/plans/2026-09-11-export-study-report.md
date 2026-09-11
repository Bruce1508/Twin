# Export / Study Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a printable weekly study report at `/report` that compares the last 7 days against the prior 7 days, and extract the existing tutor-report aggregation into one shared, unit-tested module.

**Architecture:** A new pure module `lib/report.ts` holds all aggregation math — no DB, no LLM, `now` injected as a parameter. Two callers fetch rows and pass them in: the new `/report` server component and the refactored `/api/tutor/report` route. No Prisma migration, no new npm dependencies.

**Tech Stack:** Next.js 16 App Router (server components), TypeScript, Prisma 7 (driver adapter), Tailwind CSS v4, Vitest.

**Spec:** `frontend/docs/superpowers/specs/2026-09-11-export-study-report-design.md`

## Global Constraints

- **Working directory is `frontend/`.** Every path and command below is relative to it.
- **No new npm dependencies.** No PDF library, no charting library.
- **No Prisma migration.** No schema change, no new model.
- `lib/report.ts` must be **pure**: no `db` import, no `process.env`, no `new Date()` / `Date.now()` inside — `now` arrives as a parameter. This is what makes it testable.
- **Path alias is `@/*` → `./*`** (`tsconfig.json:22`). Import as `@/lib/report`.
- **Test command is `npx vitest run`** (`package.json:10`). Suite is 26/26 green before this plan starts; it must be green after every task.
- **UI language is Vietnamese** for headings, labels, and status text — matching `app/tutor/page.tsx`.
- **Never translate** error tag names (e.g. `accord_adjectif`) or any `excerpt` / `correction` string. They stay in French.
- **No CEFR verdict.** Never render "B1"/"B2"/"trình độ" as a judgment, and never label a tag "đã thành thạo" / "mastered".
- **`/api/tutor/report` response shape must not change.** `app/tutor/page.tsx` types it as `ReportData` with `summary`, `skillAccuracy`, `topErrors` (and reads `writingTrend`). Task 5 is a pure refactor behind an unchanged contract.
- Commit after every task. Repo convention is direct commits on `main`-style branches; no PR required.

---

### Task 1: `Delta`, window helpers, and activity totals

**Files:**
- Create: `lib/report.ts`
- Test: `lib/report.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `export interface Delta { current: number; previous: number | null; change: number | null }`
  - `export interface ReportSubmission { source: string; wordCount: number; metrics: unknown; createdAt: Date }`
  - `export interface ReportError { errorTag: string; category: string; excerpt: string | null; correction: string; createdAt: Date }`
  - `export interface ReportSchedule { errorTag: string; dueAt: Date; consecutiveImproving: number }`
  - `export interface ReportWindow { thisWeekStart: Date; prevWeekStart: Date; generatedAt: Date }`
  - `export function computeWindow(now: Date): ReportWindow`
  - `export function splitByWindow<T extends { createdAt: Date }>(rows: T[], w: ReportWindow): { current: T[]; previous: T[] }`
  - `export function makeDelta(current: number, previous: number | null): Delta`
  - `export interface ActivityTotals { submissions: Delta; words: Delta; errors: Delta; errorsPer100Words: Delta }`
  - `export function computeActivity(subs: ReportSubmission[], errs: ReportError[], w: ReportWindow): ActivityTotals`

- [ ] **Step 1: Write the failing test**

Create `lib/report.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/report.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/report"`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/report.ts`:

```ts
// Weekly study report aggregation. PURE — no DB, no LLM, no clock access.
// `now` is always injected so every branch is testable with literal fixtures.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Delta {
  current: number;
  previous: number | null;
  change: number | null;
}

export interface ReportSubmission {
  source: string;
  wordCount: number;
  metrics: unknown;
  createdAt: Date;
}

export interface ReportError {
  errorTag: string;
  category: string;
  excerpt: string | null;
  correction: string;
  createdAt: Date;
}

export interface ReportSchedule {
  errorTag: string;
  dueAt: Date;
  consecutiveImproving: number;
}

export interface ReportWindow {
  thisWeekStart: Date;
  prevWeekStart: Date;
  generatedAt: Date;
}

/** Rolling 7-day windows, not calendar weeks: avoids a Monday report that
 *  covers a few hours, and keeps timezone conventions out of the module. */
export function computeWindow(now: Date): ReportWindow {
  return {
    generatedAt: new Date(now),
    thisWeekStart: new Date(now.getTime() - 7 * DAY_MS),
    prevWeekStart: new Date(now.getTime() - 14 * DAY_MS),
  };
}

/** Windows are half-open (start, end]: a row exactly at thisWeekStart belongs
 *  to the previous window, so no row is ever counted twice. */
export function splitByWindow<T extends { createdAt: Date }>(
  rows: T[],
  w: ReportWindow,
): { current: T[]; previous: T[] } {
  const current: T[] = [];
  const previous: T[] = [];
  for (const r of rows) {
    const t = r.createdAt.getTime();
    if (t > w.thisWeekStart.getTime() && t <= w.generatedAt.getTime()) current.push(r);
    else if (t > w.prevWeekStart.getTime() && t <= w.thisWeekStart.getTime()) previous.push(r);
  }
  return { current, previous };
}

export function makeDelta(current: number, previous: number | null): Delta {
  return {
    current,
    previous,
    change: previous === null ? null : current - previous,
  };
}

export interface ActivityTotals {
  submissions: Delta;
  words: Delta;
  errors: Delta;
  errorsPer100Words: Delta;
}

const sumWords = (rows: ReportSubmission[]) => rows.reduce((s, r) => s + r.wordCount, 0);

/** Raw error count is a misleading progress signal — writing more produces more
 *  errors. Normalising by volume is the number that answers "am I improving?". */
const per100 = (errors: number, words: number) => (words === 0 ? 0 : (errors / words) * 100);

export function computeActivity(
  subs: ReportSubmission[],
  errs: ReportError[],
  w: ReportWindow,
): ActivityTotals {
  const s = splitByWindow(subs, w);
  const e = splitByWindow(errs, w);

  // "No prior activity at all" is null (unknown), not 0 (measured zero).
  const hadPrevious = s.previous.length > 0 || e.previous.length > 0;
  const prev = <T>(value: T): T | null => (hadPrevious ? value : null);

  const curWords = sumWords(s.current);
  const prevWords = sumWords(s.previous);

  return {
    submissions: makeDelta(s.current.length, prev(s.previous.length)),
    words: makeDelta(curWords, prev(prevWords)),
    errors: makeDelta(e.current.length, prev(e.previous.length)),
    errorsPer100Words: makeDelta(
      per100(e.current.length, curWords),
      prev(per100(e.previous.length, prevWords)),
    ),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/report.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Verify nothing else broke**

Run: `npx vitest run && npx tsc --noEmit`
Expected: full suite green (26 existing + 11 new = 37), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add lib/report.ts lib/report.test.ts
git commit -m "feat(report): rolling-window helpers and activity totals"
```

---

### Task 2: Per-skill metrics

**Files:**
- Modify: `lib/report.ts` (append)
- Test: `lib/report.test.ts` (append)

**Interfaces:**
- Consumes: `Delta`, `ReportSubmission`, `ReportWindow`, `splitByWindow`, `makeDelta` from Task 1.
- Produces:
  - `export interface SkillBreakdown { writing: { count: Delta; avgSentenceLength: Delta; lexicalDiversity: Delta }; reading: { count: Delta; avgAccuracy: Delta }; listening: { count: Delta; avgAccuracy: Delta }; speaking: { count: Delta; avgScore: Delta } }`
  - `export function computeSkills(subs: ReportSubmission[], w: ReportWindow): SkillBreakdown`

**Context the implementer needs:** `Submission.metrics` is a `Json` column whose **shape depends on `source`**. There is no single key to average across sources:

| `source` | keys in `metrics` |
|---|---|
| `free_practice` | `avg_sentence_length`, `lexical_diversity` (plus others, unused here) |
| `reading_exercise` | `accuracy` (0–1) |
| `listening_exercise` | `accuracy` (0–1) |
| `speaking_exercise` | `total_score` (0–20) |
| `drill_response` | unused by this report |

A missing key means "no data" — exclude that row from the average. Never coerce it to `0`, which would falsely drag the average down.

- [ ] **Step 1: Write the failing test**

Append to `lib/report.test.ts`:

```ts
import { computeSkills } from "@/lib/report";

describe("computeSkills", () => {
  it("averages each source using only its own metric key", () => {
    const s = computeSkills(
      [
        sub(1, { source: "free_practice", metrics: { avg_sentence_length: 10, lexical_diversity: 0.5 } }),
        sub(1, { source: "free_practice", metrics: { avg_sentence_length: 20, lexical_diversity: 0.7 } }),
        sub(1, { source: "reading_exercise", metrics: { accuracy: 0.8 } }),
        sub(1, { source: "listening_exercise", metrics: { accuracy: 0.6 } }),
        sub(1, { source: "speaking_exercise", metrics: { total_score: 14 } }),
      ],
      computeWindow(NOW),
    );
    expect(s.writing.count.current).toBe(2);
    expect(s.writing.avgSentenceLength.current).toBe(15);
    expect(s.writing.lexicalDiversity.current).toBeCloseTo(0.6);
    expect(s.reading.avgAccuracy.current).toBeCloseTo(0.8);
    expect(s.listening.avgAccuracy.current).toBeCloseTo(0.6);
    expect(s.speaking.avgScore.current).toBe(14);
  });

  it("excludes rows whose metric key is missing instead of counting them as zero", () => {
    const s = computeSkills(
      [
        sub(1, { source: "reading_exercise", metrics: { accuracy: 1 } }),
        sub(1, { source: "reading_exercise", metrics: {} }),
      ],
      computeWindow(NOW),
    );
    expect(s.reading.count.current).toBe(2);
    expect(s.reading.avgAccuracy.current).toBe(1);
  });

  it("tolerates a null or non-object metrics value", () => {
    const s = computeSkills(
      [sub(1, { source: "reading_exercise", metrics: null })],
      computeWindow(NOW),
    );
    expect(s.reading.avgAccuracy.current).toBe(0);
  });

  it("ignores drill_response entirely", () => {
    const s = computeSkills(
      [sub(1, { source: "drill_response", metrics: { accuracy: 0.1 } })],
      computeWindow(NOW),
    );
    expect(s.reading.count.current).toBe(0);
    expect(s.writing.count.current).toBe(0);
  });

  it("compares against the previous window", () => {
    const s = computeSkills(
      [
        sub(1, { source: "speaking_exercise", metrics: { total_score: 16 } }),
        sub(9, { source: "speaking_exercise", metrics: { total_score: 12 } }),
      ],
      computeWindow(NOW),
    );
    expect(s.speaking.avgScore).toEqual({ current: 16, previous: 12, change: 4 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/report.test.ts`
Expected: FAIL — `computeSkills is not exported` / not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/report.ts`:

```ts
export interface SkillBreakdown {
  writing: { count: Delta; avgSentenceLength: Delta; lexicalDiversity: Delta };
  reading: { count: Delta; avgAccuracy: Delta };
  listening: { count: Delta; avgAccuracy: Delta };
  speaking: { count: Delta; avgScore: Delta };
}

/** Reads one numeric key out of the untyped `metrics` Json blob.
 *  Returns null — not 0 — when absent, so the row is excluded from averages. */
function metricValue(metrics: unknown, key: string): number | null {
  if (typeof metrics !== "object" || metrics === null) return null;
  const v = (metrics as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Mean of the rows that actually carry the key. 0 when none do. */
function meanOf(rows: ReportSubmission[], key: string): number {
  const values = rows.map((r) => metricValue(r.metrics, key)).filter((v): v is number => v !== null);
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function computeSkills(subs: ReportSubmission[], w: ReportWindow): SkillBreakdown {
  const { current, previous } = splitByWindow(subs, w);
  const hadPrevious = previous.length > 0;

  const bySource = (rows: ReportSubmission[], source: string) => rows.filter((r) => r.source === source);

  const pair = (source: string, key: string) => {
    const cur = bySource(current, source);
    const prv = bySource(previous, source);
    return {
      count: makeDelta(cur.length, hadPrevious ? prv.length : null),
      value: makeDelta(meanOf(cur, key), hadPrevious ? meanOf(prv, key) : null),
    };
  };

  const writingLen = pair("free_practice", "avg_sentence_length");
  const writingDiv = pair("free_practice", "lexical_diversity");
  const reading = pair("reading_exercise", "accuracy");
  const listening = pair("listening_exercise", "accuracy");
  const speaking = pair("speaking_exercise", "total_score");

  return {
    writing: {
      count: writingLen.count,
      avgSentenceLength: writingLen.value,
      lexicalDiversity: writingDiv.value,
    },
    reading: { count: reading.count, avgAccuracy: reading.value },
    listening: { count: listening.count, avgAccuracy: listening.value },
    speaking: { count: speaking.count, avgScore: speaking.value },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/report.test.ts`
Expected: PASS — 16 tests.

- [ ] **Step 5: Verify nothing else broke**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 42 passing, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add lib/report.ts lib/report.test.ts
git commit -m "feat(report): per-skill metric averages branching on submission source"
```

---

### Task 3: Focus tags and mastery grouping

**Files:**
- Modify: `lib/report.ts` (append)
- Test: `lib/report.test.ts` (append)

**Interfaces:**
- Consumes: `ReportError`, `ReportSchedule`, `ReportWindow`, `splitByWindow` from Task 1.
- Produces:
  - `export interface FocusTag { tag: string; category: string; count: number; examples: { excerpt: string; correction: string }[] }`
  - `export function computeFocusTags(errs: ReportError[], w: ReportWindow): FocusTag[]`
  - `export interface MasteryGroups { dueNow: { tag: string; dueAt: Date }[]; consolidating: { tag: string; streak: number; dueAt: Date }[]; active: { tag: string; streak: number; dueAt: Date }[] }`
  - `export function computeMastery(schedules: ReportSchedule[], now: Date): MasteryGroups`

**Context the implementer needs:** `Drill.resolved` is display-only and is NOT the mastery signal. `TagSchedule.dueAt` is the real selection filter. Grouping rules, exactly:

| group | condition |
|---|---|
| `dueNow` | `dueAt <= now` |
| `consolidating` | `consecutiveImproving >= 3` **and** `dueAt > now` |
| `active` | `consecutiveImproving` is 1 or 2 **and** `dueAt > now` |

A schedule with `consecutiveImproving === 0` and `dueAt > now` falls in **none** of the groups — it was just graded as struggling and is waiting for its next turn. Every schedule lands in at most one group.

- [ ] **Step 1: Write the failing test**

Append to `lib/report.test.ts`:

```ts
import { computeFocusTags, computeMastery, type ReportSchedule } from "@/lib/report";

const sched = (over: Partial<ReportSchedule> = {}): ReportSchedule => ({
  errorTag: "accord_adjectif",
  dueAt: ago(-1), // tomorrow
  consecutiveImproving: 1,
  ...over,
});

describe("computeFocusTags", () => {
  it("ranks this week's tags by count and ignores older errors", () => {
    const tags = computeFocusTags(
      [
        err(1, { errorTag: "a" }),
        err(2, { errorTag: "a" }),
        err(3, { errorTag: "b" }),
        err(9, { errorTag: "c" }),
      ],
      computeWindow(NOW),
    );
    expect(tags.map((t) => t.tag)).toEqual(["a", "b"]);
    expect(tags[0].count).toBe(2);
  });

  it("caps the list at 10 tags", () => {
    const many = Array.from({ length: 15 }, (_, i) => err(1, { errorTag: `tag${i}` }));
    expect(computeFocusTags(many, computeWindow(NOW))).toHaveLength(10);
  });

  it("keeps at most two examples and skips errors with no excerpt", () => {
    const tags = computeFocusTags(
      [
        err(1, { excerpt: "un" }),
        err(1, { excerpt: "deux" }),
        err(1, { excerpt: "trois" }),
        err(1, { excerpt: null }),
      ],
      computeWindow(NOW),
    );
    expect(tags[0].count).toBe(4);
    expect(tags[0].examples).toHaveLength(2);
    expect(tags[0].examples[0]).toEqual({ excerpt: "un", correction: "un homme grand" });
  });

  it("returns an empty list when nothing happened this week", () => {
    expect(computeFocusTags([err(9)], computeWindow(NOW))).toEqual([]);
  });
});

describe("computeMastery", () => {
  it("puts a due schedule in dueNow regardless of streak", () => {
    const m = computeMastery([sched({ dueAt: ago(1), consecutiveImproving: 4 })], NOW);
    expect(m.dueNow.map((x) => x.tag)).toEqual(["accord_adjectif"]);
    expect(m.consolidating).toHaveLength(0);
  });

  it("treats dueAt exactly at now as due", () => {
    const m = computeMastery([sched({ dueAt: new Date(NOW) })], NOW);
    expect(m.dueNow).toHaveLength(1);
  });

  it("splits not-yet-due schedules at a streak of 3", () => {
    const m = computeMastery(
      [
        sched({ errorTag: "two", consecutiveImproving: 2 }),
        sched({ errorTag: "three", consecutiveImproving: 3 }),
      ],
      NOW,
    );
    expect(m.active.map((x) => x.tag)).toEqual(["two"]);
    expect(m.consolidating.map((x) => x.tag)).toEqual(["three"]);
  });

  it("leaves a zero-streak not-yet-due schedule out of every group", () => {
    const m = computeMastery([sched({ consecutiveImproving: 0 })], NOW);
    expect(m.dueNow).toHaveLength(0);
    expect(m.active).toHaveLength(0);
    expect(m.consolidating).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/report.test.ts`
Expected: FAIL — `computeFocusTags` / `computeMastery` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/report.ts`:

```ts
export interface FocusTag {
  tag: string;
  category: string;
  count: number;
  examples: { excerpt: string; correction: string }[];
}

const MAX_FOCUS_TAGS = 10;
const MAX_EXAMPLES_PER_TAG = 2;

export function computeFocusTags(errs: ReportError[], w: ReportWindow): FocusTag[] {
  const { current } = splitByWindow(errs, w);

  const byTag = new Map<string, FocusTag>();
  for (const e of current) {
    let entry = byTag.get(e.errorTag);
    if (!entry) {
      entry = { tag: e.errorTag, category: e.category, count: 0, examples: [] };
      byTag.set(e.errorTag, entry);
    }
    entry.count++;
    // excerpt is null for whole-text observations — they have no span to quote.
    if (e.excerpt && entry.examples.length < MAX_EXAMPLES_PER_TAG) {
      entry.examples.push({ excerpt: e.excerpt, correction: e.correction });
    }
  }

  return [...byTag.values()].sort((a, b) => b.count - a.count).slice(0, MAX_FOCUS_TAGS);
}

export interface MasteryGroups {
  dueNow: { tag: string; dueAt: Date }[];
  consolidating: { tag: string; streak: number; dueAt: Date }[];
  active: { tag: string; streak: number; dueAt: Date }[];
}

const CONSOLIDATING_STREAK = 3;

/** Reports SCHEDULING state, not proven mastery. `Drill.resolved` is
 *  display-only; `TagSchedule.dueAt` is the real selection filter. */
export function computeMastery(schedules: ReportSchedule[], now: Date): MasteryGroups {
  const groups: MasteryGroups = { dueNow: [], consolidating: [], active: [] };

  for (const s of schedules) {
    if (s.dueAt.getTime() <= now.getTime()) {
      groups.dueNow.push({ tag: s.errorTag, dueAt: s.dueAt });
    } else if (s.consecutiveImproving >= CONSOLIDATING_STREAK) {
      groups.consolidating.push({ tag: s.errorTag, streak: s.consecutiveImproving, dueAt: s.dueAt });
    } else if (s.consecutiveImproving > 0) {
      groups.active.push({ tag: s.errorTag, streak: s.consecutiveImproving, dueAt: s.dueAt });
    }
    // streak 0 and not yet due: just graded as struggling, awaiting its turn.
  }

  return groups;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/report.test.ts`
Expected: PASS — 24 tests.

- [ ] **Step 5: Verify nothing else broke**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 50 passing, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add lib/report.ts lib/report.test.ts
git commit -m "feat(report): focus-tag ranking and TagSchedule mastery grouping"
```

---

### Task 4: `buildWeeklyReport` assembler

**Files:**
- Modify: `lib/report.ts` (append)
- Test: `lib/report.test.ts` (append)

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces:
  - `export interface ReportInput { submissions: ReportSubmission[]; errors: ReportError[]; schedules: ReportSchedule[]; now: Date }`
  - `export interface WeeklyReport { window: ReportWindow; activity: ActivityTotals; skills: SkillBreakdown; focusTags: FocusTag[]; mastery: MasteryGroups }`
  - `export function buildWeeklyReport(input: ReportInput): WeeklyReport`

- [ ] **Step 1: Write the failing test**

Append to `lib/report.test.ts`:

```ts
import { buildWeeklyReport } from "@/lib/report";

describe("buildWeeklyReport", () => {
  it("assembles every section from one pass of input", () => {
    const r = buildWeeklyReport({
      submissions: [sub(1, { source: "reading_exercise", metrics: { accuracy: 0.9 } })],
      errors: [err(1)],
      schedules: [sched({ dueAt: ago(1) })],
      now: NOW,
    });
    expect(r.window.generatedAt.getTime()).toBe(NOW.getTime());
    expect(r.activity.submissions.current).toBe(1);
    expect(r.skills.reading.avgAccuracy.current).toBeCloseTo(0.9);
    expect(r.focusTags[0].tag).toBe("accord_adjectif");
    expect(r.mastery.dueNow).toHaveLength(1);
  });

  it("survives completely empty input", () => {
    const r = buildWeeklyReport({ submissions: [], errors: [], schedules: [], now: NOW });
    expect(r.activity.submissions).toEqual({ current: 0, previous: null, change: null });
    expect(r.activity.errorsPer100Words.current).toBe(0);
    expect(r.focusTags).toEqual([]);
    expect(r.mastery.dueNow).toEqual([]);
    expect(r.skills.speaking.avgScore.current).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/report.test.ts`
Expected: FAIL — `buildWeeklyReport` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/report.ts`:

```ts
export interface ReportInput {
  submissions: ReportSubmission[];
  errors: ReportError[];
  schedules: ReportSchedule[];
  now: Date;
}

export interface WeeklyReport {
  window: ReportWindow;
  activity: ActivityTotals;
  skills: SkillBreakdown;
  focusTags: FocusTag[];
  mastery: MasteryGroups;
}

export function buildWeeklyReport(input: ReportInput): WeeklyReport {
  const window = computeWindow(input.now);
  return {
    window,
    activity: computeActivity(input.submissions, input.errors, window),
    skills: computeSkills(input.submissions, window),
    focusTags: computeFocusTags(input.errors, window),
    mastery: computeMastery(input.schedules, input.now),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/report.test.ts`
Expected: PASS — 26 tests.

- [ ] **Step 5: Verify nothing else broke**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 52 passing, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add lib/report.ts lib/report.test.ts
git commit -m "feat(report): buildWeeklyReport assembles all sections"
```

---

### Task 5: Refactor `/api/tutor/report` onto the shared module

**Files:**
- Modify: `app/api/tutor/report/route.ts` (whole file)

**Interfaces:**
- Consumes: `buildWeeklyReport` from Task 4.
- Produces: no new exports. **The HTTP response shape is unchanged.**

**Context the implementer needs:** this route's consumer is `app/tutor/page.tsx`, which types the response as `ReportData` (`app/tutor/page.tsx:9-13`) with `summary`, `skillAccuracy`, and `topErrors`, and renders every field. **This is a pure refactor: the JSON must keep exactly the same keys and semantics.** The existing route's `summary.weekX` fields mean "last 7 days"; `buildWeeklyReport`'s `activity.*.current` is the same window, so they map directly. `topErrors` in the old route is **all-time**, while `focusTags` is **this week only** — so `topErrors` must still be computed all-time. Do not "fix" that here; changing it would silently alter the tutor's view.

- [ ] **Step 1: Replace the route body**

Rewrite `app/api/tutor/report/route.ts`:

```ts
import { db } from "@/lib/db";
import { verifyToken, extractBearer } from "@/lib/tutor-auth";
import { buildWeeklyReport } from "@/lib/report";

export async function GET(request: Request) {
  const passcode = process.env.TUTOR_PASSCODE;
  if (!passcode || !verifyToken(extractBearer(request), passcode)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  try {
    const [submissions, errors, schedules] = await Promise.all([
      db.submission.findMany({
        where: { userId },
        select: { source: true, wordCount: true, metrics: true, createdAt: true },
      }),
      db.errorEvent.findMany({
        where: { submission: { userId } },
        select: { errorTag: true, category: true, excerpt: true, correction: true, createdAt: true },
      }),
      db.tagSchedule.findMany({
        where: { userId },
        select: { errorTag: true, dueAt: true, consecutiveImproving: true },
      }),
    ]);

    const report = buildWeeklyReport({
      submissions,
      errors,
      schedules,
      now: new Date(),
    });

    // topErrors stays ALL-TIME — the tutor view has always shown it that way.
    // focusTags (this week only) is a different thing and is not substituted here.
    const tagFreq: Record<string, { count: number; category: string; excerpts: string[] }> = {};
    for (const e of errors) {
      if (!tagFreq[e.errorTag]) tagFreq[e.errorTag] = { count: 0, category: e.category, excerpts: [] };
      tagFreq[e.errorTag].count++;
      if (e.excerpt && tagFreq[e.errorTag].excerpts.length < 2) tagFreq[e.errorTag].excerpts.push(e.excerpt);
    }
    const topErrors = Object.entries(tagFreq)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([tag, data]) => ({ tag, ...data }));

    return Response.json({
      summary: {
        totalSubmissions: submissions.length,
        totalErrors: errors.length,
        totalWords: submissions.reduce((s, r) => s + r.wordCount, 0),
        weekSubmissions: report.activity.submissions.current,
        weekErrors: report.activity.errors.current,
        weekWords: report.activity.words.current,
      },
      skillAccuracy: {
        reading: report.skills.reading.count.current > 0 ? report.skills.reading.avgAccuracy.current : null,
        speakingScore: report.skills.speaking.count.current > 0 ? report.skills.speaking.avgScore.current : null,
        listening: report.skills.listening.count.current > 0 ? report.skills.listening.avgAccuracy.current : null,
        writingCount: submissions.filter((s) => s.source === "free_practice").length,
      },
      topErrors,
      writingTrend: submissions
        .filter((s) => s.source === "free_practice")
        .slice(-10)
        .map((s) => ({ date: s.createdAt, avgSentenceLength: (s.metrics as any)?.avg_sentence_length ?? 0 })),
    });
  } catch (err) {
    console.error("Report fetch failed:", err);
    return Response.json({ error: "DB error" }, { status: 503 });
  }
}
```

> **Behaviour note to state in the commit:** `skillAccuracy` now reflects the **last 7 days** rather than all-time, because it is sourced from the weekly report. The keys and null-when-no-data semantics are unchanged. This is the one intentional semantic change in this task; it makes the "Kỹ năng" panel agree with the "tuần này" figures beside it.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If `db.tagSchedule` errors with `Property 'tagSchedule' does not exist`, run `npx prisma generate` first — the generated per-model files are gitignored and must be materialised locally.

- [ ] **Step 3: Verify the suite still passes**

Run: `npx vitest run`
Expected: 52 passing.

- [ ] **Step 4: Commit**

```bash
git add app/api/tutor/report/route.ts
git commit -m "refactor(tutor): source report aggregation from lib/report

skillAccuracy now covers the last 7 days instead of all-time so it agrees
with the weekly counts shown next to it. Response keys are unchanged."
```

---

### Task 6: The `/report` page

**Files:**
- Create: `app/report/page.tsx`

**Interfaces:**
- Consumes: `buildWeeklyReport`, `type WeeklyReport`, `type Delta` from Task 4.
- Produces: the route `/report`. No exports consumed by later tasks.

**Context the implementer needs:**
- This is a **server component** (`async function`, no `"use client"`), matching `app/dashboard/page.tsx`.
- DB-failure pattern is `app/dashboard/page.tsx:20-40`: wrap in `try/catch`, set a `dbError` flag, render an amber notice. Do not throw.
- All chrome text is **Vietnamese**. Tag names and French excerpts/corrections are never translated.
- Never print a CEFR level or the word "thành thạo"/"mastered".

- [ ] **Step 1: Create the page**

Create `app/report/page.tsx`:

```tsx
import { db } from "@/lib/db";
import { buildWeeklyReport, type Delta } from "@/lib/report";
import Link from "next/link";

const CAT_COLORS: Record<string, string> = {
  grammaire: "bg-red-100 text-red-700",
  lexique: "bg-blue-100 text-blue-700",
  orthographe: "bg-yellow-100 text-yellow-700",
  syntaxe: "bg-purple-100 text-purple-700",
  registre: "bg-orange-100 text-orange-700",
  comprehension: "bg-indigo-100 text-indigo-700",
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Renders the week-over-week change. Null change means "no prior data",
 *  which must read as "—", never as a fabricated +100%. */
function Trend({ delta, invert = false, digits = 0, suffix = "" }: {
  delta: Delta; invert?: boolean; digits?: number; suffix?: string;
}) {
  if (delta.change === null) {
    return <span className="text-xs text-zinc-400">— không có tuần trước</span>;
  }
  if (Math.abs(delta.change) < 0.005) {
    return <span className="text-xs text-zinc-400">không đổi</span>;
  }
  const up = delta.change > 0;
  // For errors, "up" is bad — invert flips which direction is green.
  const good = invert ? !up : up;
  return (
    <span className={`text-xs font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta.change).toFixed(digits)}{suffix} so với tuần trước
    </span>
  );
}

function Stat({ label, delta, digits = 0, suffix = "", invert = false }: {
  label: string; delta: Delta; digits?: number; suffix?: string; invert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 print:border-zinc-300">
      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {delta.current.toFixed(digits)}{suffix}
      </div>
      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-0.5">{label}</div>
      <div className="mt-1"><Trend delta={delta} digits={digits} suffix={suffix} invert={invert} /></div>
    </div>
  );
}

export default async function ReportPage() {
  const userId = process.env.DEV_USER_ID ?? "";
  let report = null;
  let dbError = false;

  try {
    if (userId) {
      const [submissions, errors, schedules] = await Promise.all([
        db.submission.findMany({
          where: { userId },
          select: { source: true, wordCount: true, metrics: true, createdAt: true },
        }),
        db.errorEvent.findMany({
          where: { submission: { userId } },
          select: { errorTag: true, category: true, excerpt: true, correction: true, createdAt: true },
        }),
        db.tagSchedule.findMany({
          where: { userId },
          select: { errorTag: true, dueAt: true, consecutiveImproving: true },
        }),
      ]);
      report = buildWeeklyReport({ submissions, errors, schedules, now: new Date() });
    }
  } catch {
    dbError = true;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6 print:py-4 print:max-w-none">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 print:text-black">
              Báo cáo học tập tuần
            </h1>
            {report && (
              <p className="mt-1 text-sm text-zinc-500 print:text-zinc-700">
                {fmtDate(report.window.thisWeekStart)} – {fmtDate(report.window.generatedAt)}
              </p>
            )}
          </div>
          <div className="flex gap-2 print:hidden">
            <Link href="/dashboard" className="rounded-full border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300">
              Hồ sơ
            </Link>
          </div>
        </header>

        {dbError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Không kết nối được cơ sở dữ liệu — kiểm tra DATABASE_URL và DEV_USER_ID trong .env.
          </div>
        )}

        {!dbError && !report && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Chưa cấu hình DEV_USER_ID.
          </div>
        )}

        {report && (
          <>
            <section className="space-y-3 print:break-inside-avoid">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Bài đã làm" delta={report.activity.submissions} />
                <Stat label="Từ đã viết" delta={report.activity.words} />
                <Stat label="Lỗi ghi nhận" delta={report.activity.errors} invert />
                <Stat label="Lỗi / 100 từ" delta={report.activity.errorsPer100Words} digits={1} invert />
              </div>
              <p className="text-xs text-zinc-400 print:text-zinc-600">
                “Lỗi / 100 từ” là chỉ số tiến bộ chính — viết nhiều hơn thì số lỗi thô tự nhiên tăng.
              </p>
            </section>

            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 print:break-inside-avoid print:border-zinc-300">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Kỹ năng</h2>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Viết — độ dài câu TB" delta={report.skills.writing.avgSentenceLength} digits={1} />
                <Stat label="Đọc — chính xác" delta={report.skills.reading.avgAccuracy} digits={2} />
                <Stat label="Nghe — chính xác" delta={report.skills.listening.avgAccuracy} digits={2} />
                <Stat label="Nói — điểm /20" delta={report.skills.speaking.avgScore} digits={1} />
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 print:break-inside-avoid print:border-zinc-300">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Lỗi nổi bật tuần này</h2>
              {report.focusTags.length === 0 && (
                <p className="text-sm text-zinc-400">Không có lỗi nào được ghi nhận trong tuần.</p>
              )}
              <div className="space-y-3">
                {report.focusTags.map((t) => (
                  <div key={t.tag} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${CAT_COLORS[t.category] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {t.tag}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">{t.count}×</span>
                    </div>
                    {t.examples.map((ex, i) => (
                      <div key={i} className="text-xs pl-2 border-l-2 border-zinc-200 dark:border-zinc-700">
                        <span className="text-red-600 line-through">{ex.excerpt}</span>
                        {" → "}
                        <span className="text-emerald-700">{ex.correction}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 print:break-inside-avoid print:border-zinc-300">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Lịch ôn tập</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {([
                  ["Cần ôn lại", report.mastery.dueNow.map((x) => x.tag)],
                  ["Đang củng cố", report.mastery.consolidating.map((x) => x.tag)],
                  ["Đang học", report.mastery.active.map((x) => x.tag)],
                ] as [string, string[]][]).map(([label, tags]) => (
                  <div key={label} className="space-y-1.5">
                    <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</div>
                    {tags.length === 0 && <div className="text-xs text-zinc-400">—</div>}
                    {tags.map((tag) => (
                      <div key={tag} className="text-xs text-zinc-700 dark:text-zinc-300 font-mono">{tag}</div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <p className="text-xs text-zinc-400 print:text-zinc-600">
              Tạo lúc {report.window.generatedAt.toLocaleString("vi-VN")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Verify the page renders against the real dev DB**

```bash
cd /Users/brucevo/Desktop/twin && docker compose up -d
cd frontend && npm run dev
```

Open `http://localhost:3000/report`.
Expected: four stat tiles at the top, a skills panel, a focus-errors list, and a three-column schedule panel. With a real database that has data, no section should show "—" everywhere. Then press Cmd+P and confirm the print preview is light-on-white with no nav buttons.

- [ ] **Step 4: Commit**

```bash
git add app/report/page.tsx
git commit -m "feat(report): printable weekly study report page"
```

---

### Task 7: Link the report from `/dashboard` and `/tutor`

**Files:**
- Modify: `app/dashboard/page.tsx` (header button row, ~line 58-66)
- Modify: `app/tutor/page.tsx` (header link row, ~line 150-155)

**Interfaces:**
- Consumes: the `/report` route from Task 6.
- Produces: nothing.

**Context the implementer needs:** `app/dashboard/page.tsx` is a **server** component and already imports `Link` from `next/link`. `app/tutor/page.tsx` is a **client** component (`"use client"`) and uses plain `<a href>` for its "← Accueil" link — match whichever each file already uses rather than introducing a new pattern.

- [ ] **Step 1: Add the dashboard link**

In `app/dashboard/page.tsx`, inside the `<div className="flex gap-2">` in the header, add as the **first** child (before the "Écrire" link):

```tsx
<Link href="/report" className="rounded-full border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300">
  Rapport
</Link>
```

- [ ] **Step 2: Add the tutor link**

In `app/tutor/page.tsx`, inside the `<div className="flex items-center gap-4">` in the header, add **before** the existing "← Accueil" anchor:

```tsx
<a href="/report" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-600 hover:text-amber-700 transition-colors">
  Báo cáo in được ↗
</a>
```

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, 52 passing.

- [ ] **Step 4: Verify both links in the browser**

With `npm run dev` running: open `/dashboard`, click "Rapport" → lands on `/report`. Open `/tutor`, enter the passcode, click "Báo cáo in được ↗" → opens `/report` in a new tab.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx app/tutor/page.tsx
git commit -m "feat(report): link the weekly report from dashboard and tutor"
```

---

### Task 8: Update project docs

**Files:**
- Modify: `../PROJECT_STATUS.md` (repo root — the v2 backlog list, lines ~289-294)

**Interfaces:** none.

- [ ] **Step 1: Mark the feature shipped**

In `PROJECT_STATUS.md`, change the "Export / study report" backlog entry to strikethrough-and-shipped form, matching how the "B2 rubric writing score" entry is already written:

```markdown
6. ~~**Export / study report**~~ — ✅ **Shipped.** `/report` renders a printable weekly report (rolling 7 days vs the prior 7). Aggregation lives in `lib/report.ts` (pure, Vitest-covered) and is shared with `/api/tutor/report`. No PDF library and no new Prisma model — the report is recomputed live from the immutable event store. Design + plan: `frontend/docs/superpowers/specs/2026-09-11-export-study-report-design.md`, `.../plans/2026-09-11-export-study-report.md`.
```

- [ ] **Step 2: Add the module to the lib listing**

In the `lib/` module list (near line 184-196), add after the `targeting.ts` line:

```markdown
- `report.ts` — weekly study report aggregation (pure): rolling 7-day vs prior-7-day deltas, per-skill metric averages, focus tags, TagSchedule mastery grouping. No DB, no LLM.
```

- [ ] **Step 3: Commit**

```bash
git add ../PROJECT_STATUS.md
git commit -m "docs: mark export/study report shipped"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Decision 1 — one document, both audiences | Task 6 (progress stats + error excerpts on one page) |
| Decision 2 — print-styled page, no PDF lib | Task 6 (`print:` utilities, no dependency added) |
| Decision 3 — 7 days vs prior 7 days | Task 1 (`computeWindow`, `splitByWindow`) |
| Decision 4 — open `/report`, linked from both | Tasks 6, 7 |
| Decision 5 — refactor tutor route onto shared module | Task 5 |
| Decision 6 — live compute, no `Report` model | Tasks 5, 6 (query on each request; no migration anywhere in the plan) |
| `errorsPer100Words` | Task 1 |
| `metrics` varies by source | Task 2 |
| Mastery labelling (3 groups, no "mastered") | Tasks 3, 6 |
| UI language Vietnamese; tags/excerpts stay French | Task 6, Global Constraints |
| Print styling rules | Task 6 |
| Error handling — empty, no prior week, div-by-zero, DB down, no `DEV_USER_ID` | Tasks 1, 4 (tests), Task 6 (UI) |
| Testing list (9 cases) | Tasks 1–4 — all 9 present |
| Out of scope | No task adds Markdown export, a window toggle, a snapshot model, or a charting library |

**Placeholder scan:** No "TBD"/"TODO"/"similar to Task N"/"add error handling". Every code step carries complete, runnable code.

**Type consistency:** `Delta`, `ReportWindow`, `ReportSubmission`, `ReportError`, `ReportSchedule`, `ActivityTotals`, `SkillBreakdown`, `FocusTag`, `MasteryGroups`, `ReportInput`, `WeeklyReport` are each defined once and referenced with identical names and field names in every later task. `buildWeeklyReport` is the single entry point used by both Task 5 and Task 6, with matching argument shape (`{ submissions, errors, schedules, now }`) in both.

**Known intentional deviation:** Task 5 changes `skillAccuracy` from all-time to last-7-days. Flagged in the task body and the commit message, because it is the only place a consumer-visible behaviour shifts.
