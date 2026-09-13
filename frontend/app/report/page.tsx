import { db } from "@/lib/db";
import { buildWeeklyReport, type Delta } from "@/lib/report";
import Link from "next/link";
import CorrectionMark from "../CorrectionMark";

const CAT_COLORS: Record<string, string> = {
  grammaire: "bg-correction-red-soft text-correction-red",
  lexique: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300",
  orthographe: "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300",
  syntaxe: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300",
  registre: "bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300",
  comprehension: "bg-pen-blue-soft text-pen-blue",
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Renders the week-over-week change. Null change means "no prior data",
 *  which must read as "—", never as a fabricated +100%. */
function Trend({ delta, invert = false, digits = 0, suffix = "" }: {
  delta: Delta; invert?: boolean; digits?: number; suffix?: string;
}) {
  if (delta.change === null) {
    return <span className="text-xs text-ink-faint">— không có tuần trước</span>;
  }
  if (Math.abs(delta.change) < 0.005) {
    return <span className="text-xs text-ink-faint">không đổi</span>;
  }
  const up = delta.change > 0;
  // For errors, "up" is bad — invert flips which direction is green.
  const good = invert ? !up : up;
  return (
    <span className={`text-xs font-medium ${good ? "text-correction-green" : "text-correction-red"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta.change).toFixed(digits)}{suffix} so với tuần trước
    </span>
  );
}

function Stat({ label, delta, digits = 0, suffix = "", invert = false }: {
  label: string; delta: Delta; digits?: number; suffix?: string; invert?: boolean;
}) {
  return (
    <div className="rounded-sm border border-rule bg-paper-raised px-5 py-4">
      <div className="text-2xl font-serif font-semibold text-ink">
        {delta.current.toFixed(digits)}{suffix}
      </div>
      <div className="text-xs font-medium text-ink-muted mt-0.5">{label}</div>
      <div className="mt-1"><Trend delta={delta} digits={digits} suffix={suffix} invert={invert} /></div>
    </div>
  );
}

/** A skill nobody practised this window must render as "no data", never as a
 *  hard 0.00 — that's indistinguishable from a genuinely poor score. */
function NoDataStat({ label }: { label: string }) {
  return (
    <div className="rounded-sm border border-rule bg-paper-raised px-5 py-4">
      <div className="text-2xl font-serif font-semibold text-ink-faint">—</div>
      <div className="text-xs font-medium text-ink-muted mt-0.5">{label}</div>
      <div className="mt-1 text-xs text-ink-faint">chưa luyện tuần này</div>
    </div>
  );
}

export default async function ReportPage() {
  const userId = process.env.DEV_USER_ID ?? "";
  let report = null;
  let dbError = false;

  try {
    if (userId) {
      const [submissions, rawErrors, schedules] = await Promise.all([
        db.submission.findMany({
          where: { userId },
          select: { source: true, wordCount: true, metrics: true, createdAt: true },
        }),
        db.errorEvent.findMany({
          where: { submission: { userId } },
          select: {
            errorTag: true,
            category: true,
            excerpt: true,
            correction: true,
            createdAt: true,
            submission: { select: { source: true } },
          },
        }),
        db.tagSchedule.findMany({
          where: { userId },
          select: { errorTag: true, dueAt: true, consecutiveImproving: true },
        }),
      ]);
      // Flatten submission.source onto each error so buildWeeklyReport can tell
      // a listening-quiz error apart from a real writing/reading/speaking error.
      const errors = rawErrors.map(({ submission, ...e }) => ({ ...e, source: submission.source }));
      report = buildWeeklyReport({ submissions, errors, schedules, now: new Date() });
    }
  } catch {
    dbError = true;
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6 print:py-4 print:max-w-none">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-ink">
              Báo cáo học tập tuần
            </h1>
            {report && (
              <p className="mt-1 text-sm text-ink-muted">
                {fmtDate(report.window.thisWeekStart)} – {fmtDate(report.window.generatedAt)}
              </p>
            )}
          </div>
          <div className="flex gap-2 print:hidden">
            <Link href="/dashboard" className="rounded-sm border border-rule px-4 py-2 text-sm text-ink-muted">
              Hồ sơ
            </Link>
          </div>
        </header>

        {dbError && (
          <div className="rounded-sm border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Không kết nối được cơ sở dữ liệu — kiểm tra DATABASE_URL và DEV_USER_ID trong .env.
          </div>
        )}

        {!dbError && !report && (
          <div className="rounded-sm border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">
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
              <p className="text-xs text-ink-faint">
                “Lỗi / 100 từ” là chỉ số tiến bộ chính — viết nhiều hơn thì số lỗi thô tự nhiên tăng.
              </p>
            </section>

            <section className="rounded-sm border border-rule bg-paper-raised p-5 space-y-3 print:break-inside-avoid">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Kỹ năng</h2>
              <div className="grid grid-cols-2 gap-3">
                {report.skills.writing.count.current > 0 ? (
                  <Stat label="Viết — độ dài câu TB" delta={report.skills.writing.avgSentenceLength} digits={1} />
                ) : (
                  <NoDataStat label="Viết — độ dài câu TB" />
                )}
                {report.skills.reading.count.current > 0 ? (
                  <Stat label="Đọc — chính xác" delta={report.skills.reading.avgAccuracy} digits={2} />
                ) : (
                  <NoDataStat label="Đọc — chính xác" />
                )}
                {report.skills.listening.count.current > 0 ? (
                  <Stat label="Nghe — chính xác" delta={report.skills.listening.avgAccuracy} digits={2} />
                ) : (
                  <NoDataStat label="Nghe — chính xác" />
                )}
                {report.skills.speaking.count.current > 0 ? (
                  <Stat label="Nói — điểm /20" delta={report.skills.speaking.avgScore} digits={1} />
                ) : (
                  <NoDataStat label="Nói — điểm /20" />
                )}
              </div>
            </section>

            <section className="rounded-sm border border-rule bg-paper-raised p-5 space-y-3 print:break-inside-avoid">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Lỗi nổi bật tuần này</h2>
              {report.focusTags.length === 0 && (
                <p className="text-sm text-ink-faint">Không có lỗi nào được ghi nhận trong tuần.</p>
              )}
              <div className="space-y-3">
                {report.focusTags.map((t) => (
                  <div key={t.tag} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs rounded-sm px-2 py-0.5 font-mono font-medium ${CAT_COLORS[t.category] ?? "bg-paper-raised text-ink-muted"}`}>
                        {t.tag}
                      </span>
                      <span className="text-xs text-ink-muted font-mono">{t.count}×</span>
                    </div>
                    {t.examples.map((ex, i) => (
                      <div key={i} className="pl-2 border-l-2 border-rule">
                        <CorrectionMark excerpt={ex.excerpt} correction={ex.correction} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-sm border border-rule bg-paper-raised p-5 space-y-3 print:break-inside-avoid">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Lịch ôn tập</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {([
                  ["Cần ôn lại", report.mastery.dueNow.map((x) => x.tag)],
                  ["Đang củng cố", report.mastery.consolidating.map((x) => x.tag)],
                  ["Đang học", report.mastery.active.map((x) => x.tag)],
                ] as [string, string[]][]).map(([label, tags]) => (
                  <div key={label} className="space-y-1.5">
                    <div className="text-xs font-medium text-ink-muted">{label}</div>
                    {tags.length === 0 && <div className="text-xs text-ink-faint">—</div>}
                    {tags.map((tag) => (
                      <div key={tag} className="text-xs text-ink-muted font-mono">{tag}</div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <p className="text-xs text-ink-faint">
              Tạo lúc {report.window.generatedAt.toLocaleString("vi-VN")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
