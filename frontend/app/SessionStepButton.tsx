"use client";

import { useSessionStep } from "@/app/useSessionStep";

export default function SessionStepButton() {
  const { inSession, completeStep } = useSessionStep();
  if (!inSession) return null;
  return (
    <button
      onClick={completeStep}
      className="w-full border-3 border-ink bg-ink px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-paper-raised hover:bg-paper-raised hover:text-ink"
    >
      Continuer la séance →
    </button>
  );
}
