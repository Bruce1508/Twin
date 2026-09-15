import { transcribeSpeech } from "@/lib/speaking";
import { db } from "@/lib/db";
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

  let body: { audioBase64?: string; mimeType?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.audioBase64 || !body.mimeType) {
    return Response.json({ error: "audioBase64 and mimeType are required" }, { status: 400 });
  }

  const ALLOWED_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"];
  if (!ALLOWED_MIME_TYPES.includes(body.mimeType)) {
    return Response.json({ error: "Unsupported audio format" }, { status: 400 });
  }

  let exercise: any;
  try {
    exercise = await db.speakingExercise.findUnique({ where: { id: exerciseId } });
  } catch {
    return Response.json({ error: "DB not configured" }, { status: 503 });
  }
  if (!exercise) return Response.json({ error: "Exercise not found" }, { status: 404 });
  if (exercise.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  let transcript: string;
  try {
    transcript = await transcribeSpeech(body.audioBase64, body.mimeType);
  } catch (err) {
    console.error("Transcription failed:", err);
    return Response.json({ error: "Transcription failed" }, { status: 500 });
  }

  try {
    await db.speakingExercise.update({
      where: { id: exerciseId },
      data: { transcriptText: transcript },
    });
  } catch (err) {
    console.error("DB update failed (non-fatal):", err);
  }

  return Response.json({ transcript });
}
