# Spaced Repetition for Drills — Design Spec

**Date:** 2026-09-10
**Status:** Approved (core decisions confirmed with user), ready for `writing-plans`

## Context

Linguistic Twin — v1 (M0–M6) is complete and shipped. This is v2 candidate #2, following "Drill history" (`f1fa813`). Ranked ahead of Export/study report, Adaptive difficulty, and Multi-user per `PROJECT_STATUS.md`'s priority order.

The app already tracks two independent review loops:
- **Flashcards** (`Flashcard` model, `prisma/schema.prisma:135`) — full SM-2 schedule (`dueAt`, `interval`, `easeFactor`) keyed 1:1 to `ErrorEvent`. Live via `app/api/flashcards/route.ts`.
- **Drills** (`Drill` model, `prisma/schema.prisma:117`) — generated grammar exercises targeting an `errorTag`. No scheduling fields at all today.

## Problem

`getNextTarget` (`lib/targeting.ts:9`) is time-blind in two ways:

1. **No spacing.** It's a pure frequency sort — the same highest-frequency unresolved tag is re-served every single day until `updateMasterySignal` (`lib/targeting.ts:34`) sees 3 consecutive `improving` signals and flips every drill for that tag to `resolved: true`.
2. **No retention check.** Once a tag is `resolved`, `getNextTarget` excludes it permanently (`lib/targeting.ts:24`). There is no mechanism to re-surface it later and confirm the user still remembers it.

Both are exactly what spaced repetition fixes. The existing `Flashcard`/SM-2 system doesn't directly apply: it schedules individual `ErrorEvent`s, while drill mastery (`updateMasterySignal`) already operates at the **tag** level — a drill's generated sentences aren't durable content worth re-serving verbatim, but the underlying grammar rule is.

## Decisions (confirmed with user)

| Question | Decision |
|---|---|
| Architecture | New tag-level `TagSchedule` model drives `getNextTarget` directly (not SM-2 fields on `Drill`, not a polymorphic model unifying `Flashcard`+`Drill`) |
| Interval scheme | Fixed ladder indexed by consecutive-`improving` streak, not an SM-2 ease factor |
| `resolved` field | Scheduling replaces it as the **selection** filter; `resolved` stays as a **display-only** badge on `/drill` history — its current write path is untouched |
| Daily session (`buildSession`) | Add `hasDueTags`, mirroring the existing `hasDueCards` pattern — a grammar step appears whenever a tag is due, even on plan days that don't otherwise schedule grammar |

**No-CEFR guard:** all of this is scheduling metadata (a due date and an interval index). Nothing here computes or surfaces a mastery score, percentage, or level — UI only ever shows "à réviser" / next-due-date framing, matching the PRD's explicit no-verdict principle.

## Solution

### A. New model: `TagSchedule`

```prisma
// SRS schedule for one (userId, errorTag) pair. Created lazily by
// updateMasterySignal on first grade for that tag — mirrors Flashcard's
// "created lazily on first visit" pattern. Absence of a row means the tag
// has never been scheduled and is always eligible for selection.
model TagSchedule {
  id                 String    @id @default(cuid())
  userId             String
  errorTag           String
  dueAt              DateTime  @default(now())
  intervalIndex      Int       @default(0)   // index into the fixed ladder
  consecutiveImproving Int     @default(0)
  lastDrilledAt      DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, errorTag])
}
```

### B. Ladder + transition rule (`lib/targeting.ts`)

```ts
const LADDER_DAYS = [1, 3, 7, 14, 30]; // index 0..4, indexed by consecutiveImproving
```

Inside `updateMasterySignal`, alongside the existing (unchanged) "3-in-a-row → mark `resolved`" block, upsert `TagSchedule`:

