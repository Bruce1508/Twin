# Reading Comprehension Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TCF-style reading comprehension loop that stores comprehension errors in the same event store as writing errors, extending the learner profile to cover two of the four TCF Canada skills.

**Architecture:** A learner pastes or generates a B2 French article, Gemini produces 5 TCF-style questions, the learner answers in French, and Gemini grades each answer with a normalized comprehension error tag. A new `ReadingExercise` DB model stores the article + questions + answer key; when the learner submits, a `Submission` row is created and `ErrorEvent` rows link to it exactly as writing does — the profile recompute function works unchanged.

**Tech Stack:** Next.js 16 App Router + TypeScript, `@google/genai` (already installed), Prisma 7 + PostgreSQL + `@prisma/adapter-pg` (existing), Tailwind (existing). No new dependencies required.

---

## File map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `lib/taxonomy.ts` | Add `comprehension` category + 6 tags + `readingOnly` flag |
| Modify | `lib/generator.ts` | Update `canRouteToDrill` to exclude `readingOnly` tags |
| Create | `lib/reading.ts` | Gemini calls: article generation, question generation, answer grading |
| Modify | `prisma/schema.prisma` | Add `ReadingExercise` model + `comprehension` to `ErrorCategory` enum |
| Create | `app/api/reading/generate/route.ts` | POST — creates `ReadingExercise`, returns questions (no answer key) |
| Create | `app/api/reading/[exerciseId]/grade/route.ts` | POST — grades answers, creates `Submission` + `ErrorEvent` rows, recomputes profile |
| Create | `app/read/page.tsx` | Full reading UI: paste/generate article → answer questions → see results |
| Modify | `app/page.tsx` | Add /read link to nav hub |
| Modify | `app/dashboard/page.tsx` | Split error display: writing errors vs. comprehension errors |

---

## Task 1 — Extend taxonomy with comprehension category

**Files:**
- Modify: `frontend/lib/taxonomy.ts`
- Modify: `frontend/lib/generator.ts`

- [ ] **Step 1: Add `readingOnly` flag and `comprehension` category to `lib/taxonomy.ts`**

Replace the top of the file:

```typescript
export type ErrorCategory =
  | "grammaire"
  | "lexique"
  | "orthographe"
  | "syntaxe"
  | "registre"
  | "comprehension";

export interface TaxonomyEntry {
  tag: string;
  category: ErrorCategory;
  gloss: string;
  example: string;
  wholeTextOnly?: boolean;
  readingOnly?: boolean; // true = only valid for reading exercises, never routed to writing drills
}
```

- [ ] **Step 2: Fix `SPAN_TAGS` to exclude `readingOnly` tags**

Find the `SPAN_TAGS` export and update it:

```typescript
export const SPAN_TAGS: readonly ErrorTag[] = TAXONOMY.filter(
  (e) => !e.wholeTextOnly && !e.readingOnly
).map((e) => e.tag);
```

- [ ] **Step 3: Add 6 comprehension tags to `TAXONOMY`, just before the `uncategorized` entry**

```typescript
  // ── COMPRÉHENSION ──────────────────────────────────────────────────────────
  {
    tag: "inference_manquee",
    category: "comprehension",
    gloss: "L'apprenant n'a pas déduit un sens implicite non dit directement dans le texte",
    example: "Question sur l'implication d'une phrase → réponse hors sujet ou trop littérale",
    readingOnly: true,
  },
  {
    tag: "reformulation_incorrecte",
    category: "comprehension",
    gloss: "L'apprenant n'a pas reconnu qu'une expression du texte était reformulée dans la question",
    example: "'tissu social fragilisé' reformulé → non reconnu",
    readingOnly: true,
  },
  {
    tag: "hors_texte",
    category: "comprehension",
    gloss: "La réponse introduit des informations extérieures au texte ou invente des détails",
    example: "Réponse basée sur connaissances générales, pas sur le texte",
    readingOnly: true,
  },
  {
    tag: "information_manquante",
    category: "comprehension",
    gloss: "Un fait explicitement présent dans le texte n'a pas été repéré ou cité",
    example: "Le texte mentionne trois raisons → l'apprenant n'en cite que deux",
    readingOnly: true,
  },
  {
    tag: "opinion_auteur_mal_identifiee",
    category: "comprehension",
    gloss: "L'attitude ou le point de vue de l'auteur a été mal interprété",
    example: "Auteur ironique → apprenant l'interprète comme sincèrement positif",
    readingOnly: true,
  },
  {
    tag: "interpretation_globale_incorrecte",
    category: "comprehension",
    gloss: "L'idée principale ou l'intention générale du texte a été mal comprise",
    example: "Texte argumentatif → apprenant croit que c'est descriptif",
    readingOnly: true,
  },
```

