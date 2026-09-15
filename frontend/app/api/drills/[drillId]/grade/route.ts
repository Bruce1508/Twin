import { gradeDrill, type LearnerAnswer, type DrillPayload } from "@/lib/generator";
import { db } from "@/lib/db";
import { recomputeProfile } from "@/lib/profile";
import { updateMasterySignal } from "@/lib/targeting";
import { extractErrors } from "@/lib/extractor";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ drillId: string }> }
) {
  const { drillId } = await params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const userId = user.id;

  let body: { answers: LearnerAnswer[]; correctionText?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  let drill: any;
  try {
    drill = await db.drill.findUnique({ where: { id: drillId } });
  } catch {
    return Response.json({ error: "DB not configured" }, { status: 503 });
  }
  if (!drill) return Response.json({ error: "Drill not found" }, { status: 404 });
  if (drill.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const payload = drill.payload as DrillPayload;

  let grading;
  try {
    grading = await gradeDrill(payload, body.answers);
  } catch (err) {
    console.error("Grading failed:", err);
    return Response.json({ error: "Grading failed" }, { status: 500 });
  }

  // Close the loop: learner's written correction becomes a new Submission (PRD Principle 3)
  if (body.correctionText?.trim() && process.env.GEMINI_API_KEY) {
    try {
      const extraction = await extractErrors(body.correctionText.trim(), "free_writing");
      const sub = await db.submission.create({
        data: {
          userId,
          source: "drill_response",
          prompt: `Reverse Tutor — tag: ${payload.target_error_tag}`,
          content: body.correctionText.trim(),
          wordCount: extraction.metrics.word_count,
          metrics: extraction.metrics as any,
        },
      });
      await db.drill.update({ where: { id: drillId }, data: { responseSubmissionId: sub.id } });
      const spanErrors = extraction.span_errors.map((e) => ({
        submissionId: sub.id,
        category: "grammaire" as const,
        errorTag: e.error_tag,
        excerpt: e.excerpt,
        correction: e.correction,
        explanation: e.explanation,
      }));
      if (spanErrors.length > 0) await db.errorEvent.createMany({ data: spanErrors });
      await recomputeProfile(userId);
    } catch (err) {
      console.error("Loop closure failed (non-fatal):", err);
    }
  }

  try {
    await updateMasterySignal(drillId, userId, payload.target_error_tag, grading.summary.tag_mastery_signal);
  } catch (err) {
    console.error("Mastery update failed:", err);
  }

  return Response.json({ grading, errorTag: payload.target_error_tag });
}
