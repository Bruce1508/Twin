"use client";

import { useState, Suspense } from "react";
import { TASK_TYPES, type TaskType, type ExtractionResult, type RubricResult, type RubricCriterionKey } from "@/lib/extractor";
import SessionStepButton from "@/app/SessionStepButton";

const CATEGORY_COLORS: Record<string, string> = {
  grammaire: "bg-red-100 text-red-800 border-red-200",
  lexique: "bg-blue-100 text-blue-800 border-blue-200",
  orthographe: "bg-yellow-100 text-yellow-800 border-yellow-200",
  syntaxe: "bg-purple-100 text-purple-800 border-purple-200",
  registre: "bg-orange-100 text-orange-800 border-orange-200",
};

const RUBRIC_LABELS: Record<RubricCriterionKey, string> = {
  coherence:   "Cohérence",
  vocabulaire: "Vocabulaire",
  grammaire:   "Grammaire",
  registre:    "Registre",
};

type SubmitResult = {
  submissionId: string | null;
  persisted: boolean;
  extraction: ExtractionResult;
  rubric: RubricResult | null;
};

export default function SubmitPage() {
  const [content, setContent] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("free_writing");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, taskType, prompt: prompt || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur s'est produite.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  const totalErrors = result
    ? result.extraction.span_errors.length +
      result.extraction.whole_text_observations.length
    : 0;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-ink">
            Linguistic Twin
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Écris en français — tes erreurs sont analysées et mémorisées.
          </p>
        </header>

        {/* ── Submission form ── */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Type de tâche
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
                className="w-full rounded-none border border-rule bg-paper-raised px-3 py-2 text-sm text-ink"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Sujet / consigne{" "}
                <span className="font-normal text-ink-faint">(optionnel)</span>
              </label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="ex: Décrivez les avantages du télétravail"
                className="w-full rounded-none border border-rule bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Ton texte en français
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Écris ici…"
              className="w-full rounded-none border border-rule bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || content.trim().length === 0}
            className="rounded-none bg-ink text-paper-raised px-6 py-2.5 text-sm font-medium disabled:opacity-40 transition-opacity"
          >
            {loading ? "Analyse en cours…" : "Analyser"}
          </button>
        </form>

        {/* ── Error state ── */}
        {error && (
          <div className="rounded-none border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-none border border-rule bg-paper-raised px-4 py-3 text-sm">
              <span className="font-medium text-ink">
                {totalErrors === 0
                  ? "Aucune erreur détectée"
                  : `${totalErrors} erreur${totalErrors > 1 ? "s" : ""} détectée${totalErrors > 1 ? "s" : ""}`}
              </span>
              <span className="text-zinc-300">·</span>
              <span className="text-ink-muted">
                {result.extraction.metrics.word_count} mots
              </span>
              <span className="text-zinc-300">·</span>
              <span className="text-ink-muted">
                Diversité lexicale :{" "}
                {(result.extraction.metrics.lexical_diversity * 100).toFixed(0)}%
              </span>
              {!result.persisted && (
                <>
                  <span className="text-zinc-300">·</span>
                  <span className="text-amber-600 text-xs">
                    Non enregistré (DB non configurée)
                  </span>
                </>
              )}
            </div>

            {/* Rubric */}
            {result.rubric && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-3">
                  Évaluation par critères
                </h2>
                <p className="text-sm text-ink-muted mb-3">
                  {result.rubric.overall_feedback}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {result.rubric.criteria.map((c) => (
                    <div key={c.criterion}
                      className="rounded-none border border-rule bg-paper-raised px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ink-muted">
                          {RUBRIC_LABELS[c.criterion]}
                        </span>
                        <span className={`text-xs rounded-none px-2 py-0.5 font-medium ${
                          c.strength
                            ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                        }`}>
                          {c.strength ? "Point fort" : "À travailler"}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className={`h-1.5 flex-1 rounded-none ${
                            i < c.score ? "bg-zinc-900 dark:bg-zinc-100" : "bg-paper-sunken"
                          }`} />
                        ))}
                      </div>
                      <p className="text-xs text-ink-muted">{c.feedback}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Span errors */}
            {result.extraction.span_errors.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-3">
                  Erreurs dans le texte
                </h2>
                <div className="space-y-3">
                  {result.extraction.span_errors.map((err, i) => {
                    const [cat] = err.error_tag.split("_");
                    const chipColor =
                      CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-700 border-gray-200";
                    return (
                      <div
                        key={i}
                        className="rounded-none border border-rule bg-paper-raised p-4 space-y-2"
                      >
                        <span
                          className={`inline-block rounded-none border px-2 py-0.5 text-xs font-medium ${chipColor}`}
                        >
                          {err.error_tag}
                        </span>
                        <div className="text-sm space-y-1">
                          <div>
                            <span className="text-ink-faint mr-2">Incorrect :</span>
                            <span className="line-through text-red-600 dark:text-red-400">
                              {err.excerpt}
                            </span>
                          </div>
                          <div>
                            <span className="text-ink-faint mr-2">Correction :</span>
                            <span className="text-green-700 dark:text-green-400 font-medium">
                              {err.correction}
                            </span>
                          </div>
                          <p className="text-ink-muted text-xs pt-1">
                            {err.explanation}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Whole-text observations */}
            {result.extraction.whole_text_observations.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-3">
                  Observations globales
                </h2>
                <div className="space-y-3">
                  {result.extraction.whole_text_observations.map((obs, i) => (
                    <div
                      key={i}
                      className="rounded-none border border-rule bg-paper-raised p-4 space-y-1"
                    >
                      <span className="inline-block rounded-none border px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 border-purple-200">
                        {obs.error_tag}
                      </span>
                      <p className="text-sm text-ink-muted pt-1">
                        {obs.explanation}
                      </p>
                      {obs.evidence && (
                        <p className="text-xs text-ink-faint italic">{obs.evidence}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Metrics grid */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-3">
                Métriques
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["Mots", result.extraction.metrics.word_count],
                    ["Phrases", result.extraction.metrics.sentence_count],
                    [
                      "Mots / phrase",
                      result.extraction.metrics.avg_sentence_length.toFixed(1),
                    ],
                    [
                      "Diversité lexicale",
                      (result.extraction.metrics.lexical_diversity * 100).toFixed(0) +
                        "%",
                    ],
                    ["Subordonnées", result.extraction.metrics.subordinate_clause_count],
                    [
                      "Connecteurs distincts",
                      result.extraction.metrics.distinct_connectors_used,
                    ],
                  ] as [string, string | number][]
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-none border border-rule bg-paper-raised px-4 py-3"
                  >
                    <div className="text-xl font-semibold text-ink">
                      {value}
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </section>
            <Suspense fallback={null}><SessionStepButton /></Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