- [ ] **Step 4: Export `READING_TAGS` constant (add after the `WHOLE_TEXT_TAGS` export)**

```typescript
export const READING_TAGS: readonly ErrorTag[] = TAXONOMY.filter(
  (e) => e.readingOnly
).map((e) => e.tag);
```

- [ ] **Step 5: Update `canRouteToDrill` in `lib/generator.ts` to exclude reading-only tags**

Update the import at the top of `lib/generator.ts`:

```typescript
import { getTaxonomyEntry, WHOLE_TEXT_TAGS, READING_TAGS, type ErrorTag } from "@/lib/taxonomy";
```

Update the function body:

```typescript
export function canRouteToDrill(tag: string): boolean {
  return (
    !WHOLE_TEXT_TAGS.includes(tag as never) &&
    !READING_TAGS.includes(tag as never)
  );
}
```

- [ ] **Step 6: Verify TypeScript and tag count**

```bash
cd /Users/brucevo/Desktop/twin/frontend && npx tsc --noEmit
curl -s http://localhost:3000/api/health
# Expected: {"status":"ok","taxonomy":{"total":45,"spanTags":34,"wholeTextTags":5}}
```

- [ ] **Step 7: Commit**

```bash
git -C /Users/brucevo/Desktop/twin/frontend add lib/taxonomy.ts lib/generator.ts
git -C /Users/brucevo/Desktop/twin/frontend commit -m "feat: add comprehension category + 6 tags; exclude from drill routing"
```

---

## Task 2 — Extend Prisma schema with ReadingExercise

**Files:**
- Modify: `frontend/prisma/schema.prisma`

- [ ] **Step 1: Add `comprehension` to `ErrorCategory` enum**

```prisma
enum ErrorCategory {
  grammaire
  lexique
  orthographe
  syntaxe
  registre
  comprehension
}
```

- [ ] **Step 2: Add `ReadingExercise` model after the `Drill` model**

```prisma
// Stores a reading exercise: article + generated questions with answer keys.
// submissionId is set when the learner submits answers, closing the loop.
// articleSource: "pasted" | "generated"
model ReadingExercise {
  id            String   @id @default(cuid())
  userId        String
  articleText   String
  topic         String?
  articleSource String
  questions     Json
  submissionId  String?  @unique
  createdAt     DateTime @default(now())

  user       User        @relation(fields: [userId], references: [id])
  submission Submission? @relation("ReadingExerciseResponse", fields: [submissionId], references: [id])
}
```

- [ ] **Step 3: Add back-relation to `Submission` model**

Inside the `Submission` model block add:

```prisma
  readingExerciseAnswer ReadingExercise? @relation("ReadingExerciseResponse")
```

- [ ] **Step 4: Add `readingExercises` to `User` model**

Inside the `User` model block add:

```prisma
  readingExercises ReadingExercise[]
```

- [ ] **Step 5: Run migration and regenerate client**

```bash
cd /Users/brucevo/Desktop/twin/frontend
npx prisma migrate dev --name add_reading_exercise
npx prisma generate
```

- [ ] **Step 6: Verify table exists**

```bash
cd /Users/brucevo/Desktop/twin && docker compose exec db psql -U twin twin_dev -c "\dt"
# Expected: ReadingExercise appears in list
```

