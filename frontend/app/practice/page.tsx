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
        const { errorTag, sourceErrorId } = await targetRes.json();
        if (!errorTag) { setStatus("no_target"); return; }

        const drillRes = await fetch("/api/drills/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorTag, sourceErrorId }),
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
        router.push(`/drill/${drill.drillId}`);
      } catch {
        setErrorMsg("Impossible de contacter le serveur.");
        setStatus("error");
      }
    }
    start();
  }, [router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-2xl animate-pulse">⟳</p>
          <p className="text-sm text-zinc-500">Préparation de ton exercice…</p>
        </div>
      </div>
    );
  }

  if (status === "no_target") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Aucun point faible détecté</h1>
          <p className="text-sm text-zinc-500">Soumets d'abord quelques textes pour que le système identifie tes erreurs récurrentes.</p>
          <a href="/submit" className="inline-block rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium">
            Écrire un texte
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-sm text-red-600">{errorMsg}</p>
        <a href="/dashboard" className="text-sm text-zinc-500 underline">Retour au profil</a>
      </div>
    </div>
  );
}
