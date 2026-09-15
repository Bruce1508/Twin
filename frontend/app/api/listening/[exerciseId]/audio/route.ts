import { generateAudio } from "@/lib/listening";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  const { exerciseId } = await params;
  if (!process.env.GEMINI_API_KEY) {
    return new Response("GEMINI_API_KEY not configured", { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return new Response("Authentication required", { status: 401 });
  const userId = user.id;

  let exercise: any;
  try {
    exercise = await db.listeningExercise.findUnique({ where: { id: exerciseId } });
  } catch {
    return new Response("DB not configured", { status: 503 });
  }
  if (!exercise) return new Response("Exercise not found", { status: 404 });
  if (exercise.userId !== userId) return new Response("Forbidden", { status: 403 });

  let audioBuffer: Buffer;
  try {
    audioBuffer = await generateAudio(exercise.passageText);
  } catch (err) {
    console.error("TTS generation failed:", err);
    return new Response("Audio generation failed", { status: 500 });
  }

  return new Response(new Uint8Array(audioBuffer), {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": audioBuffer.length.toString(),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
