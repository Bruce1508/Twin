"use client";

import { useState, useRef, useEffect } from "react";
import type { SpeakingCriterionResult } from "@/lib/speaking";

type Stage =
  | { name: "setup" }
  | { name: "recording"; exerciseId: string; promptText: string; scenarioContext: string }
  | { name: "reviewing"; exerciseId: string; promptText: string; transcript: string }
  | { name: "results"; totalScore: number; masterySignal: string; criteria: SpeakingCriterionResult[]; overallFeedback: string };

const CRITERION_LABELS: Record<string, string> = {
  pertinence: "Pertinence",
  coherence:  "Cohérence",
  lexique:    "Lexique",
  grammaire:  "Grammaire",
  registre:   "Registre",
};

const SCORE_STYLE: Record<number, string> = {
  4: "bg-green-500",
  3: "bg-green-400",
  2: "bg-yellow-400",
  1: "bg-orange-400",
  0: "bg-red-500",
};

const MASTERY_STYLE: Record<string, { label: string; class: string }> = {
  improving:        { label: "En progrès", class: "text-green-600 dark:text-green-400" },
  mixed:            { label: "En développement", class: "text-yellow-600 dark:text-yellow-400" },
  still_struggling: { label: "À renforcer", class: "text-red-600 dark:text-red-400" },
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function SpeakPage() {
  const [stage, setStage] = useState<Stage>({ name: "setup" });
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "processing">("idle");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/speaking/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur"); return; }
      if (!data.exerciseId) { setError("Impossible de créer l'exercice. Réessaie."); return; }
      setStage({ name: "recording", exerciseId: data.exerciseId, promptText: data.promptText, scenarioContext: data.scenarioContext });
      setRecordingState("idle");
      setDurationSeconds(0);
    } catch { setError("Impossible de contacter le serveur."); }
    finally { setLoading(false); }
  }

  async function startRecording() {
    if (stage.name !== "recording") return;
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ton navigateur ne supporte pas l'enregistrement audio.");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
      ? "audio/ogg;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : null;

    if (!mimeType) {
      setError("Aucun format audio supporté par ce navigateur.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Permission microphone refusée.");
      return;
    }

    audioChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    // Capture exerciseId at record time to avoid stale closure in onstop
    const { exerciseId, promptText } = stage as Extract<Stage, { name: "recording" }>;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingState("processing");

      const cleanMimeType = mimeType.split(";")[0];
      const blob = new Blob(audioChunksRef.current, { type: cleanMimeType });

      try {
        const audioBase64 = await blobToBase64(blob);
        const res = await fetch(`/api/speaking/${exerciseId}/transcribe`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64, mimeType: cleanMimeType }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "Erreur de transcription"); setRecordingState("idle"); return; }
        setTranscript(data.transcript);
        setStage({ name: "reviewing", exerciseId, promptText, transcript: data.transcript });
      } catch {
        setError("Impossible de transcrire l'audio.");
        setRecordingState("idle");
      }
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setRecordingState("recording");
    durationRef.current = 0;
    setDurationSeconds(0);

    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDurationSeconds(durationRef.current);
      if (durationRef.current >= 120) {
        clearInterval(timerRef.current!);
        mediaRecorderRef.current?.stop();
      }
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  async function handleGrade(e: React.FormEvent) {
    e.preventDefault();
    if (stage.name !== "reviewing") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/speaking/${stage.exerciseId}/grade`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur"); return; }
      const g = data.grading;
      setStage({
        name: "results",
        totalScore: g.summary.total_score,
        masterySignal: g.summary.mastery_signal,
        criteria: g.criteria,
        overallFeedback: g.summary.overall_feedback,
      });
    } catch { setError("Impossible de contacter le serveur."); }
    finally { setLoading(false); }
  }

  function resetExercise() {
    setStage({ name: "setup" });
    setTopic("");
    setTranscript("");
    setError(null);
    setRecordingState("idle");
    setDurationSeconds(0);
  }

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">

        {stage.name === "setup" && (
          <>
            <header>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Expression orale</p>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Pratiquer l&apos;oral</h1>
              <p className="mt-1 text-sm text-zinc-500">Monologue de style TCF Canada — 60 à 120 secondes.</p>
            </header>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Thème</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="ex: l'impact des réseaux sociaux sur la jeunesse"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading || !topic.trim()}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium disabled:opacity-40">
                {loading ? "Génération du sujet…" : "Générer le sujet"}
              </button>
            </form>
          </>
        )}

        {stage.name === "recording" && (
          <>
            <header>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Expression orale</p>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Prépare-toi et enregistre</h1>
            </header>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-4 space-y-3">
              <p className="text-xs text-zinc-400 uppercase tracking-widest">Mise en situation</p>
              <p className="text-sm text-zinc-500 italic">{stage.scenarioContext}</p>
              <hr className="border-zinc-100 dark:border-zinc-800" />
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">{stage.promptText}</p>
            </div>

            <div className="flex flex-col items-center gap-4 py-4">
              {recordingState === "idle" && (
                <button onClick={startRecording}
                  className="flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-sm font-medium transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-white" />
                  Commencer l&apos;enregistrement
                </button>
              )}
              {recordingState === "recording" && (
                <>
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-lg font-mono text-zinc-700 dark:text-zinc-300">
                      {formatDuration(durationSeconds)} / 2:00
                    </span>
                  </div>
                  <button onClick={stopRecording}
                    className="rounded-full border-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 px-8 py-3 text-sm font-medium">
                    Arrêter
                  </button>
                </>
              )}
              {recordingState === "processing" && (
                <p className="text-sm text-zinc-500 animate-pulse">Transcription en cours…</p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}

        {stage.name === "reviewing" && (
          <>
            <header>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Expression orale</p>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Vérifie la transcription</h1>
              <p className="mt-1 text-sm text-zinc-500">Corrige les erreurs si nécessaire, puis envoie pour évaluation.</p>
            </header>

            <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3">
              <p className="text-xs text-zinc-400 mb-1">Sujet</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{stage.promptText}</p>
            </div>

            <form onSubmit={handleGrade} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Transcription</label>
                <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm resize-none leading-relaxed" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading || !transcript.trim()}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium disabled:opacity-40">
                {loading ? "Évaluation en cours…" : "Évaluer mon monologue"}
              </button>
            </form>
          </>
        )}

        {stage.name === "results" && (
          <>
            <header>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Résultats</p>
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {stage.totalScore}<span className="text-base text-zinc-400 font-normal">/20</span>
                </h1>
                <span className={`text-sm font-medium ${MASTERY_STYLE[stage.masterySignal]?.class ?? ""}`}>
                  {MASTERY_STYLE[stage.masterySignal]?.label ?? stage.masterySignal}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{stage.overallFeedback}</p>
            </header>

            <div className="space-y-3">
              {stage.criteria.map((r) => (
                <div key={r.criterion} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {CRITERION_LABELS[r.criterion] ?? r.criterion}
                    </span>
                    <span className="text-sm font-mono text-zinc-500">{r.score}/4</span>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${i < r.score ? (SCORE_STYLE[r.score] ?? "bg-zinc-300") : "bg-zinc-100 dark:bg-zinc-800"}`} />
                    ))}
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{r.feedback}</p>
                  {r.excerpt && <p className="text-xs text-zinc-400 italic">« {r.excerpt} »</p>}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={resetExercise}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium">
                Nouvel exercice
              </button>
              <a href="/dashboard"
                className="rounded-full border border-zinc-200 dark:border-zinc-700 px-6 py-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                Mon profil
              </a>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
