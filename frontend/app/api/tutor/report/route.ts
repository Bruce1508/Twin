import { db } from "@/lib/db";
import { verifyToken, extractBearer } from "@/lib/tutor-auth";

export async function GET(request: Request) {
  const passcode = process.env.TUTOR_PASSCODE;
  if (!passcode || !verifyToken(extractBearer(request), passcode)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [submissions, errors] = await Promise.all([
      db.submission.findMany({ where: { userId }, select: { id: true, wordCount: true, source: true, metrics: true, createdAt: true } }),
      db.errorEvent.findMany({ where: { submission: { userId } }, select: { errorTag: true, category: true, excerpt: true, createdAt: true } }),
    ]);

    const weekSubmissions = submissions.filter((s) => s.createdAt >= oneWeekAgo);
    const weekErrors = errors.filter((e) => e.createdAt >= oneWeekAgo);

    const readingSubs = submissions.filter((s) => s.source === "reading_exercise");
    const speakingSubs = submissions.filter((s) => s.source === "speaking_exercise");
    const listeningSubs = submissions.filter((s) => s.source === "listening_exercise");

    const avg = (arr: any[], key: string) =>
      arr.length ? arr.reduce((s, r) => s + ((r.metrics as any)?.[key] ?? 0), 0) / arr.length : null;

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

    const writingTrend = submissions
      .filter((s) => s.source === "free_practice")
      .slice(-10)
      .map((s) => ({ date: s.createdAt, avgSentenceLength: (s.metrics as any)?.avg_sentence_length ?? 0 }));

    return Response.json({
      summary: {
        totalSubmissions: submissions.length,
        totalErrors: errors.length,
        totalWords: submissions.reduce((s, r) => s + r.wordCount, 0),
        weekSubmissions: weekSubmissions.length,
        weekErrors: weekErrors.length,
        weekWords: weekSubmissions.reduce((s, r) => s + r.wordCount, 0),
      },
      skillAccuracy: {
        reading: avg(readingSubs, "accuracy"),
        speakingScore: avg(speakingSubs, "total_score"),
        listening: avg(listeningSubs, "accuracy"),
        writingCount: submissions.filter((s) => s.source === "free_practice").length,
      },
      topErrors,
      writingTrend,
    });
  } catch (err) {
    console.error("Report fetch failed:", err);
    return Response.json({ error: "DB error" }, { status: 503 });
  }
}
