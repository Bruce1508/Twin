import { GoogleGenAI } from "@google/genai";
import { READING_TAGS } from "@/lib/taxonomy";

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuestionType =
  | "reperage"
  | "reformulation"
  | "inference"
  | "intention_auteur"
  | "attitude_opinion";

export interface ReadingQuestion {
  id: number;
  type: QuestionType;
  question: string;
  answer_key: string;
  relevant_passage: string;
}

export interface LearnerReadingAnswer {
  question_id: number;
  answer: string;
}

export interface QuestionGradingResult {
  question_id: number;
  correct: boolean;
  correction_quality: "correct" | "partial" | "wrong";
  comprehension_tag: string;
  feedback: string;
  relevant_passage: string;
}

export interface ReadingGradingResult {
  results: QuestionGradingResult[];
  summary: {
    accuracy: number;
    mastery_signal: "improving" | "mixed" | "still_struggling";
  };
}

export type ArticleRegister = "journalistique" | "litteraire" | "scientifique";

// ── Schemas ───────────────────────────────────────────────────────────────────

const questionSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id:               { type: "integer" },
          type:             { type: "string", enum: ["reperage", "reformulation", "inference", "intention_auteur", "attitude_opinion"] },
          question:         { type: "string" },
          answer_key:       { type: "string" },
          relevant_passage: { type: "string" },
        },
        required: ["id", "type", "question", "answer_key", "relevant_passage"],
      },
    },
  },
  required: ["questions"],
};

const gradingSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_id:        { type: "integer" },
          correct:            { type: "boolean" },
          correction_quality: { type: "string", enum: ["correct", "partial", "wrong"] },
          comprehension_tag:  { type: "string" },
          feedback:           { type: "string" },
          relevant_passage:   { type: "string" },
        },
        required: ["question_id", "correct", "correction_quality", "comprehension_tag", "feedback", "relevant_passage"],
      },
    },
    summary: {
      type: "object",
      properties: {
        accuracy:       { type: "number" },
        mastery_signal: { type: "string", enum: ["improving", "mixed", "still_struggling"] },
      },
      required: ["accuracy", "mastery_signal"],
    },
  },
  required: ["results", "summary"],
};

// ── Gemini calls ──────────────────────────────────────────────────────────────

export async function generateArticle(
  topic: string,
  register: ArticleRegister
): Promise<string> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: topic,
    config: {
      systemInstruction: `Tu es un rédacteur de textes pédagogiques pour apprenants de français B2.
Écris un article de 280 à 320 mots sur le sujet donné, en registre ${register}.
Format : prose continue, pas de titre, pas de liste, pas de sous-titres.
Niveau B2 : phrases complexes, connecteurs variés, vocabulaire précis mais accessible.
Retourne uniquement le texte de l'article, rien d'autre.`,
    },
  });
  return response.text!.trim();
}

export async function generateQuestions(
  articleText: string
): Promise<ReadingQuestion[]> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: articleText,
    config: {
      systemInstruction: `Tu es un créateur d'épreuves TCF Canada pour la compréhension écrite niveau B2.
Génère exactement 5 questions sur le texte, une par type dans cet ordre :
1. reperage — localiser une information explicite
2. reformulation — reconnaître une paraphrase
3. inference — déduire un sens implicite
4. intention_auteur — identifier l'objectif général du texte
5. attitude_opinion — identifier l'attitude de l'auteur

Pour chaque question :
- question : en français, claire, sans ambiguïté
- answer_key : réponse correcte en une à deux phrases
- relevant_passage : citation verbatim du texte qui justifie la réponse (max 40 mots)`,
      responseMimeType: "application/json",
      responseJsonSchema: questionSchema,
    },
  });
  const raw = JSON.parse(response.text!) as { questions: ReadingQuestion[] };
  return raw.questions;
}

export async function gradeAnswers(
  articleText: string,
  questions: ReadingQuestion[],
  learnerAnswers: LearnerReadingAnswer[]
): Promise<ReadingGradingResult> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const validTags = READING_TAGS.join(", ");

  const context = questions.map((q) => ({
    id: q.id,
    type: q.type,
    question: q.question,
    answer_key: q.answer_key,
    relevant_passage: q.relevant_passage,
    learner_answer: learnerAnswers.find((a) => a.question_id === q.id)?.answer ?? "",
  }));

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: JSON.stringify({ article: articleText, questions: context }),
    config: {
      systemInstruction: `Tu es un correcteur TCF Canada. Évalue les réponses d'un apprenant B2.

Pour chaque question :
- correct : true si la réponse est correcte ou très proche de la clé
- correction_quality : "correct" si juste (même formulée différemment), "partial" si partiellement juste, "wrong" si incorrecte
- comprehension_tag : type d'erreur parmi : ${validTags}. Même si correct=true, assigne le tag le plus pertinent.
- feedback : une phrase encourageante et précise
- relevant_passage : citation du texte qui justifie ton évaluation

Résumé :
- accuracy : fraction de questions avec correction_quality="correct" (0..1)
- mastery_signal : "improving" si accuracy ≥ 0.8, "still_struggling" si accuracy < 0.4, sinon "mixed"`,
      responseMimeType: "application/json",
      responseJsonSchema: gradingSchema,
    },
  });

  return JSON.parse(response.text!) as ReadingGradingResult;
}
