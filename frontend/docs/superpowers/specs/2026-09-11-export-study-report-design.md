# Export / Study Report — Design

**Date:** 2026-09-11
**Status:** Approved (all decisions confirmed with user), ready for `writing-plans`

## Context

Linguistic Twin — v1 (M0–M6) is complete and shipped. This is v2 candidate #3, following "Drill history" (`f1fa813`) and "Spaced repetition for drills" (`223bdd5`). Listed in `PROJECT_STATUS.md:294` as:

> **Export / study report** — weekly PDF/markdown summary of errors, resolved vs unresolved, progress over time.

The app already has two stats surfaces:

- **`/dashboard`** (`app/dashboard/page.tsx`, 211 lines) — Bruce-facing, open route. All-time totals plus top error tags split by skill. Reads `getProfile` + a `Submission` count.
- **`/tutor`** report tab (`app/api/tutor/report/route.ts` + `app/tutor/page.tsx`) — passcode-gated, for the in-person teacher. Computes totals, last-7-day counts, per-skill accuracy, top-10 error tags with excerpts, and a writing trend.

Neither is portable. Both are "look at a screen right now" views, and neither can answer *"am I actually improving week over week?"*

## Problem

Three distinct gaps:

1. **No portable artifact.** Nothing can be printed, saved, or handed to the tutor at an in-person lesson. Both existing views are ephemeral screens.
2. **No honest progression signal.** The tutor report compares "last 7 days" against "all time", which is not a comparison at all. Worse, the only volume metric is a **raw error count** — which rises as the learner writes more, so improving effort reads as regression.
3. **Resolved-vs-unresolved is not represented anywhere.** The `TagSchedule` model (shipped in v2 #2) now holds `dueAt` and `consecutiveImproving`, but no surface renders scheduling state. `Drill.resolved` is display-only and is *not* the real mastery signal.

There is also a maintenance problem worth fixing in the same change: `app/api/tutor/report/route.ts` performs all its aggregation **inline in the route handler**. Adding a second report surface without extracting that logic would create two parallel copies of the error-aggregation rules, which will drift.

## Decisions

Each of these was confirmed with the user before writing this spec.

| # | Decision | Reasoning |
|---|---|---|
| 1 | **One document serving both audiences** — tutor and learner | The report carries both progress trends *and* error detail with real excerpts. Not a tutor-only lesson sheet; not a personal-trends-only record. |
| 2 | **Print-styled web page**, no generated PDF file | A `/report` route with `@media print` CSS. Tutor views or prints it; learner uses Cmd+P → Save as PDF. Zero new dependencies. Rejected: Puppeteer (~300MB Chromium), `@react-pdf/renderer` (a parallel layout system), and a Markdown download (a second output format to maintain for no additional reader). |
| 3 | **Last 7 days, compared against the previous 7 days** | A real weekly report with a real comparison. Matches "weekly summary" in `PROJECT_STATUS.md`. Rejected: a selectable 7/30/all toggle (more UI, more aggregation cases, no confirmed need) and an all-time weekly series (most work, and the long-arc view is not what a lesson needs). |
| 4 | **`/report` is an open route**, linked from both `/dashboard` and `/tutor` | Matches `/dashboard`, which is already open. Does not touch `lib/tutor-auth.ts`. The tutor reaches it from their dashboard and prints it during the lesson; the learner reaches it from theirs. Rejected: passcode-gating the learner out of their own report, and burying it as a 4th `/tutor` tab. |
| 5 | **Refactor `/api/tutor/report` onto the shared module in the same change** | One source of truth for aggregation, unit-tested. A larger diff, but the alternative is two copies of the error-frequency and per-skill-average rules drifting apart. |
| 6 | **Compute live on every request. No `Report` model, no persisted snapshots.** | Every source table (`Submission`, `ErrorEvent`, `TagSchedule`) is immutable or event-sourced, so any past window is exactly recomputable at any time. A snapshot table would add a migration and a staleness class of bug for zero information gain — and would contradict the project's own principle that derived data is never a source of truth (`Profile`'s schema comment: *"Must only be written by the recompute function, never directly"*). |

