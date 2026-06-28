"use client";

import { useSessionStep } from "@/app/useSessionStep";

export default function SessionStepButton() {
  const { inSession, completeStep } = useSessionStep();
  if (!inSession) return null;
  return (
    <button
      onClick={completeStep}
      className="w-full rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-3 text-sm font-medium"
    >
      Continuer la séance →
    </button>
  );
}
