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
    const submissions = await db.submission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        errorEvents: {
          select: { id: true, errorTag: true, category: true, excerpt: true, correction: true, explanation: true },
        },
      },
    });

    return Response.json({
      submissions: submissions.map((s) => ({
        id: s.id,
        source: s.source,
        prompt: s.prompt,
        content: s.content,
        wordCount: s.wordCount,
        metrics: s.metrics,
        createdAt: s.createdAt,
        errorCount: s.errorEvents.length,
        errors: s.errorEvents,
      })),
    });
  } catch (err) {
    console.error("History fetch failed:", err);
    return Response.json({ error: "DB error" }, { status: 503 });
  }
}