- [ ] **Step 7: Commit**

```bash
git -C /Users/brucevo/Desktop/twin/frontend add prisma/
git -C /Users/brucevo/Desktop/twin/frontend commit -m "feat: add ReadingExercise model + comprehension to ErrorCategory enum"
```

---

## Task 3 — Build `lib/reading.ts`

**Files:**
- Create: `frontend/lib/reading.ts`

- [ ] **Step 1: Create `frontend/lib/reading.ts`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/brucevo/Desktop/twin/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/brucevo/Desktop/twin/frontend add lib/reading.ts
git -C /Users/brucevo/Desktop/twin/frontend commit -m "feat: add lib/reading.ts (article gen, question gen, grading via Gemini)"
```

---

## Task 4 — API route: POST /api/reading/generate

**Files:**
- Create: `frontend/app/api/reading/generate/route.ts`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p /Users/brucevo/Desktop/twin/frontend/app/api/reading/generate
```

- [ ] **Step 2: Create `app/api/reading/generate/route.ts`**

```typescript
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
      data: { userId, articleText, topic: body.topic ?? null, articleSource, questions },
    });
    exerciseId = exercise.id;
  } catch (err) {
    console.error("DB persist failed:", err);
  }

  // Strip answer keys before sending to client
  const publicQuestions = questions.map(({ id, type, question }) => ({ id, type, question }));
  return Response.json({ exerciseId, articleText, questions: publicQuestions });
}
```

- [ ] **Step 3: Smoke-test**

```bash
curl -s -X POST http://localhost:3000/api/reading/generate \
  -H "Content-Type: application/json" \
  -d '{"articleSource":"generated","topic":"le télétravail en France","register":"journalistique"}' \
  | python3 -m json.tool | head -20
```

Expected: JSON with `exerciseId`, `articleText`, `questions` (5 items each with `id`, `type`, `question` — **no** `answer_key`).

- [ ] **Step 4: Commit**

```bash
git -C /Users/brucevo/Desktop/twin/frontend add app/api/reading/
git -C /Users/brucevo/Desktop/twin/frontend commit -m "feat: add POST /api/reading/generate"
```

---

## Task 5 — API route: POST /api/reading/[exerciseId]/grade

**Files:**
- Create: `frontend/app/api/reading/[exerciseId]/grade/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/Users/brucevo/Desktop/twin/frontend/app/api/reading/[exerciseId]/grade"
```

- [ ] **Step 2: Create `app/api/reading/[exerciseId]/grade/route.ts`**