## Architecture

```
lib/report.ts           NEW   pure — no DB, no LLM. buildWeeklyReport(input) → WeeklyReport
lib/report.test.ts      NEW   vitest
app/report/page.tsx     NEW   server component: reads DB → calls lib → renders print-styled
app/api/tutor/report/route.ts   MOD   drop inline aggregation, delegate to lib/report.ts
app/tutor/page.tsx      MOD   add "Version imprimable →" link
app/dashboard/page.tsx  MOD   add "Rapport hebdo →" link
```

This follows the established repo convention: `session.ts`, `profile.ts`, `targeting.ts`, and `plan.ts` are all pure, DB-free, LLM-free modules with Vitest coverage. The database read stays in the route or page; the shaping math lives in `lib/` and is unit-tested.

**No Prisma migration. No new npm dependencies.**

### Data flow

```
app/report/page.tsx  ─┐
                      ├─→ fetch rows (Submission, ErrorEvent, TagSchedule)
api/tutor/report  ────┘        │
                               ↓
                    buildWeeklyReport({ submissions, errors, schedules, now })
                               ↓
                         WeeklyReport  → rendered / JSON
```

Both callers fetch the same three row sets and pass them in. `buildWeeklyReport` never touches the database, so every branch is directly testable with literal fixtures.

## Data contract

```ts
/** A metric compared against the previous 7-day window.
 *  `previous` and `change` are null when there is no prior data —
 *  distinct from 0, which means "prior data existed and was zero". */
export interface Delta {
  current: number;
  previous: number | null;
  change: number | null;   // current - previous
}

export interface ReportInput {
  submissions: {
    source: string;              // free_practice | reading_exercise | speaking_exercise | listening_exercise | drill_response
    wordCount: number;
    metrics: unknown;            // shape varies by source — see below
    createdAt: Date;
  }[];
  errors: {
    errorTag: string;
    category: string;
    excerpt: string | null;
    correction: string;
    createdAt: Date;
  }[];
  schedules: {
    errorTag: string;
    dueAt: Date;
    consecutiveImproving: number;
  }[];
  now: Date;                     // injected, never read from the clock inside the module
}

// Windows are ROLLING, not calendar weeks:
//   thisWeekStart = now - 7 days   → current window is (thisWeekStart, now]
//   prevWeekStart = now - 14 days  → previous window is (prevWeekStart, thisWeekStart]
// Rolling avoids a Monday-morning report covering a few hours of activity,
// and removes any week-start / timezone convention from the module.

export interface WeeklyReport {
  window: { thisWeekStart: Date; prevWeekStart: Date; generatedAt: Date };

  activity: {
    submissions: Delta;
    words: Delta;
    errors: Delta;
    errorsPer100Words: Delta;    // the real progress signal — see below
  };

  skills: {
    writing:   { count: Delta; avgSentenceLength: Delta; lexicalDiversity: Delta };
    reading:   { count: Delta; avgAccuracy: Delta };
    listening: { count: Delta; avgAccuracy: Delta };
    speaking:  { count: Delta; avgScore: Delta };
  };

  focusTags: {
    tag: string;
    category: string;
    count: number;
    examples: { excerpt: string; correction: string }[];   // max 2, this week only
  }[];                                                      // top 10 by count, this week only

  mastery: {
    dueNow:        { tag: string; dueAt: Date }[];
    consolidating: { tag: string; streak: number; dueAt: Date }[];
    active:        { tag: string; streak: number; dueAt: Date }[];
  };
}
```

### Why `errorsPer100Words` matters

Raw error count is a misleading progress metric: writing more produces more errors, so increased effort reads as regression. Normalising by volume — `errors / words * 100` — is the number that actually answers *"am I improving?"*. The existing tutor report has no equivalent. This is the headline figure of the report.

### `metrics` is not uniform across sources

`Submission.metrics` is a `Json` column whose shape depends on `source`. The aggregator must branch on `source`; it cannot average one shared key:

