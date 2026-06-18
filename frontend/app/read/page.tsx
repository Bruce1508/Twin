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
