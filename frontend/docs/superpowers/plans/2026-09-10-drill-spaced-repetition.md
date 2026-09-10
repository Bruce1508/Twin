# Drill Spaced Repetition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add spaced-repetition scheduling for drill error-tags so `getNextTarget` stops re-serving the same tag daily and re-checks retention on tags that were previously mastered.

**Architecture:** A new `TagSchedule` model (one row per `userId` + `errorTag`) tracks a `dueAt` date and a `consecutiveImproving` streak that indexes into a fixed day-ladder `[1, 3, 7, 14, 30]`. `getNextTarget` filters candidate tags by `dueAt`; `updateMasterySignal` advances the ladder after each drill grade. The ladder-math and candidate-selection logic are extracted as pure, unit-tested functions — the same separation the codebase already uses for `buildSession`/`advanceSession`/`trimToMin` in `lib/session.ts` (pure, tested) vs. `app/api/today/route.ts` (DB orchestration, untested by vitest, verified manually). `buildSession` gets a new `hasDueTags` param mirroring the existing `hasDueCards` param.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 + PostgreSQL 16, Vitest.

**Spec:** `frontend/docs/superpowers/specs/2026-09-10-drill-spaced-repetition-design.md`

## Global Constraints

- No mastery score, percentage, or level is ever computed or surfaced — scheduling is due/not-due only (PRD's no-CEFR-verdict principle).
- `Drill.resolved` and its existing write path in `updateMasterySignal` are untouched — it stays a display-only badge on `/drill` history.
- Fixed ladder, not SM-2 ease factor: `LADDER_DAYS = [1, 3, 7, 14, 30]` (days), indexed by `consecutiveImproving`.
- **Simplification vs. the spec doc:** the spec's draft `TagSchedule` model listed both `intervalIndex` and `consecutiveImproving` as separate fields — they were always the same number in the spec's own transition rule. This plan uses a single field, `consecutiveImproving`, which also serves as the ladder index. No behavior change, just one fewer redundant column.
- This project's vitest config (`vitest.config.ts`) only includes `lib/**/*.test.ts` — there is no existing Prisma-mocking test harness anywhere in the codebase (confirmed: zero `vi.mock` usages, only `lib/plan.test.ts` and `lib/session.test.ts` exist, both pure-logic). Follow that established convention: unit-test the pure logic, verify DB-touching orchestration manually (Task 8), don't invent new mocking infrastructure.
- Real dev Postgres (`twin-db-1` container) may not be running, and port 5432 may be held by an unrelated project's container (`reviewsignal-postgres-1`). Never stop that container without asking the user first.

---

## Task 1: Ladder transition — pure function `nextSchedule`

**Files:**
- Modify: `frontend/lib/targeting.ts`
- Test: `frontend/lib/targeting.test.ts` (new file)

**Interfaces:**
- Produces: `export type MasterySignal = "improving" | "mixed" | "still_struggling"`, `export const LADDER_DAYS: readonly number[]`, `export function nextSchedule(currentStreak: number, signal: MasterySignal, now: Date): { consecutiveImproving: number; dueAt: Date }`

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/lib/targeting.test.ts
import { describe, it, expect } from "vitest";
import { nextSchedule, LADDER_DAYS } from "@/lib/targeting";

const NOW = new Date("2026-09-10T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("nextSchedule", () => {
  it("advances the streak by one step on improving", () => {
    const r = nextSchedule(0, "improving", NOW);
    expect(r.consecutiveImproving).toBe(1);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + LADDER_DAYS[1] * DAY_MS);
  });

  it("caps the streak at the last ladder rung", () => {
    const lastIndex = LADDER_DAYS.length - 1;
    const r = nextSchedule(lastIndex, "improving", NOW);
    expect(r.consecutiveImproving).toBe(lastIndex);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + LADDER_DAYS[lastIndex] * DAY_MS);
  });

  it("resets the streak to 0 on still_struggling", () => {
    const r = nextSchedule(3, "still_struggling", NOW);
    expect(r.consecutiveImproving).toBe(0);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + LADDER_DAYS[0] * DAY_MS);
  });

  it("leaves the streak unchanged on mixed and reuses the same interval", () => {
    const r = nextSchedule(2, "mixed", NOW);
    expect(r.consecutiveImproving).toBe(2);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + LADDER_DAYS[2] * DAY_MS);
  });

  it("mixed at streak 0 stays at the first rung", () => {
    const r = nextSchedule(0, "mixed", NOW);
    expect(r.consecutiveImproving).toBe(0);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + LADDER_DAYS[0] * DAY_MS);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run lib/targeting.test.ts`
Expected: FAIL — `nextSchedule` and `LADDER_DAYS` are not exported from `@/lib/targeting`.

- [ ] **Step 3: Implement `nextSchedule`**

Add to the top of `frontend/lib/targeting.ts` (after the existing imports, before `getNextTarget`):

```ts
export type MasterySignal = "improving" | "mixed" | "still_struggling";

// Fixed spaced-repetition ladder, in days, indexed by consecutiveImproving.
export const LADDER_DAYS = [1, 3, 7, 14, 30] as const;

export function nextSchedule(
  currentStreak: number,
  signal: MasterySignal,
  now: Date
): { consecutiveImproving: number; dueAt: Date } {
  let consecutiveImproving: number;
  if (signal === "improving") {
    consecutiveImproving = Math.min(currentStreak + 1, LADDER_DAYS.length - 1);
  } else if (signal === "still_struggling") {
    consecutiveImproving = 0;
  } else {
    consecutiveImproving = currentStreak;
  }
  const days = LADDER_DAYS[consecutiveImproving];
  const dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return { consecutiveImproving, dueAt };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run lib/targeting.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend
git add lib/targeting.ts lib/targeting.test.ts
git commit -m "feat(targeting): add nextSchedule ladder transition function"
```

---

## Task 2: Candidate selection — pure function `selectDueCandidate`

**Files:**
- Modify: `frontend/lib/targeting.ts`
- Test: `frontend/lib/targeting.test.ts`

**Interfaces:**
- Consumes: `canRouteToDrill(tag: string): boolean` from `@/lib/generator` (already imported in this file)
- Produces: `export function selectDueCandidate(freq: Record<string, number>, dueMap: Map<string, Date>, now: Date): ErrorTag | null`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/lib/targeting.test.ts`:

```ts
import { selectDueCandidate } from "@/lib/targeting";

describe("selectDueCandidate", () => {
  it("picks the highest-frequency tag with no schedule row", () => {
    const freq = { accord_adjectif: 3, accord_sujet_verbe: 7 };
    const result = selectDueCandidate(freq, new Map(), NOW);
    expect(result).toBe("accord_sujet_verbe");
  });

  it("excludes uncategorized", () => {
    const freq = { uncategorized: 99, accord_adjectif: 1 };
    const result = selectDueCandidate(freq, new Map(), NOW);
    expect(result).toBe("accord_adjectif");
  });

  it("excludes whole-text-only tags that canRouteToDrill rejects", () => {
    const freq = { connecteur_logique_absent: 99, accord_adjectif: 1 };
    const result = selectDueCandidate(freq, new Map(), NOW);
    expect(result).toBe("accord_adjectif");
  });

  it("excludes a tag whose dueAt is in the future", () => {
    const future = new Date(NOW.getTime() + 5 * DAY_MS);
    const freq = { accord_sujet_verbe: 9, accord_adjectif: 1 };
    const dueMap = new Map([["accord_sujet_verbe", future]]);
    const result = selectDueCandidate(freq, dueMap, NOW);
    expect(result).toBe("accord_adjectif");
  });

  it("includes a tag whose dueAt is in the past", () => {
    const past = new Date(NOW.getTime() - DAY_MS);
    const freq = { accord_sujet_verbe: 9 };
    const dueMap = new Map([["accord_sujet_verbe", past]]);
    const result = selectDueCandidate(freq, dueMap, NOW);
    expect(result).toBe("accord_sujet_verbe");
  });

  it("returns null when no candidate is eligible", () => {
    const result = selectDueCandidate({}, new Map(), NOW);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run lib/targeting.test.ts`
Expected: FAIL — `selectDueCandidate` is not exported from `@/lib/targeting`.

- [ ] **Step 3: Implement `selectDueCandidate`**

Add to `frontend/lib/targeting.ts`, directly above the existing `getNextTarget`:

```ts
export function selectDueCandidate(
  freq: Record<string, number>,
  dueMap: Map<string, Date>,
  now: Date
): ErrorTag | null {
  const candidate = Object.entries(freq)
    .filter(([tag]) => {
      if (!canRouteToDrill(tag) || tag === "uncategorized") return false;
      const dueAt = dueMap.get(tag);
      return !dueAt || dueAt <= now;
    })
    .sort(([, a], [, b]) => b - a)[0];

  return (candidate?.[0] as ErrorTag) ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run lib/targeting.test.ts`
Expected: PASS (11 tests total: 5 from Task 1 + 6 from this task)

- [ ] **Step 5: Commit**

```bash
cd frontend
git add lib/targeting.ts lib/targeting.test.ts
git commit -m "feat(targeting): add selectDueCandidate pure selection function"
```

---

## Task 3: `TagSchedule` Prisma model + migration

**Files:**
- Modify: `frontend/prisma/schema.prisma`
- Creates: `frontend/prisma/migrations/<timestamp>_add_tag_schedule/migration.sql` (generated by Prisma, not hand-written)

**Interfaces:**
- Produces: `db.tagSchedule` Prisma Client model with fields `id, userId, errorTag, dueAt, consecutiveImproving, lastDrilledAt`, unique on `[userId, errorTag]` — Tasks 4 and 5 depend on this.

- [ ] **Step 1: Check the environment before touching the database**

Run: `docker ps --format '{{.Names}}\t{{.Ports}}'`

- If a container publishes `0.0.0.0:5432`, check its name. If it's `twin-db-1`, continue — it's already running.
- If it's an unrelated container (e.g. `reviewsignal-postgres-1`), **stop here and ask the user** whether to (a) stop that container temporarily, (b) wait until it's free, or (c) they'll free the port themselves. Do not stop another project's container without explicit confirmation.
- If nothing is running, run: `cd /Users/brucevo/Desktop/twin && docker compose up -d` (binds Postgres 16 on `127.0.0.1:5432`, per `docker-compose.yml`).

- [ ] **Step 2: Add the model to the schema**

In `frontend/prisma/schema.prisma`, add after the `Flashcard` model (after line 147, before the `SpeakingExercise` model):

```prisma
// Spaced-repetition schedule for one (userId, errorTag) pair. Created lazily
// by updateMasterySignal on first grade for that tag. Absence of a row means
// the tag has never been scheduled and is always eligible for selection.
// consecutiveImproving doubles as the index into targeting.ts's LADDER_DAYS.
model TagSchedule {
  id                   String   @id @default(cuid())
  userId               String
  errorTag             String
  dueAt                DateTime @default(now())
  consecutiveImproving Int      @default(0)
  lastDrilledAt        DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, errorTag])
}
```

Then add the back-relation on `model User` (`frontend/prisma/schema.prisma:26-41`), alongside the other `Type[]` relation fields:

```prisma
  tagSchedules TagSchedule[]
```

- [ ] **Step 3: Generate and run the migration**

Run: `cd frontend && npx prisma migrate dev --name add_tag_schedule`
Expected: Prisma creates `prisma/migrations/<timestamp>_add_tag_schedule/migration.sql`, applies it, and regenerates the Prisma Client. No prompts about data loss (this is a purely additive migration).

- [ ] **Step 4: Verify the client compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors. (This project's established verification step for schema/type changes — see `2026-09-10-drillhist-session.tmp` session notes: `npx tsc --noEmit` clean was the acceptance check for the last shipped feature too.)

- [ ] **Step 5: Commit**

```bash
cd frontend
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add TagSchedule model for drill spaced repetition"
```

---

## Task 4: Wire `getNextTarget` to `selectDueCandidate`

**Files:**
- Modify: `frontend/lib/targeting.ts:9-28` (the existing `getNextTarget` function)

**Interfaces:**
- Consumes: `selectDueCandidate` (Task 2), `db.tagSchedule.findMany` (Task 3)
- Produces: `getNextTarget(userId: string): Promise<ErrorTag | null>` — same signature as before. Existing callers (`app/api/today/route.ts:27`, `app/api/practice/next-target/route.ts:9`) are unaffected.

- [ ] **Step 1: Replace the resolved-tags query with a schedule lookup**

Replace the current body of `getNextTarget` in `frontend/lib/targeting.ts` (lines 9-28):

```ts
// Before:
export async function getNextTarget(userId: string): Promise<ErrorTag | null> {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const freq = (profile.errorFrequencies as Record<string, number>) ?? {};

  const resolvedDrills = await db.drill.findMany({
    where: { userId, resolved: true },
    select: { sourceError: { select: { errorTag: true } } },
  });
  const resolvedTags = new Set(
    resolvedDrills.map((d: any) => d.sourceError?.errorTag).filter(Boolean)
  );

  const candidate = Object.entries(freq)
    .filter(([tag]) => canRouteToDrill(tag) && !resolvedTags.has(tag) && tag !== "uncategorized")
    .sort(([, a], [, b]) => b - a)[0];

  return (candidate?.[0] as ErrorTag) ?? null;
}
```

with:

```ts
export async function getNextTarget(userId: string): Promise<ErrorTag | null> {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const freq = (profile.errorFrequencies as Record<string, number>) ?? {};

  const schedules = await db.tagSchedule.findMany({ where: { userId } });
  const dueMap = new Map(schedules.map((s) => [s.errorTag, s.dueAt]));

  return selectDueCandidate(freq, dueMap, new Date());
}
```

- [ ] **Step 2: Run the full unit test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS — this change has no dedicated unit test of its own (it's thin DB orchestration; `selectDueCandidate`, the logic it delegates to, is already covered by Task 2's tests). `lib/plan.test.ts`, `lib/session.test.ts`, and `lib/targeting.test.ts` should all still pass unmodified.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add lib/targeting.ts
git commit -m "feat(targeting): getNextTarget selects by TagSchedule due date"
```

---

## Task 5: Wire `updateMasterySignal` to upsert `TagSchedule`

**Files:**
- Modify: `frontend/lib/targeting.ts:34-70` (the existing `updateMasterySignal` function)

**Interfaces:**
- Consumes: `nextSchedule` (Task 1), `db.tagSchedule.findUnique` / `.upsert` (Task 3)
- Produces: `updateMasterySignal(drillId, userId, errorTag, signal): Promise<void>` — same signature. Sole caller `app/api/drills/[drillId]/grade/route.ts:71` is unaffected.

- [ ] **Step 1: Move the schedule upsert before the early return, so every signal updates it**

Replace the full body of `updateMasterySignal` in `frontend/lib/targeting.ts` with:

```ts
export async function updateMasterySignal(
  drillId: string,
  userId: string,
  errorTag: string,
  signal: MasterySignal
): Promise<void> {
  // Store signal on this drill's payload
  const current = await db.drill.findUnique({ where: { id: drillId } });
  if (current) {
    const payload = (current.payload as any) ?? {};
    await db.drill.update({
      where: { id: drillId },
      data: { payload: { ...payload, last_mastery_signal: signal } },
    });
  }

  const now = new Date();
  const existing = await db.tagSchedule.findUnique({
    where: { userId_errorTag: { userId, errorTag } },
  });
  const { consecutiveImproving, dueAt } = nextSchedule(
    existing?.consecutiveImproving ?? 0,
    signal,
    now
  );
  await db.tagSchedule.upsert({
    where: { userId_errorTag: { userId, errorTag } },
    create: { userId, errorTag, consecutiveImproving, dueAt, lastDrilledAt: now },
    update: { consecutiveImproving, dueAt, lastDrilledAt: now },
  });

  if (signal !== "improving") return;

  // Check if last N drills for this tag all have "improving"
  const recent = await db.drill.findMany({
    where: { userId, sourceError: { errorTag } },
    orderBy: { createdAt: "desc" },
    take: MASTERY_THRESHOLD,
    select: { payload: true },
  });

  const allImproving =
    recent.length >= MASTERY_THRESHOLD &&
    recent.every((d: any) => (d.payload as any)?.last_mastery_signal === "improving");

  if (allImproving) {
    await db.drill.updateMany({
      where: { userId, sourceError: { errorTag } },
      data: { resolved: true },
    });
  }
}
```

Everything above the new schedule-upsert block (the `payload` write) and everything from `if (signal !== "improving") return;` onward (the existing `resolved`-badge logic) is byte-for-byte unchanged from the current file — only the new block and the `signal` parameter's type (now `MasterySignal` instead of the inline union) are new. Putting the upsert before the early return is what makes `still_struggling` and `mixed` signals update the schedule too, not just `improving`.

- [ ] **Step 2: Run the full unit test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS. No dedicated unit test for this function itself (DB orchestration, per the Global Constraints convention) — `nextSchedule`, the logic it delegates to, is already covered by Task 1's tests.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add lib/targeting.ts
git commit -m "feat(targeting): updateMasterySignal advances TagSchedule on every grade"
```

---

## Task 6: `buildSession` gets `hasDueTags`

**Files:**
- Modify: `frontend/lib/session.ts:28-64`
- Test: `frontend/lib/session.test.ts`

**Interfaces:**
- Produces: `buildSession(input: { planDay: PlanDay; weakTag: string | null; hasDueCards: boolean; hasDueTags: boolean; mode: SessionMode }): SessionStep[]` — the `hasDueTags` field is new and required (matches how `hasDueCards` is already required, not optional).

- [ ] **Step 1: Write the failing tests**

In `frontend/lib/session.test.ts`, every existing `buildSession(...)` call needs `hasDueTags` added (TypeScript will fail to compile otherwise since it's a required field). Replace the entire `describe("buildSession", ...)` block with:

```ts
describe("buildSession", () => {
  it("full mode emits one step per present skill in canonical order, with routes", () => {
    const steps = buildSession({ planDay: day, weakTag: "accord_adjectif", hasDueCards: true, hasDueTags: false, mode: "full" });
    expect(steps.map((s) => s.kind)).toEqual(["vocab", "grammar", "listening", "reading", "speaking", "writing"]);
    expect(steps[0].route).toBe("/flashcards");
    expect(steps[1].route).toBe("/practice");
    expect(steps.every((s) => s.status === "pending")).toBe(true);
    expect(steps[2].topic).toBe("Routine quotidienne");
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
```

(Two new tests added: "includes grammar when a tag is due..." and "omits grammar when no tag is due..." — everything else is the same five tests as before, just with `hasDueTags` added to each call.)

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd frontend && npx vitest run lib/session.test.ts`
Expected: FAIL — `hasDueTags` doesn't exist on `buildSession`'s input type yet (TypeScript compile error surfaces as a test run failure under vitest), and the two new due-tag assertions fail.

- [ ] **Step 3: Implement `hasDueTags` in `buildSession`**

In `frontend/lib/session.ts`, update the `buildSession` signature (lines 28-33) and body (lines 34-42):

```ts
// Before:
export function buildSession(input: {
  planDay: PlanDay;
  weakTag: string | null;
  hasDueCards: boolean;
  mode: SessionMode;
}): SessionStep[] {
  const { planDay, hasDueCards, mode } = input;

  // Which kinds are active today: any skill present on the plan day,
  // plus vocab whenever SRS cards are due (review always earns its place).
  const active = new Set<StepKind>();
  for (const k of CANONICAL) {
    if (planDay.skills[k]) active.add(k);
  }
  if (hasDueCards) active.add("vocab");
```

```ts
// After:
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run lib/session.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add lib/session.ts lib/session.test.ts
git commit -m "feat(session): buildSession surfaces grammar step when a tag is due"
```

---

## Task 7: `app/api/today/route.ts` derives `hasDueTags`

**Files:**
- Modify: `frontend/app/api/today/route.ts:27-29`

**Interfaces:**
- Consumes: `getNextTarget` (Task 4, unchanged signature), `buildSession` (Task 6, new `hasDueTags` param)

- [ ] **Step 1: Derive `hasDueTags` from `weakTag` and pass it through**

In `frontend/app/api/today/route.ts`, replace lines 27-29:

```ts
// Before:
      const weakTag = await getNextTarget(userId);
      const dueCount = await db.flashcard.count({ where: { userId, dueAt: { lte: new Date() } } });
      steps = buildSession({ planDay, weakTag, hasDueCards: dueCount > 0, mode });
```

```ts
// After:
      const weakTag = await getNextTarget(userId);
      const hasDueTags = weakTag !== null;
      const dueCount = await db.flashcard.count({ where: { userId, dueAt: { lte: new Date() } } });
      steps = buildSession({ planDay, weakTag, hasDueCards: dueCount > 0, hasDueTags, mode });
```

`getNextTarget` (Task 4) now only returns a tag when it's actually due — see `selectDueCandidate`'s `dueAt` filter — so `weakTag !== null` is exactly "a tag is due." No new query needed.

- [ ] **Step 2: Run the full unit test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS. This file has no dedicated test (matches the existing convention — `app/api/today/route.ts` wasn't unit-tested before this change either; `buildSession`, the logic it delegates to, is covered by Task 6).

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add app/api/today/route.ts
git commit -m "feat(today): surface due grammar tags in the daily session"
```

---

## Task 8: Manual end-to-end verification

No file changes — this task confirms the wired-together behavior against a real database, following the same throwaway-container pattern the last shipped feature (`f1fa813`, Drill history) used, since `npx prisma db seed` is broken in this repo under Prisma 7 (see session notes) and there's no other seeding path.

- [ ] **Step 1: Start a throwaway Postgres container**

```bash
docker run -d --name twin-db-test -p 5433:5432 \
  -e POSTGRES_USER=twin -e POSTGRES_PASSWORD=twin -e POSTGRES_DB=twin_dev \
  postgres:16-alpine
```

- [ ] **Step 2: Apply migrations to it**

```bash
cd frontend
DATABASE_URL="postgresql://twin:twin@localhost:5433/twin_dev?schema=public" npx prisma migrate deploy
```

Expected: all migrations apply cleanly, including the new `add_tag_schedule` one from Task 3.

- [ ] **Step 3: Seed a synthetic user, profile, and error event via SQL**

```bash
docker exec twin-db-test psql -U twin twin_dev -c "
INSERT INTO \"User\" (id, email, \"targetLevel\", \"createdAt\") VALUES ('u1', 'test@example.com', 'B2', now());
INSERT INTO \"Profile\" (id, \"userId\", \"errorFrequencies\", \"knownVocab\", \"complexityTrend\", \"computedAt\")
  VALUES ('p1', 'u1', '{\"accord_adjectif\": 5, \"accord_sujet_verbe\": 2}', 0, '{}', now());
"
```

- [ ] **Step 4: Verify `getNextTarget` picks the highest-frequency tag with no schedule row**

```bash
docker exec twin-db-test psql -U twin twin_dev -c "SELECT * FROM \"TagSchedule\";"
```

Expected: empty (no rows yet — nothing has been drilled). This confirms the "no row = due" path Task 4 relies on. Then start the app against this DB (`DATABASE_URL=... DEV_USER_ID=u1 npm run dev`) and hit `GET /api/practice/next-target` — expect `{"errorTag":"accord_adjectif", ...}` (highest frequency, no schedule row, so eligible).

- [ ] **Step 5: Simulate a graded drill and verify the schedule advances**

Drive one drill through the UI in a browser (`mcp__plugin_playwright_playwright__*` — works out of the box in this repo; avoid `mcp__plugin_ecc_playwright__*`, it needs an uninstalled extension bridge per session notes), grade it with an "improving" outcome, then check:

```bash
docker exec twin-db-test psql -U twin twin_dev -c "SELECT \"errorTag\", \"dueAt\", \"consecutiveImproving\" FROM \"TagSchedule\" WHERE \"userId\" = 'u1';"
```

Expected: one row for the graded tag, `consecutiveImproving = 1`, `dueAt` ≈ 3 days from now (`LADDER_DAYS[1]`).

- [ ] **Step 6: Verify `/api/today` surfaces the grammar step correctly**

With the schedule row from Step 5 now due-in-the-future, confirm `GET /api/today` (fresh session, no active plan day grammar) does **not** include a `grammar` step. Then manually set `dueAt` to the past for that row and re-request — confirm the `grammar` step now appears:

```bash
docker exec twin-db-test psql -U twin twin_dev -c "UPDATE \"TagSchedule\" SET \"dueAt\" = now() - interval '1 day' WHERE \"userId\" = 'u1';"
```

- [ ] **Step 7: Tear down**

```bash
docker rm -f twin-db-test
```

No commit for this task — it verifies Tasks 1-7, it doesn't change any files.
