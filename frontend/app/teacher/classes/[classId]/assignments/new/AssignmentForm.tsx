"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TASK_TYPES } from "@/lib/extractor";

type EditableAssignment = {
  id: string;
  title: string;
  instructions: string;
  taskType: string;
  dueAt: string | null;
};

function dateTimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function AssignmentForm({
  classroomId,
  assignment,
}: {
  classroomId: string;
  assignment?: EditableAssignment;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const dueValue = form.get("dueAt") as string;
    try {
      const response = await fetch(assignment ? `/api/assignments/${assignment.id}` : `/api/classes/${classroomId}/assignments`, {
        method: assignment ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          instructions: form.get("instructions"),
          taskType: form.get("taskType"),
          dueAt: dueValue ? new Date(dueValue).toISOString() : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Création impossible");
      router.push(`/classes/${classroomId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Création impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-3 border-ink bg-paper-raised p-6 sm:p-9">
      <label className="block font-mono text-xs font-bold uppercase tracking-wider" htmlFor="assignment-title">Titre</label>
      <input id="assignment-title" name="title" required maxLength={150} defaultValue={assignment?.title} className="mt-2 w-full px-3 py-3" />

      <label className="mt-6 block font-mono text-xs font-bold uppercase tracking-wider" htmlFor="assignment-instructions">Consigne</label>
      <textarea id="assignment-instructions" name="instructions" required maxLength={5000} rows={7} defaultValue={assignment?.instructions} className="mt-2 w-full resize-y px-3 py-3" />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block font-mono text-xs font-bold uppercase tracking-wider" htmlFor="task-type">Type d’écriture</label>
          <select id="task-type" name="taskType" defaultValue={assignment?.taskType} className="mt-2 w-full px-3 py-3">
            {TASK_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-mono text-xs font-bold uppercase tracking-wider" htmlFor="due-at">Échéance optionnelle</label>
          <input id="due-at" name="dueAt" type="datetime-local" defaultValue={dateTimeLocalValue(assignment?.dueAt ?? null)} className="mt-2 w-full px-3 py-3" />
        </div>
      </div>

      {error && <p className="mt-5 text-sm text-correction-red" role="alert">{error}</p>}
      <button type="submit" disabled={pending} className="mt-7 px-5 py-3">
        {pending ? "Enregistrement…" : assignment ? "Enregistrer les modifications" : "Enregistrer le brouillon"}
      </button>
    </form>
  );
}
