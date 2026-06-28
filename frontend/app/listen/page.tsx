"use client";

import { useState, Suspense } from "react";
import type { ListeningCriterionResult, PassageType, LearnerChoice } from "@/lib/listening";
import SessionStepButton from "@/app/SessionStepButton";

type PublicQuestion = {
  id: number;
  type: string;
  question: string;
  choices: { A: string; B: string; C: string; D: string };
};

type Stage =
  | { name: "setup" }
  | { name: "listening"; exerciseId: string; passageText: string; passageType: PassageType; questions: PublicQuestion[] }
  | { name: "results"; results: ListeningCriterionResult[]; accuracy: number };

const TYPE_LABELS: Record<string, string> = {
  reperage:          "Repérage",
  inference:         "Inférence",
  attitude_locuteur: "Attitude du locuteur",
  reformulation:     "Reformulation",
  idee_principale:   "Idée principale",
};

const CHOICE_KEYS: LearnerChoice[] = ["A", "B", "C", "D"];

export default function ListenPage() {
  const [stage, setStage] = useState<Stage>({ name: "setup" });
  const [topic, setTopic] = useState("");
  const [passageType, setPassageType] = useState<PassageType>("dialogue");
  const [answers, setAnswers] = useState<Record<number, LearnerChoice>>({});
  const [showTranscript, setShowTranscript] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/listening/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, passageType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur"); return; }
      setStage({ name: "listening", exerciseId: data.exerciseId, passageText: data.passageText, passageType: data.passageType, questions: data.questions });
      setAnswers({});
      setShowTranscript(false);
    } catch (e) { console.error("generate failed:", e); setError("Impossible de contacter le serveur."); }
    finally { setLoading(false); }
  }

  async function handleGrade(e: React.FormEvent) {
    e.preventDefault();
    if (stage.name !== "listening") return;
    setLoading(true);
    setError(null);
    try {
      const learnerAnswers = stage.questions
        .filter((q) => answers[q.id])
        .map((q) => ({ question_id: q.id, choice: answers[q.id] }));
      const res = await fetch(`/api/listening/${stage.exerciseId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: learnerAnswers }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur"); return; }
      setStage({ name: "results", results: data.grading.results, accuracy: data.grading.summary.accuracy });
    } catch (e) { console.error("grade failed:", e); setError("Impossible de contacter le serveur."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">

        {stage.name === "setup" && (
          <>
            <header>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Compréhension orale</p>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Écouter et comprendre</h1>
              <p className="mt-1 text-sm text-zinc-500">5 questions QCM de style TCF Canada sur un passage oral B2.</p>
            </header>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Sujet</label>
                  <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder="ex: le changement climatique"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Format</label>
                  <select value={passageType} onChange={(e) => setPassageType(e.target.value as PassageType)}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm h-[38px]">
                    <option value="dialogue">Dialogue</option>
                    <option value="monologue">Monologue</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading || !topic.trim()}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium disabled:opacity-40">
                {loading ? "Génération en cours…" : "Générer le passage"}
              </button>
            </form>
          </>
        )}

        {stage.name === "listening" && (
          <>
            <header>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Compréhension orale</p>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Écoute et réponds</h1>
              <p className="text-sm text-zinc-500 mt-1">
                {stage.passageType === "dialogue" ? "Dialogue" : "Monologue"} · 5 questions QCM
              </p>
            </header>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-4 space-y-3">
              <p className="text-xs text-zinc-400 uppercase tracking-widest">Passage audio</p>
              <audio
                src={`/api/listening/${stage.exerciseId}/audio`}
                controls
                preload="auto"
                className="w-full"
              />
              <button onClick={() => setShowTranscript((v) => !v)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline">
                {showTranscript ? "Masquer la transcription" : "Voir la transcription"}
              </button>
              {showTranscript && (
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap border border-zinc-100 dark:border-zinc-700">
                  {stage.passageText}
                </div>
              )}
            </div>

            <form onSubmit={handleGrade} className="space-y-6">
              {stage.questions.map((q, i) => (
                <div key={q.id} className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-xs font-semibold text-zinc-400 mt-0.5">{i + 1}.</span>
                    <div>
                      <span className="inline-block rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500 mb-1">
                        {TYPE_LABELS[q.type] ?? q.type}
                      </span>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{q.question}</p>
                    </div>
                  </div>
                  <div className="ml-5 grid grid-cols-1 gap-2">
                    {CHOICE_KEYS.map((key) => (
                      <label key={key} className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 cursor-pointer transition-colors text-sm ${
                        answers[q.id] === key
                          ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}>
                        <input type="radio" name={`q-${q.id}`} value={key}
                          checked={answers[q.id] === key}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: key }))}
                          className="sr-only" />
                        <span className="font-mono font-semibold text-xs shrink-0">{key}</span>
                        <span>{q.choices[key]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading || stage.questions.some((q) => !answers[q.id])}
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
                <div key={r.question_id} className={`rounded-lg border p-4 space-y-2 ${
                  r.correct ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-zinc-400 shrink-0 mt-0.5">{i + 1}.</span>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{r.question}</p>
                  </div>
                  <div className="ml-4 space-y-1">
                    {CHOICE_KEYS.map((key) => (
                      <div key={key} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
                        key === r.answer_key
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-medium"
                          : key === r.learner_choice && !r.correct
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 line-through"
                          : "text-zinc-500"
                      }`}>
                        <span className="font-semibold">{key}.</span>
                        <span>{r.choices[key]}</span>
                        {key === r.answer_key && <span className="ml-auto">✓</span>}
                        {key === r.learner_choice && !r.correct && <span className="ml-auto">✗</span>}
                      </div>
                    ))}
                    <p className="text-xs text-zinc-500 pt-1 italic">{r.explanation}</p>
                  </div>
                </div>
              ))}
            </div>

            <Suspense fallback={null}><SessionStepButton /></Suspense>
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
