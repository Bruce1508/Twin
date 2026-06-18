# Project Status — Linguistic Twin

> Working-context snapshot for the next session. Last updated: 2026-06-17.
> NOT user documentation (see `README.md` for setup). This tracks **what's done, what's verified, and what's queued.**

---

## ⚡ START HERE (next session, read this first)

1. **The whole v1 + Reading Comprehension feature is DONE and verified end-to-end.** Nothing is half-finished.
2. **To run it:**
   ```bash
   cd /Users/brucevo/Desktop/twin && docker compose up -d   # start Postgres
   cd frontend && npm run dev                                # start app → http://localhost:3000
   ```
3. **If something seems broken, check these first:** `frontend/.env` must have `DATABASE_URL`, `GEMINI_API_KEY`, `DEV_USER_ID` all set. If `DEV_USER_ID` is empty, recover it:
   ```bash
   docker compose exec db psql -U twin twin_dev -c 'SELECT id, email FROM "User";'
   ```
4. **Two open decisions waiting on the user** (neither blocks anything):
   - Push to GitHub? (still not pushed — command below in Git section)
   - Which feature to build next? (options at the bottom)
5. **Heads-up on the environment:** there's a `GateGuard` hook that forces you to state "facts" before every Bash/Edit/Write, and an ECC cost-notice hook that prints scary "$XXX" numbers. **The user is on Claude Pro ($20/mo flat)** — those dollar figures are notional API-equivalents, NOT real charges. Don't panic-stop on them; the user already knows.

---

## What this project is

**Linguistic Twin** — a French learner-modeling system for self-studying toward **TCF Canada (B2 / NCLC 7)**, built by Bruce (CS student in Canada, targeting permanent residency).

It is **not** a French-teaching app. It is a *data layer that models one learner's language ability over time*, plus a generation layer that produces practice targeted at that learner's individual weaknesses. Also a **portfolio piece** demonstrating a stateful user-modeling system (event sourcing + derived profile), not an API wrapper.

**The core loop (writing):**
```
Write French → Extract tagged errors → Immutable event store
     ↑                                         ↓
Your correction ←← Reverse Tutor drill ←← Profile inference (derived)
```

**The second loop (reading — NEW, now built):**
```
Read B2 article → Answer 5 TCF-style questions → Gemini grades with comprehension tags
     → same ErrorEvent table → same Profile → dashboard shows reading weaknesses
```

---

## Tech stack (as actually built)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 (via Docker Compose, port bound to 127.0.0.1 only) |
| ORM | Prisma 7 — **uses driver adapter** `@prisma/adapter-pg` (NOT a datasource URL string — this is a Prisma 7 breaking change) |
| LLM | **Google Gemini** `gemini-2.5-flash` via `@google/genai` SDK (free tier, switched from OpenAI/Anthropic to avoid cost) |
| Structured output | Gemini `responseMimeType: "application/json"` + `responseJsonSchema` |

**Key env vars** (`frontend/.env`): `DATABASE_URL`, `GEMINI_API_KEY`, `DEV_USER_ID`.

