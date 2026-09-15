"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AssignmentActions({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status === "CLOSED") return null;
  const nextStatus = status === "DRAFT" ? "PUBLISHED" : "CLOSED";

  async function transition() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Mise à jour impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span>
      <button type="button" onClick={transition} disabled={pending} className="font-mono text-xs font-bold uppercase underline underline-offset-4">
        {pending ? "Mise à jour…" : nextStatus === "PUBLISHED" ? "Publier" : "Fermer"}
      </button>
      {error && <small className="ml-3 text-correction-red" role="alert">{error}</small>}
    </span>
  );
}
