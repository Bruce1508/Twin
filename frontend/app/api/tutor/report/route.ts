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
        // reading/speakingScore/listening reflect the last 7 days (from buildWeeklyReport);
        // writingCount below is all-time — two different windows in one object.
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
