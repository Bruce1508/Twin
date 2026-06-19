import { GoogleGenAI } from "@google/genai";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PassageType = "dialogue" | "monologue";

export type ListeningQuestionType =
  | "reperage"
  | "inference"
  | "attitude_locuteur"
  | "reformulation"
  | "idee_principale";

export interface MCQChoices {
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface ListeningQuestion {
  id: number;
  type: ListeningQuestionType;
  question: string;
  choices: MCQChoices;
  answer_key: "A" | "B" | "C" | "D"; // server-side only
  explanation: string;
}

export type LearnerChoice = "A" | "B" | "C" | "D";

export interface LearnerListeningAnswer {
  question_id: number;
  choice: LearnerChoice;
}

export interface ListeningCriterionResult {
  question_id: number;
  question: string;
  choices: MCQChoices;
  learner_choice: LearnerChoice | null;
  answer_key: LearnerChoice;
  correct: boolean;
  explanation: string;
  listening_tag: string;
}

export interface ListeningGradingResult {
  results: ListeningCriterionResult[];
  summary: {
    accuracy: number;
    mastery_signal: "improving" | "mixed" | "still_struggling";
  };
}

// Maps question type → listening error tag (no Gemini call needed for MCQ grading)
const TYPE_TO_TAG: Record<ListeningQuestionType, string> = {
  reperage:          "ecoute_information_explicite",
  inference:         "ecoute_inference",
  attitude_locuteur: "ecoute_attitude_locuteur",
  reformulation:     "ecoute_reformulation",
  idee_principale:   "ecoute_idee_principale",
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const questionSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id:          { type: "integer" },
          type:        { type: "string", enum: ["reperage", "inference", "attitude_locuteur", "reformulation", "idee_principale"] },
          question:    { type: "string" },
          choices:     {
            type: "object",
            properties: {
              A: { type: "string" }, B: { type: "string" },
              C: { type: "string" }, D: { type: "string" },
            },
            required: ["A", "B", "C", "D"],
          },
          answer_key:  { type: "string", enum: ["A", "B", "C", "D"] },
          explanation: { type: "string" },
        },
        required: ["id", "type", "question", "choices", "answer_key", "explanation"],
      },
    },
  },
  required: ["questions"],
};

// ── Gemini calls ──────────────────────────────────────────────────────────────

export async function generatePassage(
  topic: string,
  passageType: PassageType
): Promise<string> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: topic,
    config: {
      systemInstruction: passageType === "dialogue"
        ? `Tu es un créateur de documents audio pédagogiques pour apprenants de français B2.
Écris un dialogue entre deux personnes (A et B) de 220 à 260 mots sur le sujet donné.
Format : chaque réplique commence par "A :" ou "B :". Registre oral naturel B2.
Le dialogue doit aborder le sujet avec des opinions et arguments substantiels.
Retourne uniquement le texte du dialogue, rien d'autre.`
        : `Tu es un créateur de documents audio pédagogiques pour apprenants de français B2.
Écris un monologue de 220 à 260 mots sur le sujet donné.
Registre oral naturel B2 avec une structure claire : introduction, développement, conclusion.
Retourne uniquement le texte du monologue, rien d'autre.`,
    },
  });
  return response.text!.trim();
}

export async function generateQuestions(
  passageText: string
): Promise<ListeningQuestion[]> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: passageText,
    config: {
      systemInstruction: `Tu es un créateur d'épreuves TCF Canada pour la compréhension orale niveau B2.
Génère exactement 5 questions QCM sur ce passage oral, une par type dans cet ordre :
1. reperage — repérer une information explicite
2. inference — déduire un sens implicite
3. attitude_locuteur — identifier l'attitude ou le ton du locuteur
4. reformulation — reconnaître une paraphrase d'un élément du passage
5. idee_principale — identifier l'idée principale ou l'intention générale

Pour chaque question :
- question : formulation claire, en français
- choices : 4 options plausibles (A, B, C, D), une seule correcte
- answer_key : la lettre correcte
- explanation : une phrase expliquant pourquoi la réponse est correcte`,
      responseMimeType: "application/json",
      responseJsonSchema: questionSchema,
    },
  });
  const raw = JSON.parse(response.text!) as { questions: ListeningQuestion[] };
  return raw.questions;
}

// Returns WAV audio bytes — Gemini TTS returns raw PCM, wrapped with WAV header
export async function generateAudio(passageText: string): Promise<Buffer> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: passageText,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Aoede" },
        },
      },
    } as any,
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) throw new Error("No audio data in Gemini TTS response");

  const pcmBuffer = Buffer.from(part.inlineData.data, "base64");
  return pcmToWav(pcmBuffer);
}

// Pure TypeScript MCQ grading — no LLM call
export function gradeAnswers(
  questions: ListeningQuestion[],
  learnerAnswers: LearnerListeningAnswer[]
): ListeningGradingResult {
  const results: ListeningCriterionResult[] = questions.map((q) => {
    const learnerChoice = learnerAnswers.find((a) => a.question_id === q.id)?.choice ?? null;
    const correct = learnerChoice === q.answer_key;
    return {
      question_id: q.id,
      question: q.question,
      choices: q.choices,
      learner_choice: learnerChoice,
      answer_key: q.answer_key,
      correct,
      explanation: q.explanation,
      listening_tag: TYPE_TO_TAG[q.type] ?? "ecoute_information_explicite",
    };
  });

  const accuracy = results.filter((r) => r.correct).length / questions.length;
  const mastery_signal =
    accuracy >= 0.8 ? "improving" : accuracy < 0.4 ? "still_struggling" : "mixed";

  return { results, summary: { accuracy, mastery_signal } };
}

// ── WAV header ────────────────────────────────────────────────────────────────

function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}
