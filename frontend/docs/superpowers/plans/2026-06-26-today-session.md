# "Aujourd'hui" — Zero-Decision Daily Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 7-item home menu with one button that launches a pre-assembled, sequential daily study session, so the user never has to decide what to study and never feels "behind."

**Architecture:** A pure "session orchestration" layer (`lib/session.ts`) assembles an ordered list of steps from three sources — the encoded 56-day plan (`lib/plan.ts`), the user's weakest error tag (`getNextTarget`), and due SRS flashcards. Progress lives in one Prisma row (`SessionProgress`) keyed to `DEV_USER_ID`; `planPosition` is a queue index that only advances on completion (never by calendar), so skipped days cost nothing. The `/today` page is a stepper that deep-links into existing activity pages in `?session=1` mode; on completion each page calls `/api/today/advance` and returns to `/today`.

**Tech Stack:** Next.js (this repo's modified build — read `node_modules/next/dist/docs/` before writing routing/navigation/route-handler code), React (client components), Prisma + `@prisma/adapter-pg` (Postgres), Vitest (added in Task 1).

## Global Constraints

- App is single-user via `process.env.DEV_USER_ID`. Every API route reads it; return HTTP 503 `{ error: "DEV_USER_ID not configured" }` when missing (match `app/api/flashcards/route.ts`).
- DB access only through `import { db } from "@/lib/db"`. Never instantiate PrismaClient elsewhere.
- This is NOT stock Next.js. Before writing any route handler, page, or navigation hook, read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices (per `AGENTS.md`).
- Reuse existing generate/grade APIs, flashcards SRS, `getNextTarget`, `Profile` — do not reimplement them.
- Surgical edits to existing activity pages: only add session-completion behavior; do not refactor or restyle them.
- UI copy stays French (match existing pages); code comments/English fine.
- Out of scope (do NOT build): predicted-score meter, notifications, streaks, AI examiner roleplay, TCF→DELF re-theme.

---

### Task 1: Session orchestration core (pure logic) + Vitest setup

**Files:**
- Modify: `package.json` (add vitest devDep + `test` script)
- Create: `vitest.config.ts`
- Create: `lib/session.ts`
- Test: `lib/session.test.ts`

**Interfaces:**
- Consumes: `PlanDay` type from Task 2 — to avoid a circular dependency, **define `PlanDay` in Task 2's `lib/plan.ts` and import the type here**. For Task 1, import only the type:
  `import type { PlanDay } from "@/lib/plan";` (type-only import compiles even before plan.ts data is filled).
- Produces:
  ```ts
  export type StepKind = "vocab" | "grammar" | "listening" | "reading" | "speaking" | "writing";
  export type StepStatus = "pending" | "done";
  export type SessionStep = { kind: StepKind; route: string; label: string; topic?: string; status: StepStatus };
  export type SessionMode = "full" | "min";
  export function buildSession(input: { planDay: PlanDay; weakTag: string | null; hasDueCards: boolean; mode: SessionMode }): SessionStep[];
  export function advanceSession(steps: SessionStep[]): { steps: SessionStep[]; completed: boolean };
  export function trimToMin(steps: SessionStep[]): SessionStep[];
  ```

- [ ] **Step 1: Add Vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add test script to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
```

- [ ] **Step 4: Write the failing test** — `lib/session.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildSession, advanceSession, trimToMin, type SessionStep } from "@/lib/session";
import type { PlanDay } from "@/lib/plan";

const day: PlanDay = {
  day: 9, week: 2, theme: "Routine quotidienne", isReview: false,
  skills: { vocab: "v", grammar: "g", listening: "l", reading: "r", speaking: "s", writing: "w" },
};

