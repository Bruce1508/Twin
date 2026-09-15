"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinCodeControls({ classroomId, initialCode }: { classroomId: string; initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function rotate() {
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/classes/${classroomId}/rotate-code`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Rotation impossible");
      setCode(data.joinCode);
      setStatus("Nouveau code créé.");
      router.refresh();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Rotation impossible");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("Code copié.");
    } catch {
      setStatus("Copie impossible. Sélectionnez le code manuellement.");
    }
  }

  return (
    <div className="border-3 border-ink bg-paper-raised p-5">
      <p className="ledger-label text-ink-faint">Code d’invitation</p>
      <p className="mt-3 font-mono text-2xl font-bold tracking-[0.16em]">{code}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={copy} className="border-3 border-ink px-4 py-2 font-mono text-xs font-bold uppercase">Copier</button>
        <button type="button" onClick={rotate} disabled={pending} className="border-3 border-ink px-4 py-2 font-mono text-xs font-bold uppercase">
          {pending ? "Rotation…" : "Changer le code"}
        </button>
      </div>
      {status && <p className="mt-3 text-sm text-ink-muted" role="status">{status}</p>}
    </div>
  );
}

export function RemoveStudentButton({ classroomId, userId }: { classroomId: string; userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Retirer cet élève de la classe et changer le code d’invitation ?")) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/classes/${classroomId}/members/${userId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Suppression impossible");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Suppression impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="text-right">
      <button type="button" onClick={remove} disabled={pending} className="font-mono text-xs font-bold uppercase underline underline-offset-4">
        {pending ? "Suppression…" : "Retirer"}
      </button>
      {error && <p className="mt-1 text-xs text-correction-red" role="alert">{error}</p>}
    </div>
  );
}