```typescript
import { gradeAnswers, type LearnerReadingAnswer, type ReadingQuestion } from "@/lib/reading";
import { db } from "@/lib/db";
import { recomputeProfile } from "@/lib/profile";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  const { exerciseId } = await params;
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  let body: { answers: LearnerReadingAnswer[] };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  let exercise: any;
  try {
    exercise = await db.readingExercise.findUnique({ where: { id: exerciseId } });
  } catch {
    return Response.json({ error: "DB not configured" }, { status: 503 });
  }
  if (!exercise) return Response.json({ error: "Exercise not found" }, { status: 404 });
  if (exercise.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const questions = exercise.questions as ReadingQuestion[];

  let grading;
  try {
    grading = await gradeAnswers(exercise.articleText, questions, body.answers);
  } catch (err) {
    console.error("Grading failed:", err);
    return Response.json({ error: "Grading failed" }, { status: 500 });
  }

  // Persist Submission + ErrorEvents + link exercise (closes the loop)
  try {
    const answerText = body.answers.map((a) => a.answer).filter(Boolean).join(" ");
    const wordCount = answerText.split(/\s+/).filter(Boolean).length;

    const submission = await db.submission.create({
      data: {
        userId,
        source: "reading_exercise",
        prompt: exercise.articleText,
        content: answerText,
        wordCount,
        metrics: {
          question_count: questions.length,
          accuracy: grading.summary.accuracy,
          mastery_signal: grading.summary.mastery_signal,
        },
      },
    });

    await db.readingExercise.update({
      where: { id: exerciseId },
      data: { submissionId: submission.id },
    });

    const errorRows = grading.results
      .filter((r) => r.correction_quality !== "correct")
      .map((r) => ({
        submissionId: submission.id,
        category: "comprehension" as const,
        errorTag: r.comprehension_tag,
        excerpt: r.relevant_passage,
        correction: questions.find((q) => q.id === r.question_id)?.answer_key ?? "",
        explanation: r.feedback,
      }));

    if (errorRows.length > 0) {
      await db.errorEvent.createMany({ data: errorRows });
    }

    await recomputeProfile(userId);
  } catch (err) {
    console.error("DB persist failed (non-fatal):", err);
  }

  // Attach question text + answer key to each result for display
  const enrichedResults = grading.results.map((r) => ({
    ...r,
    question: questions.find((q) => q.id === r.question_id)?.question ?? "",
    answer_key: questions.find((q) => q.id === r.question_id)?.answer_key ?? "",
  }));

  return Response.json({ grading: { ...grading, results: enrichedResults } });
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/brucevo/Desktop/twin/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git -C /Users/brucevo/Desktop/twin/frontend add "app/api/reading/[exerciseId]/"
git -C /Users/brucevo/Desktop/twin/frontend commit -m "feat: add POST /api/reading/[exerciseId]/grade"
```

---

## Task 6 — Build the /read UI page

**Files:**
- Create: `frontend/app/read/page.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Create `app/read/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { QuestionGradingResult, ArticleRegister } from "@/lib/reading";

type PublicQuestion = { id: number; type: string; question: string };

type Stage =
  | { name: "setup" }
  | { name: "answering"; exerciseId: string; articleText: string; questions: PublicQuestion[] }
  | { name: "results"; results: (QuestionGradingResult & { question: string; answer_key: string })[]; accuracy: number };

const REGISTERS: { value: ArticleRegister; label: string }[] = [
  { value: "journalistique", label: "Journalistique" },
  { value: "litteraire",     label: "Littéraire" },
  { value: "scientifique",   label: "Scientifique" },
];

const TYPE_LABELS: Record<string, string> = {
  reperage:         "Repérage",
  reformulation:    "Reformulation",
  inference:        "Inférence",
  intention_auteur: "Intention de l'auteur",
  attitude_opinion: "Attitude / Opinion",
};

const QUALITY_STYLE: Record<string, string> = {
  correct: "border-green-200 bg-green-50 dark:bg-green-950/20",
  partial: "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20",
  wrong:   "border-red-200 bg-red-50 dark:bg-red-950/20",
};

