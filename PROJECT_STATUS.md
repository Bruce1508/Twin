# Project Status — Linguistic Twin

> Working-context snapshot for the next session. Last updated: 2026-07-03.
> NOT user documentation (see `README.md` for setup). This tracks **what's done, what's verified, and what's queued.**

---

## ⚡ START HERE (next session, read this first)

1. **All 4 TCF Canada skills are DONE and verified end-to-end.** Writing, Reading, Speaking, and Listening are all complete. Vocabulary SRS (Flashcards) is also done. Nothing is half-finished.
2. **Two workflow features shipped on top — merged via PR #1 (2026-07-03):**
   - **Aujourd'hui (daily session).** The home page now leads with ONE button — "Commencer la séance du jour" → `/today` — that runs a pre-assembled sequential session, so there's no 7-way choice each night. The old 7-link menu is collapsed under "Luyện tự do". Progress is a *queue, not a calendar*: skipped days never show "behind".
   - **Tutor mode.** Passcode-protected `/tutor` dashboard for Bruce's teacher (weekly report + submission history + session notes/homework). Assigned homework shows on the student home via an amber banner.
3. **To run it:**
   ```bash
   cd /Users/brucevo/Desktop/twin && docker compose up -d   # start Postgres
   cd frontend && npm run dev                                # start app → http://localhost:3000
   ```
4. **If something seems broken, check these first:** `frontend/.env` must have `DATABASE_URL`, `GEMINI_API_KEY`, `DEV_USER_ID` all set (tutor mode also needs `TUTOR_PASSCODE`). If `DEV_USER_ID` is empty, recover it:
   ```bash
   docker compose exec db psql -U twin twin_dev -c 'SELECT id, email FROM "User";'
   ```
5. **GitHub:** Single repo at `github.com/Bruce1508/Twin`. Latest merge: **PR #1** (`feature/today-session` → `main`, 2026-07-03) — Aujourd'hui + Tutor mode + housekeeping.
6. **Heads-up on the environment:** there's a `GateGuard` hook that forces you to state "facts" before every Bash/Edit/Write, and an ECC cost-notice hook that prints scary "$XXX" numbers. **The user is on Claude Pro ($20/mo flat)** — those dollar figures are notional API-equivalents, NOT real charges. Don't panic-stop on them; the user already knows.

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

**All four TCF Canada skills now covered:**
```
Expression écrite ✅     → /submit + /practice + /drill
Compréhension écrite ✅  → /read
Expression orale ✅      → /speak
Compréhension orale ✅   → /listen
```

---

## Tech stack (as actually built)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 (via Docker Compose, port bound to 127.0.0.1 only) |
| ORM | Prisma 7 — **uses driver adapter** `@prisma/adapter-pg` (NOT a datasource URL string — this is a Prisma 7 breaking change) |
| LLM | **Google Gemini** `gemini-2.5-flash` via `@google/genai` SDK (free tier) |
| TTS | `gemini-2.5-flash-preview-tts` → raw PCM → WAV header → served as audio |
| Audio input | Browser `MediaRecorder` → blob → Gemini multimodal audio input (transcription) |
| Structured output | Gemini `responseMimeType: "application/json"` + `responseJsonSchema` |
| SRS algorithm | SM-2 (flashcard scheduling) |

**Key env vars** (`frontend/.env`): `DATABASE_URL`, `GEMINI_API_KEY`, `DEV_USER_ID`.

