import { gradeAnswers, type LearnerReadingAnswer, type ReadingQuestion } from "@/lib/reading";
import { db } from "@/lib/db";
import { recomputeProfile } from "@/lib/profile";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  const { exerciseId } = await params;
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  let body: { answers: LearnerReadingAnswer[] };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  let exercise: any;
  try {
    exercise = await db.readingExercise.findUnique({ where: { id: exerciseId } });
  } catch {
    return Response.json({ error: "DB not configured" }, { status: 503 });
  }
  if (!exercise) return Response.json({ error: "Exercise not found" }, { status: 404 });
  if (exercise.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const questions = exercise.questions as ReadingQuestion[];

  let grading;
  try {
    grading = await gradeAnswers(exercise.articleText, questions, body.answers);
  } catch (err) {
    console.error("Grading failed:", err);
    return Response.json({ error: "Grading failed" }, { status: 500 });
  }

  // Persist Submission + ErrorEvents + link exercise (closes the loop)
  try {
    const answerText = body.answers.map((a) => a.answer).filter(Boolean).join(" ");
    const wordCount = answerText.split(/\s+/).filter(Boolean).length;

    const submission = await db.submission.create({
      data: {
        userId,
        source: "reading_exercise",
        prompt: exercise.articleText,
        content: answerText,
        wordCount,
        metrics: {
          question_count: questions.length,
          accuracy: grading.summary.accuracy,
          mastery_signal: grading.summary.mastery_signal,
        } as any,
      },
    });

    await db.readingExercise.update({
      where: { id: exerciseId },
      data: { submissionId: submission.id },
    });

    const errorRows = grading.results
      .filter((r) => r.correction_quality !== "correct")
      .map((r) => ({
        submissionId: submission.id,
        category: "comprehension" as const,
        errorTag: r.comprehension_tag,
        excerpt: r.relevant_passage,
        correction: questions.find((q) => q.id === r.question_id)?.answer_key ?? "",
        explanation: r.feedback,
      }));

    if (errorRows.length > 0) {
      await db.errorEvent.createMany({ data: errorRows });
    }

    await recomputeProfile(userId);
  } catch (err) {
    console.error("DB persist failed (non-fatal):", err);
  }

  // Attach question text + answer key to each result for display
  const enrichedResults = grading.results.map((r) => ({
    ...r,
    question: questions.find((q) => q.id === r.question_id)?.question ?? "",
    answer_key: questions.find((q) => q.id === r.question_id)?.answer_key ?? "",
  }));

  return Response.json({ grading: { ...grading, results: enrichedResults } });
}