export default function ReadPage() {
  const [stage, setStage] = useState<Stage>({ name: "setup" });
  const [tab, setTab] = useState<"generate" | "paste">("generate");
  const [pastedText, setPastedText] = useState("");
  const [topic, setTopic] = useState("");
  const [register, setRegister] = useState<ArticleRegister>("journalistique");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = tab === "generate"
        ? { articleSource: "generated", topic, register }
        : { articleSource: "pasted", articleText: pastedText };
      const res = await fetch("/api/reading/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur"); return; }
      setStage({ name: "answering", exerciseId: data.exerciseId, articleText: data.articleText, questions: data.questions });
    } catch { setError("Impossible de contacter le serveur."); }
    finally { setLoading(false); }
  }

  async function handleGrade(e: React.FormEvent) {
    e.preventDefault();
    if (stage.name !== "answering") return;
    setLoading(true);
    setError(null);
    try {
      const learnerAnswers = stage.questions.map((q) => ({ question_id: q.id, answer: answers[q.id] ?? "" }));
      const res = await fetch(`/api/reading/${stage.exerciseId}/grade`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: learnerAnswers }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur"); return; }
      setStage({ name: "results", results: data.grading.results, accuracy: data.grading.summary.accuracy });
    } catch { setError("Impossible de contacter le serveur."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">

        {stage.name === "setup" && (
          <>
            <header>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Compréhension écrite</p>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Lire et comprendre</h1>
              <p className="mt-1 text-sm text-zinc-500">5 questions de style TCF Canada sur un texte B2.</p>
            </header>

            <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700">
              {(["generate", "paste"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-400"}`}>
                  {t === "generate" ? "Générer un texte" : "Coller un texte"}
                </button>
              ))}
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              {tab === "generate" ? (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Sujet</label>
                    <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                      placeholder="ex: l'intelligence artificielle dans la santé"
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Registre</label>
                    <select value={register} onChange={(e) => setRegister(e.target.value as ArticleRegister)}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm h-[38px]">
                      {REGISTERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Colle ton texte en français</label>
                  <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                    rows={10} placeholder="Colle ici un article, une lettre, un extrait…"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm resize-none" />
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit"
                disabled={loading || (tab === "generate" ? !topic.trim() : !pastedText.trim())}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium disabled:opacity-40">
                {loading ? "Génération des questions…" : "Générer les questions"}
              </button>
            </form>
          </>
        )}

        {stage.name === "answering" && (
          <>
            <header>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Compréhension écrite</p>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Réponds aux questions</h1>
              <p className="text-sm text-zinc-500 mt-1">Relie-toi au texte pour chaque réponse. Réponds en français.</p>
            </header>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {stage.articleText}
            </div>

            <form onSubmit={handleGrade} className="space-y-5">
              {stage.questions.map((q, i) => (
                <div key={q.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-xs font-semibold text-zinc-400 mt-0.5">{i + 1}.</span>
                    <div className="flex-1">
                      <span className="inline-block rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500 mb-1">
                        {TYPE_LABELS[q.type] ?? q.type}
                      </span>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{q.question}</p>
                    </div>
                  </div>
                  <textarea value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    rows={2} placeholder="Ta réponse…"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm resize-none ml-5" />
                </div>
              ))}

              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium disabled:opacity-40">
                {loading ? "Correction en cours…" : "Soumettre mes réponses"}
              </button>
            </form>
          </>
        )}

        {stage.name === "results" && (
          <>
            <header>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Résultats</p>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {Math.round(stage.accuracy * 100)}% de bonnes réponses
              </h1>
            </header>

            <div className="space-y-4">
              {stage.results.map((r, i) => (
                <div key={r.question_id} className={`rounded-lg border p-4 space-y-2 ${QUALITY_STYLE[r.correction_quality]}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-zinc-400 shrink-0 mt-0.5">{i + 1}.</span>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{r.question}</p>
                  </div>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{r.feedback}</p>
                    {r.correction_quality !== "correct" && (
                      <p className="text-xs text-zinc-500">
                        <span className="font-medium">Réponse attendue :</span> {r.answer_key}
                      </p>
                    )}
                    <p className="text-xs text-zinc-400 italic">« {r.relevant_passage} »</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStage({ name: "setup" }); setAnswers({}); setError(null); }}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium">
                Nouvel exercice
              </button>
              <a href="/dashboard" className="rounded-full border border-zinc-200 dark:border-zinc-700 px-6 py-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                Mon profil
              </a>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `/read` to the home nav in `app/page.tsx`**

In the nav array, add after the `/submit` entry:

```tsx
{ href: "/read", title: "Lire", sub: "Compréhension écrite — questions style TCF" },
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/brucevo/Desktop/twin/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Manual test**

Open `http://localhost:3000/read`, enter a topic, click "Générer les questions". Verify: article appears, 5 questions without answer keys shown. Type answers, submit. Verify: results appear with feedback per question, colour-coded by quality.

- [ ] **Step 5: Commit**

```bash
git -C /Users/brucevo/Desktop/twin/frontend add app/read/ app/page.tsx
git -C /Users/brucevo/Desktop/twin/frontend commit -m "feat: add /read UI — TCF-style reading comprehension exercises"
```

---

## Task 7 — Update dashboard to split writing vs. comprehension

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Update the taxonomy import**

```typescript
import { getTaxonomyEntry, READING_TAGS } from "@/lib/taxonomy";
```

- [ ] **Step 2: Replace the single `top` variable with two lists**

```typescript
const allTop = profile ? topSpanTags(profile.errorFrequencies, 20) : [];
const writingTop = allTop.filter(({ tag }) => !READING_TAGS.includes(tag as never)).slice(0, 10);
const readingTop  = allTop.filter(({ tag }) =>  READING_TAGS.includes(tag as never)).slice(0, 6);
```

Remove the old `const top = ...` line and `const maxCount = ...` line.

- [ ] **Step 3: Replace the single error section with two sections + updated empty state**

Replace the block that renders the single section (starting from `{top.length > 0 ? (`) with:

```tsx
{/* Writing errors */}
{writingTop.length > 0 && (
  <section>
    <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">Erreurs à l'écrit</h2>
    <div className="space-y-2">
      {writingTop.map(({ tag, count }) => {
        const entry = getTaxonomyEntry(tag);
        const color = CATEGORY_COLORS[entry?.category ?? ""] ?? "bg-zinc-400";
        const pct = Math.round((count / (writingTop[0]?.count ?? 1)) * 100);
        return (
          <div key={tag} className="flex items-center gap-3">
            <div className="w-48 text-xs text-zinc-700 dark:text-zinc-300 truncate shrink-0">{tag}</div>
            <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="w-6 text-xs text-right text-zinc-500 shrink-0">{count}</div>
          </div>
        );
      })}
    </div>
  </section>
)}

{/* Comprehension errors */}
{readingTop.length > 0 && (
  <section>
    <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">Erreurs de compréhension</h2>
    <div className="space-y-2">
      {readingTop.map(({ tag, count }) => {
        const pct = Math.round((count / (readingTop[0]?.count ?? 1)) * 100);
        return (
          <div key={tag} className="flex items-center gap-3">
            <div className="w-48 text-xs text-zinc-700 dark:text-zinc-300 truncate shrink-0">{tag}</div>
            <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="w-6 text-xs text-right text-zinc-500 shrink-0">{count}</div>
          </div>
        );
      })}
    </div>
  </section>
)}

{writingTop.length === 0 && readingTop.length === 0 && (
  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-6 py-8 text-center text-sm text-zinc-400">
    Aucune donnée —{" "}
    <a href="/submit" className="underline">soumettre un texte</a>{" "}
    ou{" "}
    <a href="/read" className="underline">faire un exercice de lecture</a>.
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/brucevo/Desktop/twin/frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/brucevo/Desktop/twin/frontend add app/dashboard/page.tsx
git -C /Users/brucevo/Desktop/twin/frontend commit -m "feat: split dashboard — writing errors vs comprehension errors"
```

---

## Definition of done

Feature is complete when all of the following hold:

1. `/api/health` returns `total: 45` (39 existing + 6 comprehension tags).
2. `/read` — can generate a B2 article on any topic, receive 5 TCF-style questions (no answer key visible), answer in French, receive graded results per question.
3. DB after a completed exercise: `ReadingExercise` row exists, `Submission` row with `source="reading_exercise"` exists, `ErrorEvent` rows with `category="comprehension"` exist for incorrect answers.
4. `/dashboard` — shows two separate sections: "Erreurs à l'écrit" (red/blue/etc.) and "Erreurs de compréhension" (indigo) after at least one exercise.
5. `/practice` — comprehension tags are NOT offered as Reverse Tutor drills (targeting rule excludes them).
6. `npx tsc --noEmit` passes with zero errors.

## Out of scope for this plan

- Spaced repetition on comprehension error tags
- TCF multiple-choice format (current plan uses short-answer for richer error signal)
- Timer / timed mock exam mode
- Listening comprehension (requires audio input — separate effort)
- Multi-user auth (separate effort)
