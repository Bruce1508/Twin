import type { PlanDay } from "@/lib/plan";

export type StepKind = "vocab" | "grammar" | "listening" | "reading" | "speaking" | "writing";
export type StepStatus = "pending" | "done";
export type SessionStep = { kind: StepKind; route: string; label: string; topic?: string; status: StepStatus };
export type SessionMode = "full" | "min";

const CANONICAL: StepKind[] = ["vocab", "grammar", "listening", "reading", "speaking", "writing"];

const ROUTE: Record<StepKind, string> = {
  vocab: "/flashcards",
  grammar: "/practice",
  listening: "/listen",
  reading: "/read",
  speaking: "/speak",
  writing: "/submit",
};

const LABEL: Record<StepKind, string> = {
  vocab: "Réviser",
  grammar: "Pratiquer",
  listening: "Écouter",
  reading: "Lire",
  speaking: "Parler",
  writing: "Écrire",
};

export function buildSession(input: {
  planDay: PlanDay;
  weakTag: string | null;
  hasDueCards: boolean;
  hasDueTags: boolean;
  mode: SessionMode;
}): SessionStep[] {
  const { planDay, hasDueCards, hasDueTags, mode } = input;

  // Which kinds are active today: any skill present on the plan day,
  // plus vocab whenever SRS cards are due and grammar whenever a drill
  // tag is due (review always earns its place).
  const active = new Set<StepKind>();
  for (const k of CANONICAL) {
    if (planDay.skills[k]) active.add(k);
  }
  if (hasDueCards) active.add("vocab");
  if (hasDueTags) active.add("grammar");

  let kinds = CANONICAL.filter((k) => active.has(k));

  // Never empty: fall back to the first skill listed on the plan day.
  if (kinds.length === 0) {
    const first = CANONICAL.find((k) => planDay.skills[k]);
    if (first) kinds = [first];
  }

  if (mode === "min") {
    const minKinds = kinds.filter((k) => k === "vocab" || k === "grammar");
    kinds = minKinds.length > 0 ? minKinds : kinds.slice(0, 1);
  }

  return kinds.map((kind) => ({
    kind,
    route: ROUTE[kind],
    label: LABEL[kind],
    topic: planDay.theme,
    status: "pending" as const,
  }));
}

export function advanceSession(steps: SessionStep[]): { steps: SessionStep[]; completed: boolean } {
  const next = steps.map((s) => ({ ...s }));
  const idx = next.findIndex((s) => s.status === "pending");
  if (idx >= 0) next[idx].status = "done";
  const completed = next.every((s) => s.status === "done");
  return { steps: next, completed };
}

export function trimToMin(steps: SessionStep[]): SessionStep[] {
  return steps.filter(
    (s) => s.status === "done" || s.kind === "vocab" || s.kind === "grammar"
  );
}