- `signal === "improving"` → `consecutiveImproving += 1` (cap at `LADDER_DAYS.length - 1`), `dueAt = now + LADDER_DAYS[consecutiveImproving] days`
- `signal === "still_struggling"` → `consecutiveImproving = 0`, `dueAt = now + LADDER_DAYS[0] days` (back to daily)
- `signal === "mixed"` → `consecutiveImproving` unchanged, `dueAt = now + LADDER_DAYS[consecutiveImproving] days` (retry same interval, don't punish or reward)
- always: `lastDrilledAt = now`

This generalizes the existing streak-counting logic already in `updateMasterySignal` — it doesn't replace it, it runs alongside the current `resolved`-badge write.

### C. `getNextTarget` selection change (`lib/targeting.ts:9`)

Replace the `resolvedTags` exclusion query with a `TagSchedule` lookup:

```ts
const schedules = await db.tagSchedule.findMany({ where: { userId } });
const dueMap = new Map(schedules.map((s) => [s.errorTag, s.dueAt]));

const candidate = Object.entries(freq)
  .filter(([tag]) => {
    if (!canRouteToDrill(tag) || tag === "uncategorized") return false;
    const dueAt = dueMap.get(tag);
    return !dueAt || dueAt <= new Date(); // no row = never scheduled = due
  })
  .sort(([, a], [, b]) => b - a)[0];
```

A tag with no `TagSchedule` row (never drilled) is always eligible — same "always due until first graded" behavior as `resolved` had, just keyed on absence of a row instead of a boolean.

### D. `buildSession` integration (`lib/session.ts:28`, `app/api/today/route.ts:27`)

`getNextTarget` now only returns a tag that's actually due, so `hasDueTags` is free — no extra query:

```ts
// app/api/today/route.ts
const weakTag = await getNextTarget(userId);
const hasDueTags = weakTag !== null;
const dueCount = await db.flashcard.count({ where: { userId, dueAt: { lte: new Date() } } });
steps = buildSession({ planDay, weakTag, hasDueCards: dueCount > 0, hasDueTags, mode });
```

```ts
// lib/session.ts — mirrors the existing hasDueCards → vocab line
if (hasDueCards) active.add("vocab");
if (hasDueTags) active.add("grammar");
```

### E. "Nothing due" — no new fallback needed

Already handled: `app/practice/page.tsx:16` checks `if (!errorTag) { setStatus("no_target"); return; }` — `getNextTarget` already returns `null` today (no profile, empty frequencies) and the practice page already has an empty state for it. A day with no due tags just hits this existing path more often; no new UI required.

## Migration

New `TagSchedule` model + `@@unique([userId, errorTag])` index. Existing `Drill.resolved` data is untouched — first read of any tag after this ships treats it as "never scheduled" (immediately eligible), which is correct: there's no historical due-date data to backfill.

## New vs. Reused

| Component | Status |
|---|---|
| `Flashcard`/SM-2, `Drill`, `updateMasterySignal`'s `resolved` write, `/drill` history page | Reused as-is |
| `TagSchedule` model + migration | New |
| `lib/targeting.ts`: `getNextTarget` filter, `updateMasterySignal` schedule upsert | Modified |
| `lib/session.ts`: `buildSession` — `hasDueTags` param | Modified, ~2 lines |
| `app/api/today/route.ts`: derive `hasDueTags` from `weakTag` | Modified, ~1 line |

## Out of Scope

- Any mastery score, percentage, or level surfaced in UI (no-CEFR guard).
- SM-2 ease-factor math for drills (fixed ladder chosen instead).
- Unifying `Flashcard` and `Drill` scheduling under one model.
- Changing `/drill` history page behavior — `resolved` badge display is untouched.
- Backfilling `TagSchedule` rows for tags already resolved before this ships.

## Success Criteria

1. A tag is never re-served two days in a row after an `improving` signal — `dueAt` reflects the ladder step.
2. A tag that reached `resolved` under the old logic is, going forward, still selectable again once its `TagSchedule.dueAt` comes due (retention re-check now exists — this is the core fix).
3. `/today`'s daily session surfaces a grammar step whenever a tag is due, even on plan days where grammar wasn't otherwise scheduled.
4. No UI anywhere shows a mastery score, streak count, or level — only due/not-due framing.
