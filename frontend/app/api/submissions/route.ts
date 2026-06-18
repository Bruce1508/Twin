import { extractErrors, type TaskType } from "@/lib/extractor";
import { getTaxonomyEntry } from "@/lib/taxonomy";
import { db } from "@/lib/db";
import { recomputeProfile } from "@/lib/profile";

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const userId = process.env.DEV_USER_ID;
  if (!userId) {
    return Response.json(
      { error: "DEV_USER_ID is not configured — run prisma db seed first" },
      { status: 503 }
    );
  }

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

  // ── LLM extraction ─────────────────────────────────────────────────────────
  let extraction;
  try {
    extraction = await extractErrors(
      content.trim(),
      taskType as TaskType,
      prompt
    );
  } catch (err) {
    console.error("Extraction failed:", err);
    return Response.json(
      { error: "Extraction failed — check server logs" },
      { status: 500 }
    );
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
  });
}
