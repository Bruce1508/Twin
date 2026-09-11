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
