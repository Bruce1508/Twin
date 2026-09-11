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