| `source` | Keys present in `metrics` |
|---|---|
| `free_practice` | `word_count`, `sentence_count`, `avg_sentence_length`, `lexical_diversity`, `subordinate_clause_count`, `distinct_connectors_used` (the `ExtractionMetrics` interface in `lib/extractor.ts:25`) |
| `reading_exercise` | `accuracy` |
| `listening_exercise` | `accuracy` |
| `speaking_exercise` | `total_score`, `mastery_signal` |
| `drill_response` | not used by this report |

Every read of a `metrics` key must tolerate the key being absent and exclude that row from the average rather than coercing it to 0 — a missing `accuracy` is "no data", not "scored zero".

## Mastery labelling

`Drill.resolved` is display-only since v2 #2; `TagSchedule.dueAt` is the real selection filter. The report therefore reports **scheduling state**, and deliberately avoids any word implying proven mastery:

| Group | Condition | Label on page |
|---|---|---|
| `dueNow` | `dueAt <= now` | **À revoir** |
| `consolidating` | `consecutiveImproving >= 3` and `dueAt > now` | **En consolidation** |
| `active` | `consecutiveImproving` is 1–2 and `dueAt > now` | **En cours** |

A tag with no `TagSchedule` row has never been drilled and appears in none of the three groups.

This respects the PRD's standing constraint: **no CEFR verdict.** The report presents structured observations and scheduling state. It must not state or imply "you are B1/B2", and must not claim a tag is mastered on evidence that only shows it is not yet due.

## Print styling

`@media print` rules on `/report`:

- Hide navigation, links, and buttons.
- Force a light palette — white background, black text — overriding dark mode, which prints as solid ink.
- `page-break-inside: avoid` on each section so a table is not split across pages.
- Show `generatedAt` in the header so a printed copy is self-dating.

The on-screen view keeps the existing Tailwind conventions and dark-mode support used by `/dashboard` and `/tutor`.

## Error handling

- **No data at all** (fresh user, zero submissions): render the page with zeroes and an explanatory line, not a crash and not an empty white page.
- **No previous week**: `previous` and `change` are `null`, and the UI renders "—" rather than a misleading "+100%".
- **Division by zero** in `errorsPer100Words` when the window has zero words: the value is `0`, not `NaN` or `Infinity`.
- **DB unreachable**: follow the existing `/dashboard` pattern — catch, set a flag, render the amber "Base de données non configurée" notice rather than throwing.
- **`DEV_USER_ID` unset**: same treatment as `/dashboard` and the tutor route (which returns 503).

## Testing

`lib/report.ts` is pure, so every case is a literal-fixture unit test in `lib/report.test.ts`:

1. Empty input → all zeroes, `previous` null throughout, no crash.
2. This week only, no prior week → `previous` and `change` are `null`, not `0`.
3. Both weeks present → `change` is the correct signed difference.
4. Zero words in window → `errorsPer100Words.current === 0`, not `NaN`/`Infinity`.
5. Window boundary — windows are half-open `(start, end]`, so a row at exactly `thisWeekStart` belongs to the **previous** window, and a row at exactly `now` belongs to the current one. Each row lands in exactly one window; none is double-counted.
6. `metrics` missing the expected key for a source → row excluded from the average, not counted as 0.
7. Mixed sources → each skill averages only its own rows.
8. `focusTags` → ordered by count descending, capped at 10, max 2 examples each, this week's errors only.
9. Mastery grouping → a tag lands in exactly one of `dueNow` / `consolidating` / `active` at each boundary (`streak` 2 vs 3, `dueAt` just past vs just future).

The existing suite is 26/26; these are additive. The refactor of `api/tutor/report` must not change that route's response shape — its consumer `app/tutor/page.tsx` types the response as `ReportData`, and that contract stays intact, or the type is updated in the same change.

## Out of scope

- Markdown or generated-PDF export (decision 2).
- A selectable time window (decision 3).
- Persisting report snapshots or any new Prisma model (decision 6).
- Any change to how errors are extracted, tagged, or scheduled.
- Multi-user or per-user report access control — this remains a single-user app (`DEV_USER_ID`).
- Charts or graphing libraries. Progression is expressed as numbers with deltas; adding a charting dependency contradicts decision 2's zero-dependency rationale.
