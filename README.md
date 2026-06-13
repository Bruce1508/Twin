# Linguistic Twin

A French learner-modeling system for self-studying toward TCF Canada (B2 / NCLC 7).

Not a French-teaching app. A **data layer** that models one specific learner's language ability over time, plus a generation layer that reads that model to produce practice targeted at the learner's individual weaknesses.

---

## How it works

Every use follows one closed loop:

```
Write French → Extract tagged errors → Immutable event store
     ↑                                         ↓
Your correction ←← Reverse Tutor drill ←← Profile inference (derived)
```

The learner is the data source, not the content recipient. Every submission makes the system understand the learner more precisely.

---

## Setup

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- A free Gemini API key from [ai.google.dev](https://ai.google.dev) (no credit card)

### 1. Start the database

```bash
docker compose up -d
```

### 2. Configure environment

Edit `frontend/.env`:

```env
DATABASE_URL="postgresql://twin:twin@localhost:5432/twin_dev?schema=public"
GEMINI_API_KEY="your-key-here"
DEV_USER_ID=""   # fill in after step 4
```

### 3. Install dependencies and run migrations

```bash
cd frontend
npm install
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Create the dev user

```bash
docker compose exec db psql -U twin twin_dev -c \
  "INSERT INTO \"User\" (id, email, name, \"targetLevel\", \"createdAt\") \
   VALUES (gen_random_uuid()::text, 'bruce@twin.local', 'Bruce', 'B2', now()) \
   RETURNING id;"
```

Copy the returned `id` into `DEV_USER_ID` in `frontend/.env`.

### 5. Start the app

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

| Route | Purpose |
|---|---|
| `/submit` | Write French text — errors are extracted and stored |
| `/dashboard` | View your accumulated error patterns over time |
| `/practice` | Reverse Tutor drill targeted at your highest-frequency weak point |

**Rate limits (Gemini free tier):** 10 RPM. Verify daily quota live at [ai.google.dev](https://ai.google.dev) — was reduced Dec 2025.

**Privacy:** Free-tier prompts may be used by Google to improve their models. Acceptable here since all data is the author's own French practice.

---

## Architecture

Three layers (full detail in `.claude/PRD-linguistic-twin-en.md`):

- **Layer 1 — Ingestion** (`lib/extractor.ts`): Gemini extracts tagged errors + metrics → immutable `Submission` + `ErrorEvent` rows
- **Layer 2 — Inference** (`lib/profile.ts`): `Profile` recomputed purely from events — never a source of truth, always reconstructable
- **Layer 3 — Generation** (`lib/generator.ts`): Reverse Tutor picks a target error tag, generates a drill, grades the learner's correction

### Error taxonomy

41 normalized `error_tag` codes across 5 categories (grammaire, lexique, orthographe, syntaxe, registre). Defined in `lib/taxonomy.ts` — injected into all LLM prompts, never hardcoded.

### Key invariants

1. `Submission` and `ErrorEvent` rows are **immutable** — corrections create new rows, never updates
2. `Profile` is a **pure derivation** — safe to delete and recompute from events
3. `error_tag` is always a taxonomy code or `uncategorized`

---

## Design documents

| File | Purpose |
|---|---|
| `.claude/PRD-linguistic-twin-en.md` | What and why — architecture, data model, positioning |
| `.claude/implementation-plan-linguistic-twin.md` | Build order, milestone gates, anti-patterns |
| `.claude/prompt-specs-linguistic-twin.md` | LLM contracts for the extractor (Spec A) and Reverse Tutor (Spec B) |

---

## Explicitly out of scope (v1)

Do not add these without a separate plan — they are deliberate omissions, not oversights:

- **Orchestration agent** — targeting logic is deterministic code in `lib/targeting.ts`; the agent (PRD §7) requires this working core first
- **Voice / speech** — written text only in v1; schema supports adding later via `Submission.source`
- **Vector database** — errors queried by tag and time, not semantic similarity
- **Separate Python service** — all logic is LLM calls + DB queries + simple statistics

---

## Stopping / resetting

```bash
docker compose stop        # stop DB, data preserved
docker compose down -v     # wipe everything
```
