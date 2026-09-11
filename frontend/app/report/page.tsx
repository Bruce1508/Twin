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
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 print:border-zinc-300 print:bg-white">
      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 print:text-black">
        {delta.current.toFixed(digits)}{suffix}
      </div>
      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-0.5 print:text-zinc-700">{label}</div>
      <div className="mt-1"><Trend delta={delta} digits={digits} suffix={suffix} invert={invert} /></div>
    </div>
  );
}

/** A skill nobody practised this window must render as "no data", never as a
 *  hard 0.00 — that's indistinguishable from a genuinely poor score. */
function NoDataStat({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 print:border-zinc-300 print:bg-white">
      <div className="text-2xl font-bold text-zinc-300 dark:text-zinc-700 print:text-zinc-400">—</div>
      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-0.5 print:text-zinc-700">{label}</div>
      <div className="mt-1 text-xs text-zinc-400">chưa luyện tuần này</div>
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

            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 print:break-inside-avoid print:border-zinc-300 print:bg-white">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Kỹ năng</h2>
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

            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 print:break-inside-avoid print:border-zinc-300 print:bg-white">
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

            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 print:break-inside-avoid print:border-zinc-300 print:bg-white">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Lịch ôn tập</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {([
                  ["Cần ôn lại", report.mastery.dueNow.map((x) => x.tag)],
                  ["Đang củng cố", report.mastery.consolidating.map((x) => x.tag)],
                  ["Đang học", report.mastery.active.map((x) => x.tag)],
                ] as [string, string[]][]).map(([label, tags]) => (
                  <div key={label} className="space-y-1.5">
                    <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 print:text-zinc-700">{label}</div>
                    {tags.length === 0 && <div className="text-xs text-zinc-400">—</div>}
                    {tags.map((tag) => (
                      <div key={tag} className="text-xs text-zinc-700 dark:text-zinc-300 font-mono print:text-zinc-700">{tag}</div>
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
