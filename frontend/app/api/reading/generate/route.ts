import { generateArticle, generateQuestions, type ArticleRegister } from "@/lib/reading";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  const userId = process.env.DEV_USER_ID;
  if (!userId) {
    return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });
  }

  let body: {
    articleText?: string;
    topic?: string;
    articleSource: "pasted" | "generated";
    register?: ArticleRegister;
  };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { articleSource, register = "journalistique" } = body;
  let articleText = body.articleText?.trim() ?? "";

  if (articleSource === "generated") {
    const topic = body.topic?.trim();
    if (!topic) return Response.json({ error: "topic required for generated articles" }, { status: 400 });
    try {
      articleText = await generateArticle(topic, register);
    } catch (err) {
      console.error("Article generation failed:", err);
      return Response.json({ error: "Article generation failed" }, { status: 500 });
    }
  }

  if (!articleText) return Response.json({ error: "articleText is required" }, { status: 400 });

  let questions;
  try {
    questions = await generateQuestions(articleText);
  } catch (err) {
    console.error("Question generation failed:", err);
    return Response.json({ error: "Question generation failed" }, { status: 500 });
  }

  // Persist exercise (with answer keys stored server-side only)
  let exerciseId: string | null = null;
  try {
    const exercise = await db.readingExercise.create({
      data: { userId, articleText, topic: body.topic ?? null, articleSource, questions: questions as any },
    });
    exerciseId = exercise.id;
  } catch (err) {
    console.error("DB persist failed:", err);
  }

  // Strip answer keys before sending to client
  const publicQuestions = questions.map(({ id, type, question }) => ({ id, type, question }));
  return Response.json({ exerciseId, articleText, questions: publicQuestions });
}
