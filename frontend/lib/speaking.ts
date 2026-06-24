import { GoogleGenAI } from "@google/genai";
import { SPEAKING_TAGS, SPAN_TAGS, getTaxonomyEntry } from "@/lib/taxonomy";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SpeakingCriterion =
  | "pertinence"
  | "coherence"
  | "lexique"
  | "grammaire"
  | "registre";

export interface SpeakingPrompt {
  promptText: string;
  scenarioContext: string;
}

export interface SpeakingCriterionResult {
  criterion: SpeakingCriterion;
  score: number; // 0–4
  feedback: string;
  error_tag: string;
  excerpt?: string; // null for wholeTextOnly tags
}

export interface SpeakingGradingResult {
  criteria: SpeakingCriterionResult[];
  summary: {
    total_score: number; // 0–20
    mastery_signal: "improving" | "mixed" | "still_struggling";
    overall_feedback: string;
  };
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const promptSchema = {
  type: "object",
  properties: {
    promptText:      { type: "string" },
    scenarioContext: { type: "string" },
  },
  required: ["promptText", "scenarioContext"],
};

const gradingSchema = {
  type: "object",
  properties: {
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion: { type: "string", enum: ["pertinence", "coherence", "lexique", "grammaire", "registre"] },
          score:     { type: "integer" },
          feedback:  { type: "string" },
          error_tag: { type: "string" },
          excerpt:   { type: "string" },
        },
        required: ["criterion", "score", "feedback", "error_tag"],
      },
    },
    summary: {
      type: "object",
      properties: {
        total_score:      { type: "integer" },
        mastery_signal:   { type: "string", enum: ["improving", "mixed", "still_struggling"] },
        overall_feedback: { type: "string" },
      },
      required: ["total_score", "mastery_signal", "overall_feedback"],
    },
  },
  required: ["criteria", "summary"],
};

// ── Gemini calls ──────────────────────────────────────────────────────────────

export async function generateSpeakingPrompt(
  topic: string
): Promise<SpeakingPrompt> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: topic,
    config: {
      systemInstruction: `Tu es un créateur d'épreuves TCF Canada pour l'expression orale niveau B2.
Génère un sujet de monologue de 60 à 90 secondes sur le thème donné.

- promptText : la consigne que l'apprenant lit avant d'enregistrer (2-3 phrases, registre B2, demande de défendre une position ou de décrire et analyser). En français.
- scenarioContext : une phrase de mise en situation (qui parle, à qui, dans quel contexte). En français.

Le prompt doit exiger une prise de position argumentée, pas une simple description.`,
      responseMimeType: "application/json",
      responseJsonSchema: promptSchema,
    },
  });
  if (!response.text) throw new Error("Empty response from Gemini (generateSpeakingPrompt)");
  try { return JSON.parse(response.text) as SpeakingPrompt; }
  catch { throw new Error("Invalid JSON from Gemini (generateSpeakingPrompt)"); }
}

export async function transcribeSpeech(
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Transcris fidèlement cet enregistrement en français. Conserve les hésitations naturelles (euh, ben, enfin…) mais n'ajoute pas de ponctuation fictive. Retourne uniquement la transcription brute, sans commentaire.",
          },
          {
            inlineData: { mimeType, data: audioBase64 },
          },
        ],
      },
    ],
  });
  if (!response.text) throw new Error("Empty response from Gemini (transcribeSpeech)");
  return response.text.trim();
}

export async function gradeSpeech(
  promptText: string,
  scenarioContext: string,
  transcript: string
): Promise<SpeakingGradingResult> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const validTags = [
    ...SPEAKING_TAGS,
    ...SPAN_TAGS.filter((t) => getTaxonomyEntry(t)?.category !== "orthographe"),
  ].join(", ");

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: JSON.stringify({ promptText, scenarioContext, transcript }),
    config: {
      systemInstruction: `Tu es un correcteur TCF Canada pour l'expression orale niveau B2.
Évalue la transcription d'un monologue selon 5 critères, chacun noté de 0 à 4.

Critères :
- pertinence : le monologue répond-il au prompt et au scénario ? (0 = hors sujet, 4 = pleinement adapté)
- coherence : les idées s'enchaînent-elles logiquement ? (0 = aucune structure, 4 = progression claire)
- lexique : la richesse et la précision du vocabulaire sont-elles au niveau B2 ? (0 = A1/A2 uniquement, 4 = lexique varié et précis)
- grammaire : les structures grammaticales sont-elles correctes ? (0 = erreurs systématiques, 4 = très peu d'erreurs)
- registre : le registre est-il adapté au contexte formel simulé ? (0 = familier/inadapté, 4 = registre soutenu et cohérent)

Pour chaque critère :
- score : entier 0-4
- feedback : une phrase précise et encourageante en français
- error_tag : le tag le plus pertinent parmi : ${validTags} (même si le score est bon, choisis le tag qui décrit la lacune principale ou le point fort à surveiller)
- excerpt : citation verbatim de la transcription illustrant ton évaluation (omets ce champ pour les observations globales)

Résumé :
- total_score : somme des 5 scores (0-20)
- mastery_signal : "improving" si total ≥ 16, "still_struggling" si total ≤ 8, sinon "mixed"
- overall_feedback : 2 phrases de synthèse pour l'apprenant`,
      responseMimeType: "application/json",
      responseJsonSchema: gradingSchema,
    },
  });

  if (!response.text) throw new Error("Empty response from Gemini (gradeSpeech)");
  try { return JSON.parse(response.text) as SpeakingGradingResult; }
  catch { throw new Error("Invalid JSON from Gemini (gradeSpeech)"); }
}
