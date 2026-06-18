import { generateDrill, canRouteToDrill } from "@/lib/generator";
import { isValidTag } from "@/lib/taxonomy";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }
  const userId = process.env.DEV_USER_ID;
  if (!userId) {
    return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });
  }

  let body: { errorTag?: string; topic?: string; sourceErrorId?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { errorTag, topic, sourceErrorId } = body;
  if (!errorTag || !isValidTag(errorTag)) {
    return Response.json({ error: "Valid errorTag required" }, { status: 400 });
  }
  if (!canRouteToDrill(errorTag)) {
    return Response.json({ error: "Whole-text tags cannot be drilled with Reverse Tutor" }, { status: 400 });
  }

  let payload;
  try {
    payload = await generateDrill(errorTag as any, topic);
  } catch (err) {
    console.error("Drill generation failed:", err);
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }

  let drillId: string | null = null;
  try {
    const drill = await db.drill.create({
      data: { userId, type: "reverse_tutor", payload: payload as any, resolved: false, sourceErrorId: sourceErrorId ?? null },
    });
    drillId = drill.id;
  } catch (err) {
    console.error("DB persist failed:", err);
  }

  // Strip answer key — learner must not see is_faulty/correction before submitting
  const publicSentences = payload.sentences.map(({ id, text }) => ({ id, text }));
  return Response.json({ drillId, errorTag: payload.target_error_tag, topic: payload.topic, sentences: publicSentences });
}
