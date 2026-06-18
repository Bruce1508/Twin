import { GoogleGenAI } from "@google/genai";
import { getTaxonomyEntry, WHOLE_TEXT_TAGS, READING_TAGS, type ErrorTag } from "@/lib/taxonomy";

// ── Types (Spec B.3 + B.4) ───────────────────────────────────────────────────

export interface DrillSentence {
  id: number;
  text: string;
  is_faulty: boolean;
  error_span: string | null;
  correction: string | null;
  explanation: string | null;
}

export interface DrillPayload {
  target_error_tag: string;
  topic: string;
  sentences: DrillSentence[];
}

export interface LearnerAnswer {
  sentence_id: number;
  flagged_faulty: boolean;
  correction?: string;
}

export interface SentenceResult {
  sentence_id: number;
  learner_flagged_faulty: boolean;
  correctly_identified: boolean;
  correction_quality: "correct" | "partial" | "wrong" | "not_applicable";
  feedback: string;
}

export interface GradingResult {
  results: SentenceResult[];
  summary: {
    detection_accuracy: number;
    correction_accuracy: number;
    tag_mastery_signal: "improving" | "mixed" | "still_struggling";
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function canRouteToDrill(tag: string): boolean {
  return (
    !WHOLE_TEXT_TAGS.includes(tag as never) &&
    !READING_TAGS.includes(tag as never)
  );
}

// ── Prompt builders ───────────────────────────────────────────────────────────

const DRILL_COUNT = 6;
const FAULTY_COUNT = 3;

function buildGeneratorPrompt(errorTag: ErrorTag, topic?: string): string {
  const entry = getTaxonomyEntry(errorTag);
  return `You are a French teacher creating a diagnostic exercise for a B1–B2 learner. The learner's role is REVERSED: they find and correct errors YOU deliberately plant.

**Target error type:**
- Tag: ${errorTag}
- Definition: ${entry?.gloss ?? ""}
- Example: ${entry?.example ?? ""}

Write ${DRILL_COUNT} French sentences on the topic: ${topic ?? "la vie quotidienne en ville"}.
Exactly ${FAULTY_COUNT} must contain the target error — and ONLY that error. The other ${DRILL_COUNT - FAULTY_COUNT} must be completely correct.
Fill the answer key for each sentence.

**Absolute rules:**
- Planted errors must be NATURAL and SUBTLE — the kind a real B1–B2 learner makes.
- "Correct" sentences must be unambiguously correct B2 French.
- Do NOT introduce any other error. Proofread every sentence.
- Vary structure and vocabulary. B1–B2 complexity.`;
}

function buildGradingPrompt(): string {
  return `Grade a learner's Reverse Tutor exercise. They identified which sentences were faulty and corrected them.

Per sentence:
- correctly_identified: true if their judgment matches the key
- correction_quality: "correct" if their fix works (even worded differently), "partial", "wrong", or "not_applicable" if the sentence was correct
- feedback: one encouraging, specific sentence

Summary:
- detection_accuracy: fraction correctly judged (0..1)
- correction_accuracy: of faulty ones caught, fraction corrected well (0..1)
- tag_mastery_signal: "improving" if detection ≥ 0.8 and correction ≥ 0.7, "still_struggling" if detection < 0.5, else "mixed"`;
}

// ── Output schemas ────────────────────────────────────────────────────────────

const drillSchema = {
  type: "object",
  properties: {
    target_error_tag: { type: "string" },
    topic: { type: "string" },
    sentences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id:          { type: "integer" },
          text:        { type: "string" },
          is_faulty:   { type: "boolean" },
          error_span:  { type: "string" },
          correction:  { type: "string" },
          explanation: { type: "string" },
        },
        required: ["id", "text", "is_faulty"],
      },
    },
  },
  required: ["target_error_tag", "topic", "sentences"],
};

const gradingSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sentence_id:            { type: "integer" },
          learner_flagged_faulty: { type: "boolean" },
          correctly_identified:   { type: "boolean" },
          correction_quality:     { type: "string", enum: ["correct", "partial", "wrong", "not_applicable"] },
          feedback:               { type: "string" },
        },
        required: ["sentence_id", "learner_flagged_faulty", "correctly_identified", "correction_quality", "feedback"],
      },
    },
    summary: {
      type: "object",
      properties: {
        detection_accuracy:  { type: "number" },
        correction_accuracy: { type: "number" },
        tag_mastery_signal:  { type: "string", enum: ["improving", "mixed", "still_struggling"] },
      },
      required: ["detection_accuracy", "correction_accuracy", "tag_mastery_signal"],
    },
  },
  required: ["results", "summary"],
};

// ── Verification pass (Spec B.5) ──────────────────────────────────────────────

async function verifyNoUnintendedErrors(sentences: DrillSentence[]): Promise<boolean> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const correct = sentences.filter((s) => !s.is_faulty).map((s) => s.text);
  if (correct.length === 0) return true;
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Do any of these French sentences contain a grammatical, lexical, spelling, or register error? Answer ONLY "yes" or "no".\n\n${correct.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
  });
  return !response.text?.toLowerCase().startsWith("yes");
}

// ── Main API ──────────────────────────────────────────────────────────────────

export async function generateDrill(
  errorTag: ErrorTag,
  topic?: string,
  maxRetries = 2
): Promise<DrillPayload> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Create the drill.",
      config: {
        systemInstruction: buildGeneratorPrompt(errorTag, topic),
        responseMimeType: "application/json",
        responseJsonSchema: drillSchema,
      },
    });
    const payload = JSON.parse(response.text!) as DrillPayload;
    const clean = await verifyNoUnintendedErrors(payload.sentences);
    if (clean) return payload;
  }
  throw new Error("Generator: could not produce a clean drill after retries");
}

export async function gradeDrill(
  payload: DrillPayload,
  answers: LearnerAnswer[]
): Promise<GradingResult> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const context = payload.sentences.map((s) => ({
    id: s.id,
    text: s.text,
    is_faulty: s.is_faulty,
    key_correction: s.correction,
    learner_flagged_faulty: answers.find((a) => a.sentence_id === s.id)?.flagged_faulty ?? false,
    learner_correction: answers.find((a) => a.sentence_id === s.id)?.correction ?? null,
  }));

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: JSON.stringify(context),
    config: {
      systemInstruction: buildGradingPrompt(),
      responseMimeType: "application/json",
      responseJsonSchema: gradingSchema,
    },
  });

  return JSON.parse(response.text!) as GradingResult;
}
