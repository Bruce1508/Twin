import { db } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { getPlanDay } from "@/lib/plan";
import { getNextTarget } from "@/lib/targeting";
import { buildSession, trimToMin, type SessionStep, type SessionMode } from "@/lib/session";

export async function GET(req: Request) {
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  const url = new URL(req.url);
  const mode: SessionMode = url.searchParams.get("mode") === "min" ? "min" : "full";

  try {
    const progress = await db.sessionProgress.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const planDay = getPlanDay(progress.planPosition);
    let steps = (progress.activeSession as SessionStep[] | null) ?? null;
    const hasPending = steps?.some((s) => s.status === "pending") ?? false;

    if (!steps || !hasPending) {
      // No live session: build a fresh one for the current queue position.
      const weakTag = await getNextTarget(userId);
      const dueCount = await db.flashcard.count({ where: { userId, dueAt: { lte: new Date() } } });
      steps = buildSession({ planDay, weakTag, hasDueCards: dueCount > 0, mode });
      await db.sessionProgress.update({
        where: { userId },
        data: { activeSession: steps, startedAt: new Date() },
      });
    } else if (mode === "min") {
      // Live session + explicit "10 min" request: trim remaining pending steps.
      steps = trimToMin(steps);
      if (steps.some((s) => s.status === "pending")) {
        await db.sessionProgress.update({ where: { userId }, data: { activeSession: steps } });
      } else {
        // All remaining pending steps were non-vocab/grammar and got dropped — session is complete.
        await db.sessionProgress.update({
          where: { userId },
          data: {
            planPosition: { increment: 1 },
            activeSession: Prisma.DbNull,
            lastCompletedAt: new Date(),
          },
        });
      }
    }

    return Response.json({
      day: planDay.day,
      theme: planDay.theme,
      isReview: planDay.isReview,
      steps,
      planPosition: progress.planPosition,
    });
  } catch (e) {
    console.error("GET /api/today failed:", e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
