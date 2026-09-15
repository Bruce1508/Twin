import { extractErrors, scoreRubric, type TaskType, type RubricResult } from "@/lib/extractor";
import { getTaxonomyEntry } from "@/lib/taxonomy";
import { db } from "@/lib/db";
import { recomputeProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const userId = user.id;

  let body: { content?: string; taskType?: string; prompt?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { content, taskType, prompt } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }
  if (!taskType || typeof taskType !== "string") {
    return Response.json({ error: "taskType is required" }, { status: 400 });
  }

  // ── LLM extraction + rubric (parallel) ────────────────────────────────────
  let extraction;
  let rubric: RubricResult | null = null;
  try {
    const [extractionResult, rubricResult] = await Promise.allSettled([
      extractErrors(content.trim(), taskType as TaskType, prompt),
      scoreRubric(content.trim(), taskType as TaskType, prompt),
    ]);
    if (extractionResult.status === "rejected") {
      console.error("Extraction failed:", extractionResult.reason);
      return Response.json({ error: "Extraction failed — check server logs" }, { status: 500 });
    }
    extraction = extractionResult.value;
    if (rubricResult.status === "fulfilled") rubric = rubricResult.value;
    else console.error("Rubric scoring failed (non-fatal):", rubricResult.reason);
  } catch (err) {
    console.error("Extraction failed:", err);
    return Response.json({ error: "Extraction failed — check server logs" }, { status: 500 });
  }

  // ── DB persistence ─────────────────────────────────────────────────────────
  // Wrapped in try/catch so LLM results are still returned if DB is not yet set up.
  let submissionId: string | null = null;
  try {
    const submission = await (db as any).submission.create({
      data: {
        userId,
        source: "free_practice",
        prompt: prompt ?? null,
        content: content.trim(),
        wordCount: extraction.metrics.word_count,
        metrics: extraction.metrics,
      },
    });
    submissionId = submission.id;

    const allErrors = [
      ...extraction.span_errors.map((e) => ({
        submissionId: submission.id,
        category: (getTaxonomyEntry(e.error_tag)?.category ?? "grammaire") as string,
        errorTag: e.error_tag,
        excerpt: e.excerpt,
        correction: e.correction,
        explanation: e.explanation,
      })),
      ...extraction.whole_text_observations.map((o) => ({
        submissionId: submission.id,
        category: (getTaxonomyEntry(o.error_tag)?.category ?? "grammaire") as string,
        errorTag: o.error_tag,
        excerpt: null,
        correction: o.explanation,
        explanation: o.evidence ?? o.explanation,
      })),
    ];

    if (allErrors.length > 0) {
      await (db as any).errorEvent.createMany({ data: allErrors });
    }

    // Recompute profile after every new submission (M3 hookup)
    await recomputeProfile(userId);
  } catch (err) {
    console.error("DB persistence failed (DB may not be configured yet):", err);
    // Return extraction results anyway so the UI works without DB
  }

  return Response.json({
    submissionId,
    persisted: submissionId !== null,
    extraction,
    rubric,
  });
}
