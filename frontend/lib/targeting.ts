import { db } from "@/lib/db";
import { type ErrorTag } from "@/lib/taxonomy";
import { canRouteToDrill } from "@/lib/generator";

// Explicit, deterministic targeting rule (M5 — NOT an agent).
// Selects the highest-frequency error_tag that:
//   1. Is not a whole-text-only tag (Reverse Tutor cannot handle those)
//   2. Is not yet resolved
export async function getNextTarget(userId: string): Promise<ErrorTag | null> {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const freq = (profile.errorFrequencies as Record<string, number>) ?? {};

  const resolvedDrills = await db.drill.findMany({
    where: { userId, resolved: true },
    select: { sourceError: { select: { errorTag: true } } },
  });
  const resolvedTags = new Set(
    resolvedDrills.map((d: any) => d.sourceError?.errorTag).filter(Boolean)
  );

  const candidate = Object.entries(freq)
    .filter(([tag]) => canRouteToDrill(tag) && !resolvedTags.has(tag) && tag !== "uncategorized")
    .sort(([, a], [, b]) => b - a)[0];

  return (candidate?.[0] as ErrorTag) ?? null;
}

// N consecutive "improving" signals required before a tag is marked resolved.
// Deliberately conservative — never on a single drill (Spec B.4 + M5).
const MASTERY_THRESHOLD = 3;

export async function updateMasterySignal(
  drillId: string,
  userId: string,
  errorTag: string,
  signal: "improving" | "mixed" | "still_struggling"
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