**Two Prisma 7 gotchas already solved (don't re-hit them):**
1. Client constructor needs `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` — not `datasourceUrl`.
2. Writing typed objects to `Json` columns fails tsc (no index signature) → cast with `as any` at the write site (matches existing codebase convention).

---

## Milestone status — ALL DONE ✅

| Milestone | Status | Notes |
|---|---|---|
| M0 — Scaffold + taxonomy | ✅ Verified | now **45** error tags (was 39) |
| M1 — Schema + DB | ✅ Verified | 6 entities (added ReadingExercise) |
| M2 — Ingestion + extraction | ✅ Verified in browser | 10 errors extracted + persisted |
| M3 — Profile inference + dashboard | ✅ Verified | dashboard counts match DB exactly |
| M4 — Reverse Tutor generator | ✅ Verified | `/practice` generated real drill |
| M5 — Targeting rule + full loop | ✅ Verified | highest-freq unresolved tag selected |
| M6 — Hardening + README | ✅ Done | README + this file |
| **Reading Comprehension feature** | ✅ **Verified end-to-end** | 7/7 plan tasks done; see below |

---

## Reading Comprehension feature — COMPLETE (built 2026-06-17)

The 2nd of 4 TCF skills (**compréhension écrite**). Plan was at `frontend/docs/superpowers/plans/2026-06-16-reading-comprehension.md`; all 7 tasks implemented and verified.

**What works:** learner pastes OR generates a B2 article → Gemini makes 5 TCF-style questions (repérage, reformulation, inférence, intention_auteur, attitude_opinion) → learner answers in French → Gemini grades each with a comprehension error tag → errors flow into the SAME `ErrorEvent` table + `Profile` → dashboard shows reading errors in a separate indigo section.

**Verified (real run, not just compile):**
- `tsc --noEmit` clean
- `/api/health` returns `total: 45` tags
- Generated 310-word article + 5 correctly-typed questions
- **answer keys NOT leaked to client** (stripped server-side before response)
- Grading assigns valid comprehension tags
- DB confirmed: comprehension `ErrorEvent` rows + `ReadingExercise` rows + `reading_exercise` `Submission` (loop closed)

**Key design win:** `recomputeProfile` was NOT modified — it just counts ErrorEvents by tag, agnostic to whether the tag came from writing or reading. Adding a whole TCF skill needed only: 6 new tags + 1 table + new routes/UI. The `readingOnly` flag keeps comprehension tags out of the writing-only Reverse Tutor (`canRouteToDrill` excludes them).

---

## Full file map (what exists today)

### Library / logic (`frontend/lib/`)
- `taxonomy.ts` — **45** tags across **6** categories (grammaire, lexique, orthographe, syntaxe, registre, **comprehension**). Flags: `wholeTextOnly`, `readingOnly`. Exports `SPAN_TAGS`, `WHOLE_TEXT_TAGS`, `READING_TAGS`. Single source of truth, injected into all prompts.
- `db.ts` — Prisma singleton using `PrismaPg` driver adapter.
- `extractor.ts` — Layer 1 (writing): Gemini extracts tagged errors + metrics.
- `profile.ts` — Layer 2: pure recompute of profile from immutable events. `topSpanTags(freq, n)` helper.
- `generator.ts` — Layer 3 (writing): Reverse Tutor drill gen + grading + verification pass. `canRouteToDrill` excludes whole-text + reading tags.
- `targeting.ts` — deterministic rule: highest-frequency unresolved span tag.
- `reading.ts` — **NEW**: Gemini article gen, question gen, answer grading (3 funcs).

### API routes (`frontend/app/api/`)
- `health/route.ts` — health check + taxonomy counts
- `submissions/route.ts` — POST: extract + persist + recompute profile (writing)
- `profile/recompute/route.ts` — POST: trigger recompute
- `drills/generate/route.ts` — POST: generate a drill
- `drills/[drillId]/grade/route.ts` — POST: grade + close writing loop
- `practice/next-target/route.ts` — GET: targeting rule endpoint
- `reading/generate/route.ts` — **NEW** POST: create exercise, return questions (no answer key)
- `reading/[exerciseId]/grade/route.ts` — **NEW** POST: grade, persist comprehension errors, recompute

### Pages (`frontend/app/`)
- `page.tsx` — nav hub (links: Écrire, Lire, Pratiquer, Profil)
- `submit/page.tsx` — write French → tagged errors + metrics
- `read/page.tsx` — **NEW**: reading exercise (3 stages: setup → answering → results)
- `dashboard/page.tsx` — profile: writing errors (coloured) + comprehension errors (indigo) + complexity trend
- `practice/page.tsx` — generates drill, redirects to `/drill/[id]`
- `drill/[drillId]/page.tsx` — Reverse Tutor UI

### DB models (`frontend/prisma/schema.prisma`)
`User`, `Submission`, `ErrorEvent`, `Profile`, `Drill`, **`ReadingExercise`** (new). `ErrorCategory` enum has 6 values incl. `comprehension`.

### Infra / docs (project root)
- `docker-compose.yml` — Postgres 16, port `127.0.0.1:5432`
- `README.md` — user setup instructions
- `PROJECT_STATUS.md` — this file
- `.claude/` — four design docs (PRD, taxonomy, prompt specs, implementation plan)
- `frontend/docs/superpowers/plans/` — the reading-comprehension plan (now executed)

---

## Git state

**Two separate repos** (NOT yet pushed to GitHub):
- `frontend/` repo — all app code, many commits. Latest: reading comprehension (Tasks 1-7), Prisma 7 JSON typing fixes.
- root repo — `README.md`, `docker-compose.yml`, `.gitignore`, `PROJECT_STATUS.md`, design docs.

Recent frontend commits: `comprehension taxonomy + 6 tags` → `ReadingExercise model` → `reading comprehension loop (Tasks 3-7)`.

**To push to GitHub when ready** (user keeps saying "later"):
```bash
# root repo
gh repo create linguistic-twin --private --source=/Users/brucevo/Desktop/twin --remote=origin --push
# frontend repo is separate — decide whether to merge into root or push separately
```
> Note: `frontend/` and root are independent git repos. If you want ONE repo on GitHub, you'll need to consolidate them first (e.g. remove `frontend/.git` and track everything from root). Discuss with user before doing this — it rewrites history.

---

## How to start the app (quick reference)

```bash
cd /Users/brucevo/Desktop/twin && docker compose up -d   # 1. DB
cd frontend && npm run dev                                # 2. app
# 3. open http://localhost:3000
```

Useful DB checks:
```bash
# error counts by tag
docker compose exec db psql -U twin twin_dev -c 'SELECT "errorTag", COUNT(*) FROM "ErrorEvent" GROUP BY "errorTag" ORDER BY count DESC;'
# comprehension errors only
docker compose exec db psql -U twin twin_dev -c "SELECT COUNT(*) FROM \"ErrorEvent\" WHERE category='comprehension';"
```

---

## Hard out-of-scope (v1 — deliberate, documented in PRD)

- Orchestration agent (PRD §7) — needs working core first
- Voice / speech / STT
- Vector database
- Separate Python microservice
- Multi-user auth (schema supports it via `userId`, but no auth layer built)

---

## Candidate next features (user picks — none started)

Ranked by leverage for the TCF goal:

1. **Vocabulary spaced repetition** — build SRS on existing `ErrorEvent` data (surface past errors as timed flashcards). Zero new LLM cost for reviews. High retention value.
2. **Speaking practice** (expression orale, 3rd TCF skill) — Gemini 2.5 Flash has native audio input; record monologue → transcript + error extraction. Mirrors the writing extractor.
3. **Listening comprehension** (4th TCF skill) — would complete all 4 skills.
4. **B2 rubric writing score** — structured breakdown (range, complexity, register), NOT a CEFR verdict (PRD forbids verdicts).
5. **Multi-user** — auth (Clerk/NextAuth) + BYOK or Stripe billing. Only worth it after the user has used it solo for weeks.

**Recommendation for next session:** speaking practice (3rd skill, same extractor pattern) OR vocabulary SRS (cheapest, high retention). Reading just proved the architecture extends cleanly to new skills.
