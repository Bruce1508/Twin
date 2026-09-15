"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PracticePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "no_target" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function start() {
      try {
        const targetRes = await fetch("/api/practice/next-target");
        const { errorTag } = await targetRes.json();
        if (!errorTag) { setStatus("no_target"); return; }

        const drillRes = await fetch("/api/drills/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorTag }),
        });
        const drill = await drillRes.json();
        if (!drillRes.ok || !drill.drillId) {
          setErrorMsg(drill.error ?? "Échec de la génération");
          setStatus("error");
          return;
        }

        sessionStorage.setItem(`drill_${drill.drillId}`, JSON.stringify({
          errorTag: drill.errorTag, topic: drill.topic, sentences: drill.sentences,
        }));
        const isSession = new URLSearchParams(window.location.search).get("session") === "1";
        router.push(`/drill/${drill.drillId}${isSession ? "?session=1" : ""}`);
      } catch {
        setErrorMsg("Impossible de contacter le serveur.");
        setStatus("error");
      }
    }
    start();
  }, [router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="font-mono text-xs font-bold tracking-widest text-correction-red animate-pulse">CHARGEMENT</p>
          <p className="text-sm text-ink-muted">Préparation de ton exercice…</p>
        </div>
      </div>
    );
  }

  if (status === "no_target") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-lg font-semibold text-ink">Aucun point faible détecté</h1>
          <p className="text-sm text-ink-muted">Soumets d&apos;abord quelques textes pour que le système identifie tes erreurs récurrentes.</p>
          <a href="/submit" className="inline-block rounded-none bg-ink text-paper-raised px-6 py-2.5 text-sm font-medium">
            Écrire un texte
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-sm text-red-600">{errorMsg}</p>
        <a href="/dashboard" className="text-sm text-ink-muted underline">Retour au profil</a>
      </div>
    </div>
  );
}
