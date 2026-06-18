import { GoogleGenAI } from "@google/genai";
import {
  TAXONOMY,
  SPAN_TAGS,
  WHOLE_TEXT_TAGS,
  isValidTag,
  type ErrorTag,
} from "@/lib/taxonomy";

// ── Types (Spec A.3) ──────────────────────────────────────────────────────────

export interface SpanError {
  excerpt: string;
  correction: string;
  error_tag: ErrorTag;
  explanation: string;
}

export interface WholeTextObservation {
  error_tag: ErrorTag;
  explanation: string;
  evidence?: string;
}

export interface ExtractionMetrics {
  word_count: number;
  sentence_count: number;
  avg_sentence_length: number;
  lexical_diversity: number;
  subordinate_clause_count: number;
  distinct_connectors_used: number;
}

export interface ExtractionResult {
  span_errors: SpanError[];
  whole_text_observations: WholeTextObservation[];
  metrics: ExtractionMetrics;
}

// ── Task types ────────────────────────────────────────────────────────────────

export const TASK_TYPES = [
  { value: "free_writing",     label: "Écriture libre" },
  { value: "formal_argument",  label: "Texte argumentatif formel" },
  { value: "informal_message", label: "Message informel" },
  { value: "formal_letter",    label: "Lettre formelle" },
  { value: "summary",          label: "Résumé / compte rendu" },
] as const;

export type TaskType = (typeof TASK_TYPES)[number]["value"];

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildTaxonomyBlock(): string {
  return TAXONOMY.map(
    (e) => `- ${e.tag} [${e.category}${e.wholeTextOnly ? ", whole-text only" : ""}]: ${e.gloss}`
  ).join("\n");
}

function buildSystemPrompt(taskType: TaskType, prompt?: string): string {
  const registerContext = prompt
    ? `Task type: ${taskType}. Task prompt: "${prompt}".`
    : `Task type: ${taskType}.`;

  return `You are an expert French language analyst specializing in B1–B2 learner errors. Analyze the written French and identify every error using ONLY the fixed taxonomy provided.

**Context for register judgment:** ${registerContext}

**Absolute rules:**
- Classify each error with exactly one error_tag from the list below. FORBIDDEN from inventing tags. If no tag fits, use \`uncategorized\`.
- Span errors: specific incorrect spans — excerpt MUST be copied verbatim from the input.
- Whole-text observations: text-wide issues not tied to one span. Only use tags marked "whole-text only" for these.
- Tags marked "whole-text only" MUST NOT appear in span_errors.
- Judge register against the task context provided.
- Do NOT assign a CEFR level or overall score.
- Flag real errors only, not stylistic preferences.
- Each explanation: why wrong + what rule applies, one or two sentences.

**Valid error tags:**
${buildTaxonomyBlock()}`;
}

// ── Spec A.3 output schema ────────────────────────────────────────────────────

const extractionSchema = {
  type: "object",
  properties: {
    span_errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          excerpt:     { type: "string" },
          correction:  { type: "string" },
          error_tag:   { type: "string" },
          explanation: { type: "string" },
        },
        required: ["excerpt", "correction", "error_tag", "explanation"],
      },
    },
    whole_text_observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          error_tag:   { type: "string" },
          explanation: { type: "string" },
          evidence:    { type: "string" },
        },
        required: ["error_tag", "explanation"],
      },
    },
    metrics: {
      type: "object",
      properties: {
        word_count:               { type: "integer" },
        sentence_count:           { type: "integer" },
        avg_sentence_length:      { type: "number" },
        lexical_diversity:        { type: "number" },
        subordinate_clause_count: { type: "integer" },
        distinct_connectors_used: { type: "integer" },
      },
      required: [
        "word_count", "sentence_count", "avg_sentence_length",
        "lexical_diversity", "subordinate_clause_count", "distinct_connectors_used",
      ],
    },
  },
  required: ["span_errors", "whole_text_observations", "metrics"],
};

// ── Normalisation ─────────────────────────────────────────────────────────────

function normalizeTag(raw: string): ErrorTag {
  const t = raw.trim().toLowerCase();
  return isValidTag(t) ? (t as ErrorTag) : "uncategorized";
}

function normalizeSpanError(raw: Record<string, unknown>): SpanError {
  return {
    excerpt:     String(raw.excerpt ?? ""),
    correction:  String(raw.correction ?? ""),
    error_tag:   normalizeTag(String(raw.error_tag ?? "")),
    explanation: String(raw.explanation ?? ""),
  };
}

function normalizeObservation(raw: Record<string, unknown>): WholeTextObservation {
  const tag = normalizeTag(String(raw.error_tag ?? ""));
  const safeTag: ErrorTag = WHOLE_TEXT_TAGS.includes(tag as never)
    ? (tag as ErrorTag)
    : "uncategorized";
  return {
    error_tag:   safeTag,
    explanation: String(raw.explanation ?? ""),
    ...(raw.evidence ? { evidence: String(raw.evidence) } : {}),
  };
}

function enforceSpanBoundary(errors: SpanError[]): SpanError[] {
  return errors.map((e) => ({
    ...e,
    error_tag: SPAN_TAGS.includes(e.error_tag as never)
      ? e.error_tag
      : ("uncategorized" as ErrorTag),
  }));
}

// ── Main extraction function ──────────────────────────────────────────────────

export async function extractErrors(
  content: string,
  taskType: TaskType,
  prompt?: string
): Promise<ExtractionResult> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: content,
    config: {
      systemInstruction: buildSystemPrompt(taskType, prompt),
      responseMimeType: "application/json",
      responseJsonSchema: extractionSchema,
    },
  });

  const raw = JSON.parse(response.text!) as {
    span_errors: Record<string, unknown>[];
    whole_text_observations: Record<string, unknown>[];
    metrics: ExtractionMetrics;
  };

  return {
    span_errors: enforceSpanBoundary((raw.span_errors ?? []).map(normalizeSpanError)),
    whole_text_observations: (raw.whole_text_observations ?? []).map(normalizeObservation),
    metrics: raw.metrics,
  };
}
