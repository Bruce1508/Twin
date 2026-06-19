# Project Status — Linguistic Twin

> Working-context snapshot for the next session. Last updated: 2026-06-19.
> NOT user documentation (see `README.md` for setup). This tracks **what's done, what's verified, and what's queued.**

---

## ⚡ START HERE (next session, read this first)

1. **All 4 TCF Canada skills are DONE and verified end-to-end.** Writing, Reading, Speaking, and Listening are all complete. Vocabulary SRS (Flashcards) is also done. Nothing is half-finished.
2. **To run it:**
   ```bash
   cd /Users/brucevo/Desktop/twin && docker compose up -d   # start Postgres
   cd frontend && npm run dev                                # start app → http://localhost:3000
   ```
3. **If something seems broken, check these first:** `frontend/.env` must have `DATABASE_URL`, `GEMINI_API_KEY`, `DEV_USER_ID` all set. If `DEV_USER_ID` is empty, recover it:
   ```bash
   docker compose exec db psql -U twin twin_dev -c 'SELECT id, email FROM "User";'
   ```
4. **GitHub:** Consolidated into a single repo at `github.com/Bruce1508/Twin` — `frontend/` was merged into root, no more nested git repos.
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
| M1 — Schema + DB | ✅ Verified | **9** models (see below) |
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
| grammaire | 15 | Standard grammar errors |
| syntaxe | 10 | 7 original + 3 added |
| lexique | 9 | 7 original + 2 added |
| orthographe | 6 | Spelling/accents |
| registre | 3 | Register/style |
| comprehension | 12 | 6 reading + 5 listening + 1 general |
| uncategorized | 1 | |

**Flags:** `wholeTextOnly`, `readingOnly`, `speakingOnly`, `listeningOnly`

- `readingOnly` tags excluded from Reverse Tutor (`canRouteToDrill`)
- `speakingOnly` tags: 7 tags covering fluency, pronunciation proxy, discourse markers, etc.
- `listeningOnly` tags: 5 tags covering aural comprehension subtypes

---

## DB models — 9 total

`User`, `Submission`, `ErrorEvent`, `Profile`, `Drill`, `ReadingExercise`, `SpeakingExercise`, `ListeningExercise`, `Flashcard`

`ErrorCategory` enum: `grammaire`, `lexique`, `orthographe`, `syntaxe`, `registre`, `comprehension`

---

## Navigation — 7 links

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

## Full file map (what exists today)

### Library / logic (`frontend/lib/`)
- `taxonomy.ts` — **57** tags across **6** categories. Flags: `wholeTextOnly`, `readingOnly`, `speakingOnly`, `listeningOnly`. Exports `SPAN_TAGS`, `WHOLE_TEXT_TAGS`, `READING_TAGS`, `SPEAKING_TAGS`, `LISTENING_TAGS`. Single source of truth injected into all prompts.
- `db.ts` — Prisma singleton using `PrismaPg` driver adapter.
- `extractor.ts` — Layer 1 (writing): Gemini extracts tagged errors + metrics.
- `profile.ts` — Layer 2: pure recompute of profile from immutable events. `topSpanTags(freq, n)` helper.
- `generator.ts` — Layer 3 (writing): Reverse Tutor drill gen + grading + verification pass. `canRouteToDrill` excludes whole-text, reading, speaking, and listening tags.
- `targeting.ts` — deterministic rule: highest-frequency unresolved span tag.
- `reading.ts` — Gemini article gen, question gen, answer grading (3 funcs).
- `speaking.ts` — `generateSpeakingPrompt`, `transcribeSpeech` (Gemini multimodal audio), `gradeSpeech` (5 criteria /20).
- `listening.ts` — `generatePassage`, `generateQuestions`, `generateAudio` (TTS → raw PCM → WAV header), `gradeAnswers` (pure TypeScript, no extra LLM call).

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

### DB models (`frontend/prisma/schema.prisma`)
9 models: `User`, `Submission`, `ErrorEvent`, `Profile`, `Drill`, `ReadingExercise`, `SpeakingExercise`, `ListeningExercise`, `Flashcard`.
`ErrorCategory` enum has 6 values: `grammaire`, `lexique`, `orthographe`, `syntaxe`, `registre`, `comprehension`.

### Infra / docs (project root)
- `docker-compose.yml` — Postgres 16, port `127.0.0.1:5432`
- `README.md` — user setup instructions
- `PROJECT_STATUS.md` — this file
- `.claude/` — design docs (PRD, taxonomy, prompt specs, implementation plan)

---

## Git state

**Single repo** at `github.com/Bruce1508/Twin` — `frontend/` merged into root, no more nested git repos. The previous two-repo situation has been resolved.

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

## Candidate next features (user picks — none started)

Ranked by leverage for the TCF goal (all 4 TCF skills already built):

1. **B2 rubric writing score** — structured breakdown (range, complexity, register), NOT a CEFR verdict (PRD forbids verdicts). Enhances the writing loop without a new skill.
2. **Drill history / review past drills** — `/drill` index page showing past drills and whether they were resolved.
3. **Spaced repetition for drills** — surface unresolved drill tags on a schedule (analogous to flashcards but for active recall of grammar rules).
4. **Adaptive difficulty** — track B1/B2 level per tag from reading/listening exercises, adjust generation difficulty based on profile.
5. **Multi-user** — auth (Clerk/NextAuth) + BYOK or Stripe billing. Only worth it after the user has used it solo for weeks.
6. **Export / study report** — weekly PDF/markdown summary of errors, resolved vs unresolved, progress over time.
