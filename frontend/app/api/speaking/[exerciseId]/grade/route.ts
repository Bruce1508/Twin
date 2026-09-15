import { gradeSpeech } from "@/lib/speaking";
import { db } from "@/lib/db";
import { recomputeProfile } from "@/lib/profile";
import { getTaxonomyEntry } from "@/lib/taxonomy";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  const { exerciseId } = await params;
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const userId = user.id;

  let body: { transcript?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const transcript = body.transcript?.trim();
  if (!transcript) return Response.json({ error: "transcript is required" }, { status: 400 });

  let exercise: any;
  try {
    exercise = await db.speakingExercise.findUnique({ where: { id: exerciseId } });
  } catch {
    return Response.json({ error: "DB not configured" }, { status: 503 });
  }
  if (!exercise) return Response.json({ error: "Exercise not found" }, { status: 404 });
  if (exercise.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  let grading;
  try {
    grading = await gradeSpeech(exercise.promptText, exercise.scenarioContext, transcript);
  } catch (err) {
    console.error("Grading failed:", err);
    return Response.json({ error: "Grading failed" }, { status: 500 });
  }

  // Persist Submission + ErrorEvents + link exercise (closes the loop)
  try {
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;

    const submission = await db.submission.create({
      data: {
        userId,
        source: "speaking_exercise",
        prompt: exercise.promptText,
        content: transcript,
        wordCount,
        metrics: {
          total_score: grading.summary.total_score,
          mastery_signal: grading.summary.mastery_signal,
        } as any,
      },
    });

    await db.speakingExercise.update({
      where: { id: exerciseId },
      data: { submissionId: submission.id, grading: grading as any },
    });

    type ErrCat = "grammaire" | "lexique" | "orthographe" | "syntaxe" | "registre" | "comprehension";
    const errorRows = grading.criteria
      .filter((r) => r.score <= 2)
      .map((r) => ({
        submissionId: submission.id,
        category: (getTaxonomyEntry(r.error_tag)?.category ?? "grammaire") as ErrCat,
        errorTag: r.error_tag,
        excerpt: r.excerpt ?? null,
        correction: r.feedback,
        explanation: r.feedback,
      }));

    if (errorRows.length > 0) {
      await db.errorEvent.createMany({ data: errorRows });
    }

    await recomputeProfile(userId);
  } catch (err) {
    console.error("DB persist failed (non-fatal):", err);
  }

  return Response.json({ grading });
}
