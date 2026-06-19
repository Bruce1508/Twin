import { generatePassage, generateQuestions, type PassageType } from "@/lib/listening";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  let body: { topic?: string; passageType?: PassageType };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const topic = body.topic?.trim();
  const passageType = body.passageType ?? "dialogue";
  if (!topic) return Response.json({ error: "topic is required" }, { status: 400 });
  if (!["dialogue", "monologue"].includes(passageType)) {
    return Response.json({ error: "passageType must be dialogue or monologue" }, { status: 400 });
  }

  let passageText: string;
  try {
    passageText = await generatePassage(topic, passageType);
  } catch (err) {
    console.error("Passage generation failed:", err);
    return Response.json({ error: "Passage generation failed" }, { status: 500 });
  }

  let questions;
  try {
    questions = await generateQuestions(passageText);
  } catch (err) {
    console.error("Question generation failed:", err);
    return Response.json({ error: "Question generation failed" }, { status: 500 });
  }

  let exerciseId: string | null = null;
  try {
    const exercise = await db.listeningExercise.create({
      data: { userId, passageText, topic, passageType, questions: questions as any },
    });
    exerciseId = exercise.id;
  } catch (err) {
    console.error("DB persist failed:", err);
  }

  if (!exerciseId) return Response.json({ error: "Failed to create exercise" }, { status: 500 });

  // Strip answer keys before sending to client
  const publicQuestions = questions.map(({ id, type, question, choices }) => ({ id, type, question, choices }));
  return Response.json({ exerciseId, passageText, passageType, questions: publicQuestions });
}
