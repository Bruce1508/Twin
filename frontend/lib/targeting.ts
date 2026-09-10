import { db } from "@/lib/db";
import { type ErrorTag } from "@/lib/taxonomy";
import { canRouteToDrill } from "@/lib/generator";

export type MasterySignal = "improving" | "mixed" | "still_struggling";

// Fixed spaced-repetition ladder, in days, indexed by consecutiveImproving.
export const LADDER_DAYS = [1, 3, 7, 14, 30] as const;

export function nextSchedule(
  currentStreak: number,
  signal: MasterySignal,
  now: Date
): { consecutiveImproving: number; dueAt: Date } {
  let consecutiveImproving: number;
  if (signal === "improving") {
    consecutiveImproving = Math.min(currentStreak + 1, LADDER_DAYS.length - 1);
  } else if (signal === "still_struggling") {
    consecutiveImproving = 0;
  } else {
    consecutiveImproving = currentStreak;
  }
  const days = LADDER_DAYS[consecutiveImproving];
  const dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return { consecutiveImproving, dueAt };
}

export function selectDueCandidate(
  freq: Record<string, number>,
  dueMap: Map<string, Date>,
  now: Date
): ErrorTag | null {
  const candidate = Object.entries(freq)
    .filter(([tag]) => {
      if (!canRouteToDrill(tag) || tag === "uncategorized") return false;
      const dueAt = dueMap.get(tag);
      return !dueAt || dueAt <= now;
    })
    .sort(([, a], [, b]) => b - a)[0];

  return (candidate?.[0] as ErrorTag) ?? null;
}

// Explicit, deterministic targeting rule (M5 — NOT an agent).
// Selects the highest-frequency error_tag that:
//   1. Is not a whole-text-only tag (Reverse Tutor cannot handle those)
//   2. Is not yet resolved
export async function getNextTarget(userId: string): Promise<ErrorTag | null> {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const freq = (profile.errorFrequencies as Record<string, number>) ?? {};

  const schedules = await db.tagSchedule.findMany({ where: { userId } });
  const dueMap = new Map(schedules.map((s) => [s.errorTag, s.dueAt]));

  return selectDueCandidate(freq, dueMap, new Date());
}

// N consecutive "improving" signals required before a tag is marked resolved.
// Deliberately conservative — never on a single drill (Spec B.4 + M5).
const MASTERY_THRESHOLD = 3;

export async function updateMasterySignal(
  drillId: string,
  userId: string,
  errorTag: string,
  signal: MasterySignal
): Promise<void> {
  // Store signal on this drill's payload
  const current = await db.drill.findUnique({ where: { id: drillId } });
  if (current) {
    const payload = (current.payload as any) ?? {};
    await db.drill.update({
      where: { id: drillId },
      data: { payload: { ...payload, last_mastery_signal: signal } },
    });
  }

  const now = new Date();
  const existing = await db.tagSchedule.findUnique({
    where: { userId_errorTag: { userId, errorTag } },
  });
  const { consecutiveImproving, dueAt } = nextSchedule(
    existing?.consecutiveImproving ?? 0,
    signal,
    now
  );
  await db.tagSchedule.upsert({
    where: { userId_errorTag: { userId, errorTag } },
    create: { userId, errorTag, consecutiveImproving, dueAt, lastDrilledAt: now },
    update: { consecutiveImproving, dueAt, lastDrilledAt: now },
  });

  if (signal !== "improving") return;

  // Check if last N drills for this tag all have "improving"
  const recent = await db.drill.findMany({
    where: { userId, sourceError: { errorTag } },
    orderBy: { createdAt: "desc" },
    take: MASTERY_THRESHOLD,
    select: { payload: true },
  });

  const allImproving =
    recent.length >= MASTERY_THRESHOLD &&
    recent.every((d: any) => (d.payload as any)?.last_mastery_signal === "improving");

  if (allImproving) {
    await db.drill.updateMany({
      where: { userId, sourceError: { errorTag } },
      data: { resolved: true },
    });
  }
}
