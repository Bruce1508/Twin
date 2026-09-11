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
  source: string;
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

// Sources whose `wordCount` is NOT a real word count — listening stores the number
// of quiz answers there instead. Named as a set (not a one-off string check) so a
// future quiz-like source is excluded here too, rather than reproducing this bug.
// Both the word denominator AND the error numerator of errorsPer100Words must
// exclude the same sources, or the ratio's two halves disagree about what "this
// week" means. The plain `words`/`errors` totals below stay all-source — they're
// legitimate volume counts, not inputs to a per-word rate.
const NON_PROSE_SOURCES = new Set(["listening_exercise"]);
const isProseSource = (source: string) => !NON_PROSE_SOURCES.has(source);

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

  const curErrorWords = sumWords(s.current.filter((r) => isProseSource(r.source)));
  const prevErrorWords = sumWords(s.previous.filter((r) => isProseSource(r.source)));
  const curProseErrors = e.current.filter((err) => isProseSource(err.source)).length;
  const prevProseErrors = e.previous.filter((err) => isProseSource(err.source)).length;

  return {
    submissions: makeDelta(s.current.length, prev(s.previous.length)),
    words: makeDelta(curWords, prev(prevWords)),
    errors: makeDelta(e.current.length, prev(e.previous.length)),
    errorsPer100Words: makeDelta(
      per100(curProseErrors, curErrorWords),
      prev(per100(prevProseErrors, prevErrorWords)),
    ),
  };
}

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

/** Mean of the rows that actually carry the key. 0 when none do — used for
 *  `current`, which Delta always types as a plain number. */
function meanOf(rows: ReportSubmission[], key: string): number {
  return meanOrNull(rows, key) ?? 0;
}

/** Same mean, but null when no row carries the key — distinct from a real
 *  measured 0. Used for `previous`: a prior window with rows of this source
 *  but all-malformed/empty metrics must read as "no data", not "scored 0". */
function meanOrNull(rows: ReportSubmission[], key: string): number | null {
  const values = rows.map((r) => metricValue(r.metrics, key)).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function computeSkills(subs: ReportSubmission[], w: ReportWindow): SkillBreakdown {
  const { current, previous } = splitByWindow(subs, w);
  const hadPrevious = previous.length > 0;

  const bySource = (rows: ReportSubmission[], source: string) => rows.filter((r) => r.source === source);

  const pair = (source: string, key: string) => {
    const cur = bySource(current, source);
    const prv = bySource(previous, source);
    // count's "no data" check is the broad hadPrevious (0 previous submissions of this
    // source, in a window that had activity elsewhere, is a legitimate measured zero).
    // value's "no data" check is per-source and metric-aware via meanOrNull: it reads
    // as null both when there are zero previous submissions of THIS source, and when
    // there are some but none carry a valid `key` (e.g. malformed/empty metrics) —
    // neither case is a real measured average, even when hadPrevious is true overall.
    return {
      count: makeDelta(cur.length, hadPrevious ? prv.length : null),
      value: makeDelta(meanOf(cur, key), meanOrNull(prv, key)),
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
