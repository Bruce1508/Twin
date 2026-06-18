import { db } from "@/lib/db";
import { WHOLE_TEXT_TAGS } from "@/lib/taxonomy";

export interface ComplexityPoint {
  submissionId: string;
  date: string;
  avgSentenceLength: number;
  lexicalDiversity: number;
  wordCount: number;
}

export interface ComputedProfile {
  errorFrequencies: Record<string, number>;
  knownVocab: number;
  complexityTrend: ComplexityPoint[];
  computedAt: Date;
}

// Pure recomputation from events — safe to call repeatedly on same data.
// Never reads from Profile; always derives fresh from Submission + ErrorEvent rows.
export async function recomputeProfile(userId: string): Promise<void> {
  const submissions = await db.submission.findMany({
    where: { userId },
    include: { errorEvents: true },
    orderBy: { createdAt: "asc" },
  });

  const errorFrequencies: Record<string, number> = {};
  for (const sub of submissions) {
    for (const err of sub.errorEvents) {
      errorFrequencies[err.errorTag] = (errorFrequencies[err.errorTag] ?? 0) + 1;
    }
  }

  const complexityTrend: ComplexityPoint[] = submissions.map((sub: any) => {
    const m = (sub.metrics ?? {}) as Record<string, number>;
    return {
      submissionId: sub.id,
      date: sub.createdAt.toISOString(),
      avgSentenceLength: m.avg_sentence_length ?? 0,
      lexicalDiversity: m.lexical_diversity ?? 0,
      wordCount: sub.wordCount,
    };
  });

  const knownVocab =
    submissions.length === 0
      ? 0
      : Math.round(
          complexityTrend.reduce(
            (sum, p) => sum + p.lexicalDiversity * p.wordCount,
            0
          ) / submissions.length
        );

  await db.profile.upsert({
    where: { userId },
    update: { errorFrequencies, knownVocab, complexityTrend: complexityTrend as any },
    create: { userId, errorFrequencies, knownVocab, complexityTrend: complexityTrend as any },
  });
}

export async function getProfile(userId: string): Promise<ComputedProfile | null> {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return null;
  return {
    errorFrequencies: (profile.errorFrequencies as Record<string, number>) ?? {},
    knownVocab: profile.knownVocab,
    complexityTrend: (profile.complexityTrend as unknown as ComplexityPoint[]) ?? [],
    computedAt: profile.computedAt,
  };
}

export function topSpanTags(
  freq: Record<string, number>,
  n = 10
): { tag: string; count: number }[] {
  return Object.entries(freq)
    .filter(([tag]) => !WHOLE_TEXT_TAGS.includes(tag as never))
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([tag, count]) => ({ tag, count }));
}
