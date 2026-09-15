import { db } from "@/lib/db";
import { verifyToken, extractBearer } from "@/lib/tutor-auth";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const passcode = process.env.TUTOR_PASSCODE;
  if (!passcode || !verifyToken(extractBearer(request), passcode)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const userId = user.id;

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
