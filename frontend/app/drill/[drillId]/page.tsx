"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import SessionStepButton from "@/app/SessionStepButton";
import type { GradingResult, LearnerAnswer } from "@/lib/generator";

type Sentence = { id: number; text: string };
type DrillState = { errorTag: string; topic: string; sentences: Sentence[] };

const SIGNAL_STYLE = {
  improving: "bg-green-100 text-green-800 border-green-200",
  mixed: "bg-yellow-100 text-yellow-800 border-yellow-200",
  still_struggling: "bg-red-100 text-red-800 border-red-200",
};
const SIGNAL_LABEL = {
  improving: "En progrès",
  mixed: "Résultats mixtes",
  still_struggling: "Encore des difficultés",
};

export default function DrillPage() {
  const params = useParams();
  const router = useRouter();
  const drillId = params.drillId as string;

  const [drill] = useState<DrillState | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(`drill_${drillId}`) ?? "null"); }
    catch { return null; }
  });

  const [answers, setAnswers] = useState<Record<number, { flagged: boolean; correction: string }>>({});
  const [correctionText, setCorrectionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [graded, setGraded] = useState<{ grading: GradingResult; errorTag: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!drill) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Drill introuvable — <a href="/practice" className="underline">retour à Pratiquer</a>.</p>
      </div>
    );
  }

  function toggleFaulty(id: number) {
    setAnswers((prev) => ({ ...prev, [id]: { flagged: !prev[id]?.flagged, correction: prev[id]?.correction ?? "" } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const learnerAnswers: LearnerAnswer[] = drill!.sentences.map((s) => ({
      sentence_id: s.id,
      flagged_faulty: answers[s.id]?.flagged ?? false,
      correction: answers[s.id]?.correction || undefined,
    }));
    try {
      const res = await fetch(`/api/drills/${drillId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: learnerAnswers, correctionText }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Erreur");
      else setGraded(data);
    } catch { setError("Impossible de contacter le serveur."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <header>
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Reverse Tutor</p>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Trouve et corrige les erreurs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tag ciblé : <span className="font-mono">{drill.errorTag}</span> · {drill.topic}
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Certaines phrases contiennent une erreur du type ciblé. Coche celles qui sont fautives et propose une correction.
          </p>
        </header>

        {!graded ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              {drill.sentences.map((s) => (
                <div key={s.id} className={`rounded-lg border bg-white dark:bg-zinc-900 p-4 space-y-3 ${answers[s.id]?.flagged ? "border-red-300" : "border-zinc-200 dark:border-zinc-700"}`}>
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => toggleFaulty(s.id)}
                      className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${answers[s.id]?.flagged ? "border-red-500 bg-red-500" : "border-zinc-300 dark:border-zinc-600"}`}>
                      {answers[s.id]?.flagged && <span className="text-white text-xs leading-none">✕</span>}
                    </button>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{s.text}</p>
                  </div>
                  {answers[s.id]?.flagged && (
                    <input type="text" placeholder="Ta correction…"
                      value={answers[s.id]?.correction ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [s.id]: { ...prev[s.id], correction: e.target.value } }))}
                      className="w-full ml-8 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-sm" />
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Réécris tes corrections en français <span className="font-normal text-zinc-400">(optionnel — alimente ton profil)</span>
              </label>
              <textarea value={correctionText} onChange={(e) => setCorrectionText(e.target.value)}
                rows={3} placeholder="Écris ici tes phrases corrigées…"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm resize-none" />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium disabled:opacity-40">
              {loading ? "Correction en cours…" : "Soumettre mes réponses"}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${SIGNAL_STYLE[graded.grading.summary.tag_mastery_signal]}`}>
              {SIGNAL_LABEL[graded.grading.summary.tag_mastery_signal]}
              {" · "}Détection {Math.round(graded.grading.summary.detection_accuracy * 100)}%
              {" · "}Corrections {Math.round(graded.grading.summary.correction_accuracy * 100)}%
            </div>
            <div className="space-y-3">
              {graded.grading.results.map((r) => (
                <div key={r.sentence_id} className={`rounded-lg border p-4 ${r.correctly_identified ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"}`}>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">{drill.sentences.find((s) => s.id === r.sentence_id)?.text}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{r.feedback}</p>
                </div>
              ))}
            </div>
            <Suspense fallback={null}><SessionStepButton /></Suspense>
            <div className="flex gap-3">
              <button onClick={() => router.push("/practice")} className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium">
                Exercice suivant
              </button>
              <button onClick={() => router.push("/dashboard")} className="rounded-full border border-zinc-200 dark:border-zinc-700 px-6 py-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                Mon profil
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
