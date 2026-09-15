import { gradeAnswers, type LearnerListeningAnswer, type ListeningQuestion } from "@/lib/listening";
import { db } from "@/lib/db";
import { recomputeProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  const { exerciseId } = await params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const userId = user.id;

  let body: { answers: LearnerListeningAnswer[] };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  let exercise: any;
  try {
    exercise = await db.listeningExercise.findUnique({ where: { id: exerciseId } });
  } catch {
    return Response.json({ error: "DB not configured" }, { status: 503 });
  }
  if (!exercise) return Response.json({ error: "Exercise not found" }, { status: 404 });
  if (exercise.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const questions = exercise.questions as ListeningQuestion[];
  const grading = gradeAnswers(questions, body.answers);

  try {
    const submission = await db.submission.create({
      data: {
        userId,
        source: "listening_exercise",
        prompt: exercise.passageText,
        content: body.answers.map((a) => `Q${a.question_id}:${a.choice}`).join(" "),
        wordCount: body.answers.length,
        metrics: {
          question_count: questions.length,
          accuracy: grading.summary.accuracy,
          mastery_signal: grading.summary.mastery_signal,
        } as any,
      },
    });

    await db.listeningExercise.update({
      where: { id: exerciseId },
      data: { submissionId: submission.id },
    });

    const errorRows = grading.results
      .filter((r) => !r.correct)
      .map((r) => ({
        submissionId: submission.id,
        category: "comprehension" as const,
        errorTag: r.listening_tag,
        excerpt: null,
        correction: `Réponse correcte : ${r.answer_key}. ${r.explanation}`,
        explanation: r.explanation,
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
