"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "create" | "join";

export default function ClassroomForms() {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: Action, value: string) {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(action === "create" ? "/api/classes" : "/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "create" ? { name: value } : { joinCode: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action impossible");
      router.push(`/classes/${data.classroom.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action impossible");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid border-3 border-ink bg-paper-raised lg:grid-cols-2">
      <form
        className="ledger-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("create", new FormData(event.currentTarget).get("name") as string);
        }}
      >
        <p className="ledger-label text-ink-faint">Pour enseigner</p>
        <h2 className="mt-3 font-display text-3xl uppercase">Créer une classe</h2>
        <label className="mt-7 block font-mono text-xs font-bold uppercase tracking-wider" htmlFor="class-name">
          Nom de la classe
        </label>
        <input id="class-name" name="name" required maxLength={80} className="mt-2 w-full px-3 py-3" />
        <button type="submit" disabled={pending !== null} className="mt-4 px-5 py-3">
          {pending === "create" ? "Création…" : "Créer la classe"}
        </button>
      </form>

      <form
        className="ledger-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("join", new FormData(event.currentTarget).get("joinCode") as string);
        }}
      >
        <p className="ledger-label text-ink-faint">Pour apprendre</p>
        <h2 className="mt-3 font-display text-3xl uppercase">Rejoindre une classe</h2>
        <label className="mt-7 block font-mono text-xs font-bold uppercase tracking-wider" htmlFor="join-code">
          Code d’invitation
        </label>
        <input id="join-code" name="joinCode" required autoCapitalize="characters" className="mt-2 w-full px-3 py-3 font-mono uppercase" />
        <button type="submit" disabled={pending !== null} className="mt-4 px-5 py-3">
          {pending === "join" ? "Connexion…" : "Rejoindre"}
        </button>
      </form>

      {error && <p className="border-t-3 border-ink p-4 text-sm text-correction-red lg:col-span-2" role="alert">{error}</p>}
    </div>
  );
}
