# Linguistic Twin

A French learner-modeling system for self-studying toward **TCF Canada (B2 / NCLC 7)**.

It is not a French-teaching app. It is a **data layer** that models one specific
learner's language ability over time, plus a generation layer that reads that model
to produce practice targeted at the learner's individual weaknesses.

**Status:** single-user personal tool, in active development. Runs locally; not
multi-user or production-hardened. Also intended as a portfolio piece demonstrating
a stateful user-modeling system (event sourcing + a purely derived profile), not an
LLM API wrapper.

---

## How it works

Writing practice follows one closed loop:

```
Write French → Extract tagged errors → Immutable event store
     ↑                                         ↓
Your correction ←← Reverse Tutor drill ←← Profile inference (derived)
```

The learner is the data source, not the content recipient. Every submission makes
the system model the learner more precisely.

---

## Key features

Covers all four TCF Canada skills, plus vocabulary and a guided daily session:

- **Writing** — submit French text; an extractor tags errors against a fixed
  taxonomy and stores them as immutable events, then a Reverse Tutor drills your
  highest-frequency weak point.
- **Reading** — generated reading-comprehension exercises.
- **Listening** — generated listening exercises with TTS audio.
- **Speaking** — generated speaking prompts with scored responses.
- **Flashcards** — spaced-repetition vocabulary review.
- **Daily session (Aujourd'hui)** — a pre-assembled sequential session so there is
  one thing to do each day, not a 7-way menu choice. Progress is a queue, not a
  calendar: skipped days never read as "behind".
- **Tutor mode** — a passcode-protected `/tutor` dashboard (weekly report,
  submission history, notes/homework) for a human teacher.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 (via Docker Compose, bound to `127.0.0.1` only) |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| LLM | Google Gemini `gemini-2.5-flash` via `@google/genai` (free tier) |
| TTS | `gemini-2.5-flash-preview-tts` (PCM → WAV, served as audio) |
| Tests | Vitest |

---

## Quick start

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- A free Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (no credit card)

### 1. Start the database

```bash
docker compose up -d
```

### 2. Configure environment

```bash
cd frontend
cp .env.example .env
```

Fill in `frontend/.env` (see [Configuration](#configuration)). Leave `DEV_USER_ID`
empty for now — you fill it in after step 4.

### 3. Install dependencies and apply migrations

```bash
npm install
npx prisma migrate dev
```

### 4. Seed the dev user and capture its ID

```bash
npx prisma db seed
docker compose exec db psql -U twin twin_dev -c 'SELECT id, email FROM "User";'
```

Copy the returned `id` into `DEV_USER_ID` in `frontend/.env`.

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration

All variables live in `frontend/.env` (template: `frontend/.env.example`).

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Docker Compose default: `postgresql://twin:twin@localhost:5432/twin_dev?schema=public` |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `DEV_USER_ID` | Yes | UUID of the seeded dev user (from step 4) |
| `TUTOR_PASSCODE` | Only for `/tutor` | Passcode gating the tutor dashboard (any string) |

**Rate limits (Gemini free tier):** ~10 RPM. Verify the current daily quota at
[aistudio.google.com](https://aistudio.google.com); limits changed in Dec 2025.

**Privacy:** free-tier prompts may be used by Google to improve their models.
Acceptable here because all data is the author's own French practice.

---

## Usage

| Route | Purpose |
|---|---|
| `/` | Home — starts the daily session (Aujourd'hui) |
| `/today` | Guided sequential session for the day |
| `/submit` | Write French; errors are extracted and stored |
| `/practice` | Reverse Tutor drill on your highest-frequency weak point |
| `/dashboard` | Accumulated error patterns over time |
| `/read` | Reading-comprehension exercises |
| `/listen` | Listening exercises (with audio) |
| `/speak` | Speaking exercises (scored) |
| `/flashcards` | Spaced-repetition vocabulary review |
| `/tutor` | Passcode-protected teacher dashboard (needs `TUTOR_PASSCODE`) |

---

## Architecture

Three layers (full detail in `.claude/PRD-linguistic-twin-en.md`):

- **Layer 1 — Ingestion** (`frontend/lib/extractor.ts`): Gemini extracts tagged
  errors + metrics into immutable `Submission` and `ErrorEvent` rows.
- **Layer 2 — Inference** (`frontend/lib/profile.ts`): `Profile` is recomputed
  purely from events — never a source of truth, always reconstructable.
- **Layer 3 — Generation** (`frontend/lib/generator.ts`): the Reverse Tutor picks a
  target error tag, generates a drill, and grades the learner's correction.

### Error taxonomy

41 normalized `error_tag` codes across 5 categories (grammaire, lexique,
orthographe, syntaxe, registre), defined in `frontend/lib/taxonomy.ts` and injected
into every LLM prompt — never hardcoded elsewhere.

### Key invariants

1. `Submission` and `ErrorEvent` rows are **immutable** — corrections create new
   rows, never updates.
2. `Profile` is a **pure derivation** — safe to delete and recompute from events.
3. `error_tag` is always a taxonomy code or `uncategorized`.

---

## Project structure

```
.
├── docker-compose.yml          # PostgreSQL 16
├── PROJECT_STATUS.md           # working-context snapshot (not user docs)
├── .claude/                    # design docs (PRD, implementation plan, prompt specs)
└── frontend/
    ├── app/                    # Next.js App Router — pages + /api routes
    ├── lib/                    # extractor, generator, profile, targeting,
    │                           # taxonomy, session, plan, per-skill modules
    ├── prisma/                 # schema.prisma, migrations, seed.ts
    ├── public/
    └── scripts/
```

---

## Testing

```bash
cd frontend
npm test          # run once (Vitest)
npm run test:watch
```

---

## Explicitly out of scope (v1)

Deliberate omissions, not oversights — do not add without a separate plan:

- **Orchestration agent** — targeting is deterministic code in
  `frontend/lib/targeting.ts`; the agent (PRD §7) needs this core working first.
- **Vector database** — errors are queried by tag and time, not semantic similarity.
- **Separate Python service** — all logic is LLM calls + DB queries + simple stats.
- **Multi-user / auth** — single-learner tool; schema supports extension later.

---

## Stopping / resetting

```bash
docker compose stop        # stop DB, data preserved
docker compose down -v     # wipe everything
```

---

## Design documents

| File | Purpose |
|---|---|
| `.claude/PRD-linguistic-twin-en.md` | What and why — architecture, data model, positioning |
| `.claude/implementation-plan-linguistic-twin.md` | Build order, milestone gates, anti-patterns |
| `.claude/prompt-specs-linguistic-twin.md` | LLM contracts for the extractor (Spec A) and Reverse Tutor (Spec B) |

---

## License

[TODO: Add a license — no LICENSE file currently exists in the repository.]
