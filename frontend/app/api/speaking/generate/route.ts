import { generateSpeakingPrompt } from "@/lib/speaking";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const userId = user.id;

  let body: { topic?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const topic = body.topic?.trim();
  if (!topic) return Response.json({ error: "topic is required" }, { status: 400 });

  let prompt;
  try {
    prompt = await generateSpeakingPrompt(topic);
  } catch (err) {
    console.error("Prompt generation failed:", err);
    return Response.json({ error: "Prompt generation failed" }, { status: 500 });
  }

  let exerciseId: string | null = null;
  try {
    const exercise = await db.speakingExercise.create({
      data: {
        userId,
        topic,
        promptText: prompt.promptText,
        scenarioContext: prompt.scenarioContext,
      },
    });
    exerciseId = exercise.id;
  } catch (err) {
    console.error("DB persist failed:", err);
  }

  return Response.json({ exerciseId, promptText: prompt.promptText, scenarioContext: prompt.scenarioContext });
}