describe("buildSession", () => {
  it("full mode emits one step per present skill in canonical order, with routes", () => {
    const steps = buildSession({ planDay: day, weakTag: "accord_adjectif", hasDueCards: true, mode: "full" });
    expect(steps.map((s) => s.kind)).toEqual(["vocab", "grammar", "listening", "reading", "speaking", "writing"]);
    expect(steps[0].route).toBe("/flashcards");
    expect(steps[1].route).toBe("/practice");
    expect(steps.every((s) => s.status === "pending")).toBe(true);
    expect(steps[2].topic).toBe("Routine quotidienne"); // theme threaded as topic
  });

  it("omits vocab step when no due cards and plan day has no vocab", () => {
    const d = { ...day, skills: { grammar: "g" } } as PlanDay;
    const steps = buildSession({ planDay: d, weakTag: null, hasDueCards: false, mode: "full" });
    expect(steps.map((s) => s.kind)).toEqual(["grammar"]);
  });

  it("includes vocab when cards are due even if plan day omits vocab", () => {
    const d = { ...day, skills: { reading: "r" } } as PlanDay;
    const steps = buildSession({ planDay: d, weakTag: null, hasDueCards: true, mode: "full" });
    expect(steps.map((s) => s.kind)).toEqual(["vocab", "reading"]);
  });

  it("min mode keeps only vocab + grammar", () => {
    const steps = buildSession({ planDay: day, weakTag: "x", hasDueCards: true, mode: "min" });
    expect(steps.map((s) => s.kind)).toEqual(["vocab", "grammar"]);
  });

  it("never returns an empty session — falls back to first available skill", () => {
    const d = { ...day, skills: { reading: "r" } } as PlanDay;
    const steps = buildSession({ planDay: d, weakTag: null, hasDueCards: false, mode: "min" });
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
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/session'` (or `buildSession is not a function`).

- [ ] **Step 6: Implement `lib/session.ts`**

```ts
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all `lib/session.test.ts` cases green). `lib/plan.ts` does not exist yet — the type-only import resolves once Task 2 creates the file; if `npm test` errors on the missing module, do Task 2 Step 1 first, then return here. (Recommended: implement Task 2 Step 1 before running.)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/session.ts lib/session.test.ts
git commit -m "feat(today): add session orchestration core + vitest

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Encode the 56-day plan — `lib/plan.ts`

**Files:**
- Create: `scripts/extract-plan.mjs` (one-shot generator)
- Create: `lib/plan.ts` (type + helpers + generated data)
- Test: `lib/plan.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PlanDay = {
    day: number; week: number; theme: string;
    skills: { vocab?: string; grammar?: string; listening?: string; reading?: string; speaking?: string; writing?: string };
    isReview: boolean;
  };
  export const PLAN: PlanDay[];               // length 56
  export function getPlanDay(position: number): PlanDay; // clamps to [1, PLAN.length]
  ```

- [ ] **Step 1: Create `lib/plan.ts` type + helpers skeleton first** (so Task 1's type import resolves)

```ts
export type PlanDay = {
  day: number;
  week: number;
  theme: string;
  skills: {
    vocab?: string;
    grammar?: string;
    listening?: string;
    reading?: string;
    speaking?: string;
    writing?: string;
  };
  isReview: boolean;
};

// PLAN is generated by scripts/extract-plan.mjs from
// ../French_A0_to_A2_56_day_plan.xlsx — do not hand-edit the array below.
export const PLAN: PlanDay[] = []; // replaced in Step 3

export function getPlanDay(position: number): PlanDay {
  const i = Math.min(Math.max(position, 1), PLAN.length) - 1;
  return PLAN[i];
}
```

- [ ] **Step 2: Write the extraction generator** — `scripts/extract-plan.mjs`

```js
// Generates the PLAN array in lib/plan.ts from the source spreadsheet.
// Run from the frontend/ dir:  npm install -D fflate && node scripts/extract-plan.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";

const xlsxPath = "../French_A0_to_A2_56_day_plan.xlsx";
const buf = new Uint8Array(readFileSync(xlsxPath));
const files = unzipSync(buf);
const sheet = strFromU8(files["xl/worksheets/sheet2.xml"]);

// Sheet2 stores inline strings (<is><t>...</t></is>). Parse rows in order.
const rowBlocks = sheet.split("<row").slice(1);
const rows = rowBlocks.map((block) => {
  const cells = [];
  for (const m of block.matchAll(/<c[^>]*>(.*?)<\/c>/gs)) {
    const t = m[1].match(/<t[^>]*>(.*?)<\/t>/s);
    cells.push(t ? decode(t[1]) : "");
  }
  return cells;
});
function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"');
}

// Row 0 is the header: Day, Week, Theme, Vocabulary, Grammar, Listening, Reading, Speaking, Writing, Checklist
const data = rows.slice(1).filter((r) => r[0]).map((r) => ({
  day: Number(r[0]),
  week: Number(r[1]),
  theme: r[2] ?? "",
  skills: {
    vocab: r[3] || undefined,
    grammar: r[4] || undefined,
    listening: r[5] || undefined,
    reading: r[6] || undefined,
    speaking: r[7] || undefined,
    writing: r[8] || undefined,
  },
  isReview: /review/i.test(r[2] ?? ""),
}));

const src = readFileSync("lib/plan.ts", "utf8");
const out = src.replace(
  /export const PLAN: PlanDay\[\] = \[\][^\n]*/,
  "export const PLAN: PlanDay[] = " + JSON.stringify(data, null, 2)
);
writeFileSync("lib/plan.ts", out);
console.log(`Wrote ${data.length} plan days into lib/plan.ts`);
```

- [ ] **Step 3: Run the generator**

Run: `npm install -D fflate && node scripts/extract-plan.mjs`
Expected: `Wrote 56 plan days into lib/plan.ts`. Open `lib/plan.ts` and confirm `PLAN` now holds 56 objects and `getPlanDay` is still below it.

- [ ] **Step 4: Write the failing test** — `lib/plan.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { PLAN, getPlanDay } from "@/lib/plan";

describe("PLAN data", () => {
  it("has all 56 days, numbered 1..56", () => {
    expect(PLAN).toHaveLength(56);
    expect(PLAN.map((d) => d.day)).toEqual(Array.from({ length: 56 }, (_, i) => i + 1));
  });

  it("day 1 is the alphabet/greetings theme with grammar + speaking present", () => {
    expect(PLAN[0].theme.toLowerCase()).toContain("alphabet");
    expect(PLAN[0].skills.grammar).toBeTruthy();
    expect(PLAN[0].skills.speaking).toBeTruthy();
  });

  it("flags weekly review days (day 7) as isReview", () => {
    expect(PLAN[6].isReview).toBe(true);
  });

  it("getPlanDay clamps out-of-range positions", () => {
    expect(getPlanDay(0).day).toBe(1);
    expect(getPlanDay(999).day).toBe(56);
    expect(getPlanDay(9).day).toBe(9);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS for both `lib/plan.test.ts` and `lib/session.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/plan.ts lib/plan.test.ts scripts/extract-plan.mjs package.json package-lock.json
git commit -m "feat(today): encode 56-day DELF plan as lib/plan.ts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `SessionProgress` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma` (add model + relation field on `User`)

**Interfaces:**
- Produces: Prisma model `SessionProgress` (fields `userId @unique`, `planPosition Int @default(1)`, `activeSession Json?`, `startedAt DateTime?`, `lastCompletedAt DateTime?`). Accessed as `db.sessionProgress`.

- [ ] **Step 1: Add the relation field to `User`**

In `model User { ... }`, add alongside the other relations:
```prisma
  sessionProgress   SessionProgress?
```

- [ ] **Step 2: Add the model** (place after `Profile`, matching file style)

```prisma
// Single-row-per-user queue state for the "Aujourd'hui" daily session.
// planPosition is a QUEUE index into lib/plan.ts PLAN — it advances only when a
// session is completed, never by calendar date, so skipped days never create a
// "behind" state. activeSession holds the in-progress SessionStep[] for resume.
model SessionProgress {
  id              String    @id @default(cuid())
  userId          String    @unique
  planPosition    Int       @default(1)
  activeSession   Json?
  startedAt       DateTime?
  lastCompletedAt DateTime?

  user User @relation(fields: [userId], references: [id])
}
```

- [ ] **Step 3: Create the migration**

Run: `npx prisma migrate dev --name add_session_progress`
Expected: migration created and applied; `app/generated/prisma` client regenerated. If the environment has no dev DB, run `npx prisma migrate dev --create-only --name add_session_progress` then `npx prisma generate`, and apply the SQL when a DB is available.

- [ ] **Step 4: Verify the client typechecks**

Run: `npx tsc --noEmit`
Expected: no errors. (`db.sessionProgress` becomes available after generate.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations app/generated/prisma
git commit -m "feat(today): add SessionProgress model

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: API — `GET /api/today` and `POST /api/today/advance`

**Files:**
- Create: `app/api/today/route.ts`
- Create: `app/api/today/advance/route.ts`

**Interfaces:**
- Consumes: `buildSession`, `trimToMin`, `advanceSession`, `SessionStep`, `SessionMode` from `@/lib/session`; `getPlanDay` from `@/lib/plan`; `getNextTarget` from `@/lib/targeting`; `db` from `@/lib/db`; `Prisma` from `@/app/generated/prisma/client`.
- Produces (response shapes Task 5 relies on):
  ```ts
  // GET /api/today  ->  200
  type TodayResponse = { day: number; theme: string; isReview: boolean; steps: SessionStep[]; planPosition: number };
  // POST /api/today/advance  ->  200
  type AdvanceResponse = { completed: boolean; steps: SessionStep[] };
  ```

> Before writing these, read `node_modules/next/dist/docs/` for this build's route-handler signature (request object, reading query params, returning JSON). The snippets below follow the conventions in `app/api/flashcards/route.ts` and `app/api/listening/[exerciseId]/grade/route.ts` — confirm they still match.

- [ ] **Step 1: Implement `GET /api/today`** — `app/api/today/route.ts`

```ts
import { db } from "@/lib/db";
import { getPlanDay } from "@/lib/plan";
import { getNextTarget } from "@/lib/targeting";
import { buildSession, trimToMin, type SessionStep, type SessionMode } from "@/lib/session";

export async function GET(req: Request) {
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  const url = new URL(req.url);
  const mode: SessionMode = url.searchParams.get("mode") === "min" ? "min" : "full";

  try {
    const progress = await db.sessionProgress.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const planDay = getPlanDay(progress.planPosition);
    let steps = (progress.activeSession as SessionStep[] | null) ?? null;
    const hasPending = steps?.some((s) => s.status === "pending") ?? false;

    if (!steps || !hasPending) {
      // No live session: build a fresh one for the current queue position.
      const weakTag = await getNextTarget(userId);
      const dueCount = await db.flashcard.count({ where: { userId, dueAt: { lte: new Date() } } });
      steps = buildSession({ planDay, weakTag, hasDueCards: dueCount > 0, mode });
      await db.sessionProgress.update({
        where: { userId },
        data: { activeSession: steps, startedAt: new Date() },
      });
    } else if (mode === "min") {
      // Live session + explicit "10 min" request: trim remaining pending steps.
      steps = trimToMin(steps);
      await db.sessionProgress.update({ where: { userId }, data: { activeSession: steps } });
    }

    return Response.json({
      day: planDay.day,
      theme: planDay.theme,
      isReview: planDay.isReview,
      steps,
      planPosition: progress.planPosition,
    });
  } catch (e) {
    console.error("GET /api/today failed:", e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement `POST /api/today/advance`** — `app/api/today/advance/route.ts`

```ts
import { db } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { advanceSession, type SessionStep } from "@/lib/session";

export async function POST() {
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  try {
    const progress = await db.sessionProgress.findUnique({ where: { userId } });
    const steps = (progress?.activeSession as SessionStep[] | null) ?? null;
    if (!steps) return Response.json({ completed: true, steps: [] });

    const { steps: next, completed } = advanceSession(steps);

    if (completed) {
      await db.sessionProgress.update({
        where: { userId },
        data: {
          planPosition: { increment: 1 }, // queue advances ONLY on completion
          activeSession: Prisma.DbNull,    // actually null the Json? column (undefined = no change)
          lastCompletedAt: new Date(),
        },
      });
    } else {
      await db.sessionProgress.update({ where: { userId }, data: { activeSession: next } });
    }

    return Response.json({ completed, steps: next });
  } catch (e) {
    console.error("POST /api/today/advance failed:", e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
```

> Verify the `Prisma` import path against this repo's generated client (`app/generated/prisma`). If `Prisma.DbNull` is not exported there, use `db.sessionProgress.update` with raw `{ activeSession: null }` only if Prisma accepts JS `null` for `Json?` nulling in this version — otherwise keep `Prisma.DbNull`.

- [ ] **Step 3: Manual verification (no DB-mocking test infra exists)**

Run the dev server: `npm run dev`. Then:
```bash
curl -s localhost:3000/api/today | python3 -m json.tool
```
Expected: JSON with `day`, `theme`, and a non-empty `steps` array whose first step `route` is `/flashcards` or `/practice`.
```bash
curl -s -X POST localhost:3000/api/today/advance | python3 -m json.tool
```
Expected: `completed: false` and the first step now `"status": "done"`. Repeat POST until `completed: true`; then `GET /api/today` reports `planPosition` incremented by 1 and a fresh all-`pending` session.

- [ ] **Step 4: Commit**

```bash
git add app/api/today/route.ts app/api/today/advance/route.ts
git commit -m "feat(today): GET /api/today + POST advance endpoints

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `/today` stepper page

**Files:**
- Create: `app/today/page.tsx`

**Interfaces:**
- Consumes: `GET /api/today` (`TodayResponse`) and `POST /api/today/advance`; `SessionStep` type from `@/lib/session`.
- Produces: route `/today` (home hero in Task 7 links here).

> Read `node_modules/next/dist/docs/` for this build's client-component conventions before writing. The page is a client component (`"use client"`).

- [ ] **Step 1: Implement the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SessionStep } from "@/lib/session";

type TodayResponse = {
  day: number; theme: string; isReview: boolean; steps: SessionStep[]; planPosition: number;
};

export default function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(mode?: "min") {
    const qs = mode ? "?mode=min" : "";
    fetch(`/api/today${qs}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("Impossible de charger la séance."));
  }

  useEffect(() => { load(); }, []);

  if (error) return <Shell><p className="text-sm text-red-500">{error}</p></Shell>;
  if (!data) return <Shell><p className="text-sm text-zinc-400">Chargement…</p></Shell>;

  const current = data.steps.find((s) => s.status === "pending");
  const doneCount = data.steps.filter((s) => s.status === "done").length;
  const allDone = !current;

  return (
    <Shell>
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Aujourd&apos;hui · Jour {data.day}
        </div>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{data.theme}</h1>
        <p className="mt-1 text-xs text-zinc-400">{doneCount}/{data.steps.length} étapes</p>
      </div>

      <ol className="space-y-2">
        {data.steps.map((s, i) => {
          const isCurrent = s === current;
          return (
            <li
              key={i}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                s.status === "done"
                  ? "border-zinc-200 dark:border-zinc-800 opacity-50"
                  : isCurrent
                  ? "border-zinc-900 dark:border-zinc-100 bg-white dark:bg-zinc-900"
                  : "border-zinc-200 dark:border-zinc-700"
              }`}
            >
              <span className="text-sm text-zinc-900 dark:text-zinc-100">
                {s.status === "done" ? "✓ " : ""}{s.label}
              </span>
              {isCurrent && (
                <Link
                  href={`${s.route}?session=1`}
                  className="text-sm font-medium text-zinc-900 dark:text-zinc-100 underline"
                >
                  Commencer →
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {allDone ? (
        <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 px-5 py-4 text-center">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Jour {data.day} terminé 🎉
          </p>
          <Link href="/" className="mt-2 inline-block text-xs text-zinc-500 underline">Retour à l&apos;accueil</Link>
        </div>
      ) : (
        <button
          onClick={() => load("min")}
          className="text-xs text-zinc-400 underline hover:text-zinc-600"
        >
          Je n&apos;ai que 10 min
        </button>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="max-w-sm w-full px-6 space-y-6">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, open `http://localhost:3000/today`.
Expected: header "Aujourd'hui · Jour N", the day's theme, a step list whose first row shows "Commencer →", plus a "Je n'ai que 10 min" link that, when clicked, reduces the pending list to vocab/grammar only. (Full completion round-trip is verified in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add app/today/page.tsx
git commit -m "feat(today): /today stepper page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `useSessionStep` hook + wire the 6 activity pages

**Files:**
- Create: `app/useSessionStep.ts`
- Modify: `app/listen/page.tsx`, `app/read/page.tsx`, `app/speak/page.tsx`, `app/submit/page.tsx`, `app/practice/page.tsx`, `app/flashcards/page.tsx`

**Interfaces:**
- Consumes: `POST /api/today/advance` (Task 4).
- Produces: `useSessionStep()` → `{ inSession: boolean; completeStep: () => Promise<void> }`.

> Read `node_modules/next/dist/docs/` for this build's `useSearchParams`/`useRouter` (or equivalent) before writing the hook. Confirm the import path (`next/navigation` in stock Next — verify here).

- [ ] **Step 1: Implement the hook** — `app/useSessionStep.ts`

```ts
"use client";

import { useSearchParams, useRouter } from "next/navigation";

export function useSessionStep() {
  const params = useSearchParams();
  const router = useRouter();
  const inSession = params.get("session") === "1";

  async function completeStep() {
    try {
      await fetch("/api/today/advance", { method: "POST" });
    } catch (e) {
      console.error("advance failed:", e);
    }
    router.push("/today");
  }

  return { inSession, completeStep };
}
```

- [ ] **Step 2: Wire `app/listen/page.tsx`** (model edit — the other five pages repeat these exact two edits at their own results state)

Add near the other hook imports/usages:
```tsx
import { useSessionStep } from "@/app/useSessionStep";
// inside the component, with the other hooks:
const { inSession, completeStep } = useSessionStep();
```
At the `results` stage render (where the page shows `accuracy`/score), add a session-only button:
```tsx
{inSession && (
  <button
    onClick={completeStep}
    className="w-full rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-3 text-sm font-medium"
  >
    Continuer la séance →
  </button>
)}
```

- [ ] **Step 3: Wire `app/read/page.tsx`** — same two edits as Step 2, at this page's results/score render. Locate it: `grep -n "results\|score\|accuracy\|setStage" app/read/page.tsx`.

- [ ] **Step 4: Wire `app/speak/page.tsx`** — same two edits, at the grading/results render. Locate it: `grep -n "results\|score\|grade\|setStage" app/speak/page.tsx`.

- [ ] **Step 5: Wire `app/submit/page.tsx`** — same two edits, shown after a submission is graded/acknowledged. Locate it: `grep -n "result\|submitted\|setStage\|response" app/submit/page.tsx`.

- [ ] **Step 6: Wire `app/practice/page.tsx`** — same two edits, after the drill response is graded. Locate it: `grep -n "result\|grade\|resolved\|setStage" app/practice/page.tsx`.

- [ ] **Step 7: Wire `app/flashcards/page.tsx`** — flashcards have no single "graded" end; treat "no more due cards" (empty queue) as completion. Render the same button when `inSession` AND the due queue is empty. Locate the finished/empty state: `grep -n "due\|empty\|terminé\|length === 0\|setCards" app/flashcards/page.tsx`.

- [ ] **Step 8: End-to-end manual verification**

Run `npm run dev`. From `/today` click "Commencer →" on the first step, complete the activity, click "Continuer la séance →".
Expected: returns to `/today`; the completed step shows "✓" dimmed; the next step shows "Commencer →". Repeat to the end → "Jour N terminé 🎉". Reload `/today` → a fresh Jour N+1 session (planPosition advanced).
Forgiveness check: do NOT finish a session; reload `/today` → it resumes the same in-progress steps, with NO "behind"/red indicator anywhere on `/today` or `/`.

- [ ] **Step 9: Commit**

```bash
git add app/useSessionStep.ts app/listen/page.tsx app/read/page.tsx app/speak/page.tsx app/submit/page.tsx app/practice/page.tsx app/flashcards/page.tsx
git commit -m "feat(today): session-step hook + wire activity pages to advance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Home page hero — one button instead of seven

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: route `/today` (Task 5). No new exports.

- [ ] **Step 1: Add the hero card above the nav and collapse the menu**

In `app/page.tsx`, immediately after `<HomeworkBanner />`, insert the hero:
```tsx
<Link
  href="/today"
  className="block rounded-xl border-2 border-zinc-900 dark:border-zinc-100 bg-white dark:bg-zinc-900 px-5 py-5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
>
  <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Aujourd&apos;hui</div>
  <div className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">Commencer la séance du jour →</div>
  <div className="mt-0.5 text-xs text-zinc-400">Tout est déjà prêt. Tu n&apos;as rien à choisir.</div>
</Link>
```
Then wrap the existing `<nav>...</nav>` (the 7-item menu) in a `<details>` so it is de-emphasized but still reachable. Do NOT change the nav items themselves — only move them inside `<details>`:
```tsx
<details className="group">
  <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 list-none">
    Luyện tự do (choisir un module) ▾
  </summary>
  <nav className="mt-3 space-y-3">
    {/* unchanged existing 7-item list */}
  </nav>
</details>
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, open `http://localhost:3000/`.
Expected: the dominant element is the "Aujourd'hui" hero linking to `/today`; the old 7-item menu is collapsed under "Luyện tự do" and expands on click; `HomeworkBanner` and `Mode tuteur` link still present.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(today): home hero — one button replaces seven

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- A. Home one-button hero → Task 7. ✓
- B. `/today` stepper, deep-link `?session=1`, advance + return → Tasks 5, 6. ✓
- C. Session assembly from plan + weak tag + due cards, theme→topic → Tasks 1, 2, 4. ✓
- D. Minimum 10-min session, still counts → `trimToMin` (Task 1) + `?mode=min` (Task 4) + "10 min" link (Task 5); completing a min session still advances planPosition (Task 4 advance). ✓
- E. Queue-not-calendar, resume, no "behind" → planPosition increments only on completion (Task 4), activeSession resume (Task 4 GET, Task 5, Task 6 Step 8 forgiveness check). ✓
- F. `SessionProgress` model → Task 3. ✓
- G. `GET /api/today` + `POST advance` → Task 4. ✓
- H. `lib/plan.ts` PLAN + getPlanDay → Task 2. ✓
- Out-of-scope items: none introduced. ✓
- Open questions (TCF/DELF; topic threading): theme threaded as `topic` where supported (`/listen` confirmed to accept a topic); no re-theme done. Matches spec. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Each activity-page edit repeats the concrete two-edit pattern with a `grep` locator for its results state. The only deliberate deferral (Phase-2 inline rendering) is explicitly out of scope.

**Type consistency:** `SessionStep`, `SessionMode`, `buildSession`, `advanceSession`, `trimToMin` used identically across Tasks 1/4/5/6. `PlanDay`/`getPlanDay`/`PLAN` consistent across Tasks 1/2/4. `TodayResponse`/`AdvanceResponse` shapes match between Task 4 (produced) and Task 5 (consumed). Route map (`/flashcards`,`/practice`,`/listen`,`/read`,`/speak`,`/submit`) matches the existing pages wired in Task 6.

**Known risks flagged for execution:** (1) Prisma `Json?` null-clear needs `Prisma.DbNull` (Task 4 Step 2 + note). (2) This repo's Next.js differs from stock — every page/route/hook task says read `node_modules/next/dist/docs/` first. (3) Activity pages' exact results-state location varies — `grep` locators provided per page.
