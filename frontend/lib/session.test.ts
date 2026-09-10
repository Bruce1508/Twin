import { describe, it, expect } from "vitest";
import { buildSession, advanceSession, trimToMin, type SessionStep } from "@/lib/session";
import type { PlanDay } from "@/lib/plan";

const day: PlanDay = {
  day: 9, week: 2, theme: "Routine quotidienne", isReview: false,
  skills: { vocab: "v", grammar: "g", listening: "l", reading: "r", speaking: "s", writing: "w" },
};

describe("buildSession", () => {
  it("full mode emits one step per present skill in canonical order, with routes", () => {
    const steps = buildSession({ planDay: day, weakTag: "accord_adjectif", hasDueCards: true, hasDueTags: false, mode: "full" });
    expect(steps.map((s) => s.kind)).toEqual(["vocab", "grammar", "listening", "reading", "speaking", "writing"]);
    expect(steps[0].route).toBe("/flashcards");
    expect(steps[1].route).toBe("/practice");
    expect(steps.every((s) => s.status === "pending")).toBe(true);
    expect(steps[2].topic).toBe("Routine quotidienne"); // theme threaded as topic
  });

  it("omits vocab step when no due cards and plan day has no vocab", () => {
    const d = { ...day, skills: { grammar: "g" } } as PlanDay;
    const steps = buildSession({ planDay: d, weakTag: null, hasDueCards: false, hasDueTags: false, mode: "full" });
    expect(steps.map((s) => s.kind)).toEqual(["grammar"]);
  });

  it("includes vocab when cards are due even if plan day omits vocab", () => {
    const d = { ...day, skills: { reading: "r" } } as PlanDay;
    const steps = buildSession({ planDay: d, weakTag: null, hasDueCards: true, hasDueTags: false, mode: "full" });
    expect(steps.map((s) => s.kind)).toEqual(["vocab", "reading"]);
  });

  it("includes grammar when a tag is due even if plan day omits grammar", () => {
    const d = { ...day, skills: { reading: "r" } } as PlanDay;
    const steps = buildSession({ planDay: d, weakTag: "accord_adjectif", hasDueCards: false, hasDueTags: true, mode: "full" });
    expect(steps.map((s) => s.kind)).toEqual(["grammar", "reading"]);
  });

  it("omits grammar when no tag is due and plan day has no grammar", () => {
    const d = { ...day, skills: { reading: "r" } } as PlanDay;
    const steps = buildSession({ planDay: d, weakTag: null, hasDueCards: false, hasDueTags: false, mode: "full" });
    expect(steps.map((s) => s.kind)).toEqual(["reading"]);
  });

  it("min mode keeps only vocab + grammar", () => {
    const steps = buildSession({ planDay: day, weakTag: "x", hasDueCards: true, hasDueTags: false, mode: "min" });
    expect(steps.map((s) => s.kind)).toEqual(["vocab", "grammar"]);
  });

  it("never returns an empty session — falls back to first available skill", () => {
    const d = { ...day, skills: { reading: "r" } } as PlanDay;
    const steps = buildSession({ planDay: d, weakTag: null, hasDueCards: false, hasDueTags: false, mode: "min" });
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].kind).toBe("reading");
  });
});

describe("advanceSession", () => {
  it("marks the first pending step done and reports not-completed", () => {
    const steps: SessionStep[] = [
      { kind: "vocab", route: "/flashcards", label: "Réviser", status: "pending" },
      { kind: "grammar", route: "/practice", label: "Pratiquer", status: "pending" },
    ];
    const r = advanceSession(steps);
    expect(r.steps[0].status).toBe("done");
    expect(r.steps[1].status).toBe("pending");
    expect(r.completed).toBe(false);
  });

  it("reports completed when the last pending step is advanced", () => {
    const steps: SessionStep[] = [
      { kind: "vocab", route: "/flashcards", label: "Réviser", status: "done" },
      { kind: "grammar", route: "/practice", label: "Pratiquer", status: "pending" },
    ];
    const r = advanceSession(steps);
    expect(r.completed).toBe(true);
  });
});

describe("trimToMin", () => {
  it("keeps done steps and pending vocab/grammar, drops other pending steps", () => {
    const steps: SessionStep[] = [
      { kind: "vocab", route: "/flashcards", label: "Réviser", status: "done" },
      { kind: "grammar", route: "/practice", label: "Pratiquer", status: "pending" },
      { kind: "listening", route: "/listen", label: "Écouter", status: "pending" },
    ];
    expect(trimToMin(steps).map((s) => s.kind)).toEqual(["vocab", "grammar"]);
  });

  it("leaves no pending step when only non-vocab/grammar steps remain", () => {
    const steps: SessionStep[] = [
      { kind: "vocab", route: "/flashcards", label: "Réviser", status: "done" },
      { kind: "grammar", route: "/practice", label: "Pratiquer", status: "done" },
      { kind: "listening", route: "/listen", label: "Écouter", status: "pending" },
    ];
    const trimmed = trimToMin(steps);
    expect(trimmed.some((s) => s.status === "pending")).toBe(false);
  });
});