**Two Prisma 7 gotchas already solved (don't re-hit them):**
1. Client constructor needs `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` — not `datasourceUrl`.
2. Writing typed objects to `Json` columns fails tsc (no index signature) → cast with `as any` at the write site (matches existing codebase convention).

---

## Milestone status — ALL DONE ✅

| Milestone | Status | Notes |
|---|---|---|
| M0 — Scaffold + taxonomy | ✅ Verified | **57** error tags across 6 categories |
| M1 — Schema + DB | ✅ Verified | **11** models (see below) |
| M2 — Ingestion + extraction | ✅ Verified in browser | 10 errors extracted + persisted |
| M3 — Profile inference + dashboard | ✅ Verified | dashboard counts match DB exactly |
| M4 — Reverse Tutor generator | ✅ Verified | `/practice` generates real drills |
| M5 — Targeting rule + full loop | ✅ Verified | highest-freq unresolved span tag selected |
| M6 — Hardening + README | ✅ Done | README + this file |
| Reading Comprehension | ✅ Verified end-to-end | 5 TCF-style open questions, comprehension tags |
| Speaking Practice | ✅ Verified end-to-end | MediaRecorder → Gemini transcribe → grade → ErrorEvents |
| Vocabulary SRS Flashcards | ✅ Verified end-to-end | SM-2, 4-button rating, lazy sync from ErrorEvents |
| Listening Comprehension | ✅ Verified end-to-end | Gemini TTS → WAV, 5 MCQ questions, pure TS grading |
| GitHub consolidation | ✅ Done | Single repo at github.com/Bruce1508/Twin |
| Tutor mode (passcode) | ✅ Merged (PR #1) | `/tutor` dashboard: report + history + notes/homework; student home banner |
| Aujourd'hui daily session | ✅ Merged (PR #1) | One-button home hero → `/today` stepper; queue-not-calendar progress; "10 min" dose |

---

## TCF Canada coverage — 4/4 skills complete ✅

| Skill | Route | Feature |
|---|---|---|
| Expression écrite | `/submit` + `/practice` + `/drill/[id]` | Write → extract errors → Reverse Tutor |
| Compréhension écrite | `/read` | B2 article → 5 open-text questions → grading |
| Expression orale | `/speak` | Record → Gemini transcribe → grade 5 criteria /20 |
| Compréhension orale | `/listen` | Gemini TTS audio → 5 MCQ questions → pure TS grade |

---

## Taxonomy — 57 tags total

| Category | Count | Notes |
|---|---|---|
| grammaire | 16 | Standard grammar errors, incl. the `uncategorized` fallback tag |
| syntaxe | 10 | 7 original + 3 added |
| lexique | 9 | 7 original + 2 added |
| orthographe | 6 | Spelling/accents |
| registre | 4 | Register/style |
| comprehension | 12 | 6 reading + 5 listening + 1 general |

**Flags:** `wholeTextOnly`, `readingOnly`, `speakingOnly`, `listeningOnly`

- `readingOnly` tags excluded from Reverse Tutor (`canRouteToDrill`)
- `speakingOnly` tags: 7 tags covering fluency, pronunciation proxy, discourse markers, etc.
- `listeningOnly` tags: 5 tags covering aural comprehension subtypes

---

## DB models — 11 total

`User`, `Submission`, `ErrorEvent`, `Profile`, `Drill`, `ReadingExercise`, `SpeakingExercise`, `ListeningExercise`, `Flashcard`, `TutorNote`, `SessionProgress`

`ErrorCategory` enum: `grammaire`, `lexique`, `orthographe`, `syntaxe`, `registre`, `comprehension`

- `TutorNote` — one row per saved tutor note; holds `notes` + `homework` (latest row wins).
- `SessionProgress` — one row per user for the Aujourd'hui queue: `planPosition` (advances only on completion), `activeSession` (JSON steps for resume), `startedAt`, `lastCompletedAt`.

---

## Navigation — home hub

**Home (`/`) now leads with the Aujourd'hui hero button** (→ `/today`); the 7 module links below are collapsed under "Luyện tự do". A `HomeworkBanner` (amber) appears when the tutor has assigned homework, and a "Mode tuteur" link points to `/tutor`.

| Label | Route | Feature |
|---|---|---|
| Écrire | `/submit` | Write French text |
| Lire | `/read` | Reading comprehension |
| Parler | `/speak` | Speaking practice |
| Écouter | `/listen` | Listening comprehension |
| Réviser | `/flashcards` | Vocabulary SRS |
| Pratiquer | `/practice` | Reverse Tutor drill |
| Profil | `/dashboard` | Learner profile |

---

## Dashboard sections

- **Writing** — error tag frequencies with category colour-coding
- **Reading** — comprehension tag errors (indigo)
- **Speaking** — speaking error breakdown (teal)
- **Listening** — listening error breakdown (amber)

---

## Aujourd'hui — zero-decision daily session

Replaces the "pick 1 of 7 every night" decision cost with a single button. Assembled from three sources: the encoded **56-day DELF plan** (`lib/plan.ts`, generated from `French_A0_to_A2_56_day_plan.xlsx`), the learner's **weakest tag** (`getNextTarget`), and **due SRS flashcards**.

- Pure orchestration in `lib/session.ts` (`buildSession` / `advanceSession` / `trimToMin`), covered by Vitest (13/13).
- `GET /api/today` builds or resumes a session; `POST /api/today/advance` marks the current step done and advances `planPosition` only on completion.
- `/today` is a stepper that deep-links into existing activity pages in `?session=1` mode; each page shows a "Continuer la séance →" button (`SessionStepButton` + `useSessionStep`) that advances and returns to `/today`.
- **Forgiveness model:** progress is a queue, not a calendar — skipped days never show "behind". A "Je n'ai que 10 min" link trims to vocab+grammar and still counts as done.
- Design + plan: `frontend/docs/superpowers/specs/2026-06-26-today-session-design.md`, `.../plans/2026-06-26-today-session.md`.

## Tutor mode — passcode dashboard for the teacher

Bruce's tutor teaches in person on a separate MacBook; `/tutor` gives them a read-only-ish view plus notes/homework.

- Auth: `TUTOR_PASSCODE` env → `POST /api/tutor/auth` returns an HMAC token (`lib/tutor-auth.ts`); client stores it in `localStorage`.
- Tabs: **Report** (`/api/tutor/report` — weekly stats), **History** (`/api/tutor/history` — submissions), **Notes & Homework** (`/api/tutor/notes` — auth-gated GET/POST).
- Student side: `/api/tutor/homework` is **public** (no auth) so the home `HomeworkBanner` can show the latest assigned homework.
- Design: `frontend/docs/superpowers/specs/2026-06-23-tutor-support-design.md`.

---

## Full file map (what exists today)

### Library / logic (`frontend/lib/`)
- `taxonomy.ts` — **57** tags across **6** categories. Flags: `wholeTextOnly`, `readingOnly`, `speakingOnly`, `listeningOnly`. Exports `SPAN_TAGS`, `WHOLE_TEXT_TAGS`, `READING_TAGS`, `SPEAKING_TAGS`, `LISTENING_TAGS`. Single source of truth injected into all prompts.
- `db.ts` — Prisma singleton using `PrismaPg` driver adapter.
- `extractor.ts` — Layer 1 (writing): Gemini extracts tagged errors + metrics.
- `profile.ts` — Layer 2: pure recompute of profile from immutable events. `topSpanTags(freq, n)` helper.
- `generator.ts` — Layer 3 (writing): Reverse Tutor drill gen + grading + verification pass. `canRouteToDrill` excludes whole-text, reading, speaking, and listening tags.
- `targeting.ts` — deterministic rule: highest-frequency unresolved span tag.
- `report.ts` — weekly study report aggregation (pure): rolling 7-day vs prior-7-day deltas, per-skill metric averages, focus tags, TagSchedule mastery grouping. No DB, no LLM.
- `reading.ts` — Gemini article gen, question gen, answer grading (3 funcs).
- `speaking.ts` — `generateSpeakingPrompt`, `transcribeSpeech` (Gemini multimodal audio), `gradeSpeech` (5 criteria /20).
- `listening.ts` — `generatePassage`, `generateQuestions`, `generateAudio` (TTS → raw PCM → WAV header), `gradeAnswers` (pure TypeScript, no extra LLM call).
- `session.ts` — Aujourd'hui orchestration (pure): `buildSession`, `advanceSession`, `trimToMin`. No LLM, no DB.
- `plan.ts` — 56-day DELF plan (`PLAN`, `getPlanDay`), generated by `scripts/extract-plan.mjs` from the source `.xlsx`.
- `tutor-auth.ts` — HMAC token mint/verify + bearer extraction for tutor mode.

### API routes (`frontend/app/api/`)
- `health/route.ts` — health check + taxonomy counts
- `submissions/route.ts` — POST: extract + persist + recompute profile (writing)
- `profile/recompute/route.ts` — POST: trigger recompute
- `drills/generate/route.ts` — POST: generate a drill
- `drills/[drillId]/grade/route.ts` — POST: grade + close writing loop
- `practice/next-target/route.ts` — GET: targeting rule endpoint
- `reading/generate/route.ts` — POST: create exercise, return questions (no answer key)
- `reading/[exerciseId]/grade/route.ts` — POST: grade, persist comprehension errors, recompute
- `speaking/generate/route.ts` — POST: create SpeakingExercise, return prompt
- `speaking/[id]/transcribe/route.ts` — POST: receive audio blob, Gemini multimodal transcription
- `speaking/[id]/grade/route.ts` — POST: grade transcript 5 criteria /20, persist ErrorEvents, recompute
- `listening/generate/route.ts` — POST: create ListeningExercise, generate passage + TTS + MCQ questions
- `listening/[id]/audio/route.ts` — GET: serve WAV audio file
- `listening/[id]/grade/route.ts` — POST: pure TS grade MCQ answers, persist ErrorEvents, recompute
- `flashcards/route.ts` — GET: lazy sync from all ErrorEvents (first visit), SM-2 scheduling; POST: update card with SM-2 after rating
- `today/route.ts` — GET: build/resume the daily session (`?mode=min` trims to 10-min dose)
- `today/advance/route.ts` — POST: mark current step done; advance `planPosition` only on completion
- `tutor/auth/route.ts` — POST: verify `TUTOR_PASSCODE`, return HMAC token
- `tutor/report/route.ts` — GET: weekly aggregate stats (auth-gated)
- `tutor/history/route.ts` — GET: submissions list (auth-gated)
- `tutor/notes/route.ts` — GET/POST: session notes + homework (auth-gated)
- `tutor/homework/route.ts` — GET: latest homework (**public** — used by the student home banner)

### Pages (`frontend/app/`)
- `page.tsx` — nav hub (7 links)
- `submit/page.tsx` — write French → tagged errors + metrics
- `read/page.tsx` — reading exercise (3 stages: setup → answering → results)
- `speak/page.tsx` — speaking exercise (2-step: record + review transcript → grade results)
- `listen/page.tsx` — listening exercise (audio player → 5 MCQ → grade results)
- `flashcards/page.tsx` — SRS flashcard review (4-button rating: Encore / Difficile / Bien / Facile)
- `dashboard/page.tsx` — profile: writing (coloured) + reading (indigo) + speaking (teal) + listening (amber) sections + complexity trend
- `practice/page.tsx` — generates drill, redirects to `/drill/[id]`
- `drill/[drillId]/page.tsx` — Reverse Tutor UI
- `today/page.tsx` — Aujourd'hui stepper (build/resume session, advance step by step, "10 min" dose)
- `tutor/page.tsx` — passcode gate + 3-tab tutor dashboard (report / history / notes+homework)
- `HomeworkBanner.tsx` — amber banner on home; fetches public `/api/tutor/homework`
- `SessionStepButton.tsx` + `useSessionStep.ts` — "Continuer la séance →" button (wrapped in `<Suspense>`) that advances the session and returns to `/today`

### DB models (`frontend/prisma/schema.prisma`)
11 models: `User`, `Submission`, `ErrorEvent`, `Profile`, `Drill`, `ReadingExercise`, `SpeakingExercise`, `ListeningExercise`, `Flashcard`, `TutorNote`, `SessionProgress`.
`ErrorCategory` enum has 6 values: `grammaire`, `lexique`, `orthographe`, `syntaxe`, `registre`, `comprehension`.

### Infra / docs (project root)
- `docker-compose.yml` — Postgres 16, port `127.0.0.1:5432`
- `README.md` — user setup instructions
- `PROJECT_STATUS.md` — this file
- `.claude/` — design docs (PRD, taxonomy, prompt specs, implementation plan)

---

## Git state

**Single repo** at `github.com/Bruce1508/Twin` — `frontend/` merged into root, no more nested git repos. The previous two-repo situation has been resolved.

**Latest:** on `main`, synced with `origin/main`. **PR #1** (`feature/today-session` → `main`) merged 2026-07-03 (merge commit `ea1d62f`) — shipped Aujourd'hui + Tutor mode + the `.superpowers/` gitignore + tutor spec/plan spreadsheet. Feature branch deleted (local + remote).

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
# errors by category
docker compose exec db psql -U twin twin_dev -c 'SELECT category, COUNT(*) FROM "ErrorEvent" GROUP BY category ORDER BY count DESC;'
# flashcard count
docker compose exec db psql -U twin twin_dev -c 'SELECT COUNT(*) FROM "Flashcard";'
```

---

## Hard out-of-scope (v1 — deliberate, documented in PRD)

- Orchestration agent (PRD §7) — needs working core first
- Vector database
- Separate Python microservice
- Multi-user auth (schema supports it via `userId`, but no auth layer built)

---

## Candidate next features (user picks)

Ranked by leverage for the TCF goal (all 4 TCF skills already built):

1. ~~**B2 rubric writing score**~~ — ✅ **Shipped.** `scoreRubric` in `lib/extractor.ts`, called from `POST /api/submissions`, rendered on `/submit`. Structured breakdown (coherence, vocabulaire, grammaire, registre), NOT a CEFR verdict (PRD forbids verdicts); not persisted to DB.
2. ~~**Drill history / review past drills**~~ — ✅ **Shipped.** `/drill` index page showing past drills and whether they were resolved.
3. ~~**Spaced repetition for drills**~~ — ✅ **Shipped.** `TagSchedule` model; `getNextTarget` selects by due date, `updateMasterySignal` advances the schedule on every grade.
4. **Adaptive difficulty** — track B1/B2 level per tag from reading/listening exercises, adjust generation difficulty based on profile. ⏸️ **Deferred (2026-09-12).** Cold-start: only days of real usage so far, not enough per-tag submissions to calibrate difficulty adjustments safely. Revisit once there are weeks of regular use across each skill tag. Also needs care to avoid surfacing anything that reads as a CEFR-level verdict (PRD forbids verdicts).
5. **Multi-user** — auth (Clerk/NextAuth) + BYOK or Stripe billing. Only worth it after the user has used it solo for weeks.
6. ~~**Export / study report**~~ — ✅ **Shipped.** `/report` renders a printable weekly report (rolling 7 days vs the prior 7). Aggregation lives in `lib/report.ts` (pure, Vitest-covered) and is shared with `/api/tutor/report`. No PDF library and no new Prisma model — the report is recomputed live from the immutable event store. Design + plan: `frontend/docs/superpowers/specs/2026-09-11-export-study-report-design.md`, `.../plans/2026-09-11-export-study-report.md`.
