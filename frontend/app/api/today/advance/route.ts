import { db } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { advanceSession, type SessionStep } from "@/lib/session";

export async function POST() {
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  try {
    const progress = await db.sessionProgress.findUnique({ where: { userId } });
    const steps = (progress?.activeSession as SessionStep[] | null) ?? null;
    if (!steps) return Response.json({ completed: true, steps: [] });

    const { steps: next, completed } = advanceSession(steps);

    if (completed) {
      await db.sessionProgress.update({
        where: { userId },
        data: {
          planPosition: { increment: 1 }, // queue advances ONLY on completion
          activeSession: Prisma.DbNull,    // actually null the Json? column (undefined = no change)
          lastCompletedAt: new Date(),
        },
      });
    } else {
      await db.sessionProgress.update({ where: { userId }, data: { activeSession: next } });
    }

    return Response.json({ completed, steps: next });
  } catch (e) {
    console.error("POST /api/today/advance failed:", e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
