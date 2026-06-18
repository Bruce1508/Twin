# Implementation Plan — Linguistic Twin (v1 core)

**Build guide for Claude Code · companion to PRD v0.2, Error Taxonomy v0.1, Prompt Specs v0.1**

| | |
|---|---|
| Purpose | The ordered, verifiable build plan. Defines WHAT to build, in WHAT order, and HOW to know each step is correct before moving on. |
| Audience | Claude Code (and the author reviewing its work) |
| Scope | v1 core only: the three Twin layers + the Reverse Tutor generator |
| **Explicitly NOT in this plan** | The orchestration agent (PRD §7) and voice ingestion (PRD 6.4). See "Scope discipline" below — do not build these. |

---

## 0. How to use this document (read first, every session)

This is the controlling document for implementation. The three design documents (PRD, Taxonomy, Prompt Specs) are the **source of truth for decisions**; this document is the **source of truth for sequence and verification**. When they appear to conflict, the design docs win on *what a thing is*, this doc wins on *when to build it*.

**Operating rules for Claude Code:**

1. **Build one milestone at a time, in order.** Do not start milestone N+1 until milestone N passes its verification gate. Each milestone is a separate unit of work and should be a separate commit (or set of commits).
2. **Every milestone ends with a verification gate** — a concrete, checkable condition. If the gate cannot be met, STOP and report what failed rather than proceeding. A half-working foundation that looks done is the most expensive failure mode.
3. **Do not invent scope.** If something seems useful but is not in the current milestone, note it and move on — do not build it. This applies especially to the agent layer and voice (see below).
4. **When a decision is genuinely ambiguous and not covered by the design docs, STOP and ask** rather than guessing. A wrong guess buried in working-looking code is exactly the failure this plan exists to prevent.
5. **Prefer the simplest thing that passes the gate.** The design docs already argued against over-engineering (PRD 6.4). No microservices, no vector DB, no extra abstraction layers, unless a milestone explicitly calls for it.

### Scope discipline (the most important rule)

The single biggest risk is building too much. Two things are **forbidden** in this plan and must not be built even if they seem like natural extensions:

- **No orchestration agent.** The "decide what to practice next" logic in v1 is a simple, explicit rule in code (defined in M5). The agent that replaces that rule is a *future, separate effort* with its own plan, and it requires this core to exist first. If you find yourself writing an LLM call that decides which generator to invoke, STOP — that is the agent, and it is out of scope.
- **No voice / speech.** v1 ingests written text only. Do not add STT, audio recording, or pronunciation features. The schema is built to allow voice later; that is all.

If a milestone's work tempts you toward either, that temptation is the signal to re-read this section.

---

## 1. Target architecture recap (for grounding)

Three layers, closed loop (full detail in PRD §6):

- **Layer 1 — Ingestion:** learner writes text → extractor LLM produces tagged errors + metrics → stored as immutable events.
- **Layer 2 — Event store + Inference:** immutable `SUBMISSION` + `ERROR_EVENT` records (source of truth); a periodically-computed `PROFILE` (derived cache).
- **Layer 3 — Generation:** reads the profile → picks a target error tag → Reverse Tutor builds a drill → learner's correction flows back to Layer 1.

The build order below follows the data flow: first the ability to capture and store production, then the ability to see patterns, then the ability to generate targeted practice.

---

## 2. Tech stack (fixed — do not deviate without asking)

Per PRD 6.4:

- **Framework:** Next.js (App Router) + TypeScript. Backend logic lives in API routes/server actions — NO separate Python service.
- **Database:** PostgreSQL via Prisma ORM. JSON columns for flexible fields (`metrics`, profile fields, drill payload).
- **LLM:** `gemini-2.5-flash` via the `@google/genai` SDK (Google AI Studio free tier — `ai.google.dev`, no credit card, `GEMINI_API_KEY` env var). Structured JSON output via `generationConfig: { responseMimeType: "application/json", responseSchema: {...} }` — mandatory for both core LLM calls. Rate limit: 10 RPM; verify daily quota live at ai.google.dev (was reduced Dec 2025). Provider is swappable in v2+ without changing prompt content or output schemas.
- **No vector database.** Queries are by `error_tag`, time, and category — relational, not semantic.
- **Styling:** Tailwind (matches author's existing workflow).

The taxonomy is stored as application data (a TypeScript constant or a seed table) so it can be injected into prompts, NOT hardcoded inside prompt strings (Prompt Specs cross-cutting requirement).

---

## 3. Milestones

Each milestone has: **Goal · What to build · Verification gate · Out of scope for this milestone.**

---

### M0 — Project scaffold & taxonomy as data

**Goal:** a running Next.js + Prisma + Postgres skeleton, with the error taxonomy loaded as injectable application data.

**What to build:**
- Initialize Next.js (App Router, TypeScript) + Tailwind.
- Install the Gemini SDK: `npm install @google/genai`. Add `GEMINI_API_KEY=""` to `.env` (obtain a free key at ai.google.dev — no credit card required).
- Set up Prisma connected to a local Postgres (document the connection setup in the README).
- Encode the Error Taxonomy v0.1 as a typed structure (a TS module exporting the categories, tags, glosses, and examples). This is the single in-code representation of the taxonomy; everything that needs the tag list imports from here.
- A trivial health-check page or route confirming the app runs and can reach the DB.

**Verification gate:**
- `npm run dev` serves the app without error.
- A script or route can read the taxonomy structure and print the count of tags (should match the taxonomy file).
- Prisma can connect to the DB (`prisma db push` or a connection test succeeds).

**Out of scope for M0:** any real schema tables (next milestone), any LLM calls.

---

### M1 — Data model (the schema)

**Goal:** the five-entity schema from PRD 6.3 exists in the database, with correct relationships and constraints.

**What to build:**
- Prisma schema for the five entities: `User`, `Submission`, `ErrorEvent`, `Profile`, `Drill`, with fields and relationships exactly as PRD 6.3 specifies.
- Key constraints to enforce in the schema:
  - `ErrorEvent.error_tag` is a string constrained at the application layer to the taxonomy enum (Prisma enum if practical, or validated on write).
  - `ErrorEvent.category` derivable from tag; store both but treat the taxonomy module as the source of the mapping.
  - `Drill.source_error_id` is a nullable FK to `ErrorEvent` (nullable because some future drills may not originate from a single error, but Reverse Tutor drills always set it).
  - `Profile` has a 1:1 relation to `User`.
  - JSON columns for `Submission.metrics`, `Profile` derived fields, `Drill.payload`.
- A seed creating one test `User` (the author) for development.

**Verification gate:**
- `prisma migrate` runs cleanly; `prisma studio` shows all five tables with the correct columns and relations.
- A written test (or a seed script) can: create a submission, attach two error events to it, and read them back via the relation. The FK from error event to submission works both directions.
- Attempting to write an `error_tag` not in the taxonomy is rejected (or flagged) by the validation layer.

**Out of scope for M1:** any LLM calls, any UI beyond what's needed to test, profile computation.

---

### M2 — Ingestion + error extraction (Layer 1)

**Goal:** a learner can submit written French; the system extracts tagged errors and metrics per Prompt Spec A and stores them as immutable events. This is the prototype grader, re-homed onto the real schema and constrained to the taxonomy.

**What to build:**
- A submission form (text input + task-type/prompt selector for register context, per Spec A.1).
- A server-side route that calls the extractor LLM using Spec A's system prompt and output schema, with the taxonomy injected as the valid-tag list. Use `generationConfig: { responseMimeType: "application/json", responseSchema: <Spec A.3 schema> }` for guaranteed structured output; read key from `process.env.GEMINI_API_KEY`.
- On response: persist one `Submission` and N `ErrorEvent` rows (span errors), plus whole-text observations, plus `metrics`. All immutable — written once, never updated.
- A results view showing the extracted errors (excerpt, correction, tag, explanation) and the metrics.

**Verification gate:**
- Submitting a deliberately error-laden French paragraph returns errors, each carrying a tag that exists in the taxonomy (zero invented tags; anything unmatched is `uncategorized`).
- Submitting a correct French paragraph returns an empty error list but still stores the submission and metrics (empty result is valid — Spec A.4).
- A whole-text issue (e.g. only et/mais used across many sentences) appears in `whole_text_observations`, NOT forced into a span error (Spec A.3 / taxonomy note #3).
- After submission, `prisma studio` shows the immutable `Submission` + `ErrorEvent` rows persisted correctly with verbatim excerpts.

**Out of scope for M2:** profile computation, any drill generation, any "what to practice next" logic.

---

### M3 — Inference / Profile (Layer 2)

**Goal:** a derived ability profile is computed from the immutable events — turning scattered errors into visible patterns.

**What to build:**
- A profile-computation function that reads all of a user's `Submission` + `ErrorEvent` rows and produces the `Profile`: `error_frequencies` (count per tag), `known_vocab` estimate, `complexity_trend` (metrics over time), `computed_at`.
- This function is **pure recomputation from events** — it must be safe to run repeatedly and must never depend on prior profile state (PRD Principle 1). Running it twice on the same events yields the same profile.
- A trigger to recompute (for v1, recompute-on-read or after each new submission is fine; do not over-engineer scheduling).
- A dashboard view: top error tags by frequency, the complexity trend over time, total submissions/words produced.

**Verification gate:**
- After several submissions, the dashboard shows the top error tags with correct counts (cross-check counts against `ErrorEvent` rows directly).
- Deleting the profile and recomputing produces an identical profile (proves it's a pure derivation, not a source of truth).
- The complexity trend reflects the metrics of submissions over time (e.g. average sentence length per submission plotted).
- No code path writes to `Profile` except the recomputation function.

**Out of scope for M3:** drill generation, targeting logic.

---

### M4 — Reverse Tutor generator (Layer 3, generation)

**Goal:** given a target error tag, generate a Reverse Tutor drill, let the learner correct it, and grade their response — per Prompt Spec B.

**What to build:**
- A generator route: input a target `error_tag` (for this milestone, it can be passed in manually or picked as "highest-frequency unresolved tag" — the simple rule, see M5 note), calls the Reverse Tutor LLM (Spec B.2 prompt, B.3 schema), stores the result as a `Drill` with `source_error_id` set.
- A drill UI: renders only sentence `id` + `text`, hides the answer key; learner marks which are faulty and writes corrections.
- A grading route: calls the grading sub-step (Spec B.4), returns per-sentence results + summary.
- Persist the learner's corrections as a **new `Submission`** (closing the loop — Prompt Specs integration note #2), linked back to the drill.
- Apply the verification pass (Spec B.5) before showing a drill: a cheap second call confirming no "correct" sentence contains an unintended error. If it fails, regenerate.

**Verification gate:**
- Requesting a drill for a specific tag (e.g. `subjonctif_apres_conjonction`) returns sentences where the faulty ones contain that error type and only that type; the correct ones are genuinely correct (manually verify a few).
- The learner UI never exposes the answer key before submission (check the network payload, not just the rendered page).
- Submitting answers returns sensible grading: a correct identification is marked correct; a valid correction that differs from the key is still accepted (Spec B.5).
- The learner's correction is stored as a new `Submission` and is itself run through the extractor (loop closes — verify a new submission row appears).
- Whole-text tags (e.g. `connecteur_logique_absent`) are NOT routed to this generator (Spec B.5 — routing must exclude them).

**Out of scope for M4:** any LLM-driven decision about *which* tag to target (that's the simple rule in M5, and the agent is forbidden entirely).

---

### M5 — Closing the loop + targeting rule

**Goal:** the system runs as a coherent loop: produce → extract → profile → pick a target → drill → correct → back to produce. The "pick a target" step is an explicit, simple, inspectable rule — NOT an agent.

**What to build:**
- A targeting function implementing one explicit rule: select the highest-frequency `error_tag` that is not yet `resolved` (skipping whole-text tags, which this generator can't handle). This is deliberately a few lines of deterministic code.
- `resolved` logic: an `error_tag` moves toward resolved based on accumulated `tag_mastery_signal` across drills over time (Spec B.4) — never on a single drill. Define a simple, explicit threshold (e.g. N consecutive 'improving' signals); document the threshold in code.
- A simple "practice" entry point that ties it together: the learner lands, the system shows their profile and offers the next recommended drill (from the targeting rule), they do it, results update.

**Verification gate:**
- From a cold start (author writes a few paragraphs), the system independently surfaces a real weak tag and generates a relevant drill for it — end to end, no manual tag selection.
- Doing well on a tag's drills repeatedly moves it toward `resolved` and the targeting rule then moves on to the next tag (verify the progression).
- The targeting logic is plain, readable code with no LLM call — confirm there is no hidden "agent" deciding the path (scope discipline check).
- The full loop is traceable in the DB: a drill's correction becomes a submission, which produces new error events, which update the profile.

**Out of scope for M5:** the orchestration agent (forbidden), any additional generators beyond Reverse Tutor, voice.

---

### M6 — Hardening & honesty surfaces

**Goal:** make the v1 trustworthy to actually use for studying, and honest about its limits (PRD 8.2).

**What to build:**
- Surface the conservative-estimate framing in the UI: never present a CEFR verdict or pass/fail certainty; present errors, patterns, and progress signals only (PRD 8.2). Where any level estimate appears, label it as a non-authoritative estimate.
- Basic resilience: handle malformed LLM JSON (retry once, then fail gracefully with a clear message), handle the excerpt-not-found-verbatim case (Spec A.4 — store the event without offset rather than dropping it).
- A monitoring view for the `uncategorized` rate (taxonomy-gap signal, taxonomy note + Spec A.4). A rising rate tells the author to refine the taxonomy.
- README documenting setup, the design-doc references, and the explicit out-of-scope list (agent, voice) so the boundaries survive into the future.

**Verification gate:**
- Nowhere does the UI assert "you are B2" or a definitive score; level language is always hedged as an estimate.
- Feeding deliberately malformed conditions (force a bad LLM response in a test) does not corrupt stored data or crash the app.
- The `uncategorized` rate is visible somewhere the author will see it.
- A new developer (or the author months later) can read the README and understand both what to build next and what was deliberately left out.

**Out of scope for M6:** everything in the forbidden list; performance optimization beyond basic resilience.

---

## 4. Definition of done for v1 core

v1 core is complete when, end to end:

1. The author can write French and get specific, taxonomy-tagged error feedback (M2).
2. The system shows the author their personal error patterns over time (M3).
3. The system independently identifies a real weakness and generates a targeted Reverse Tutor drill for it (M4 + M5).
4. Correcting that drill feeds new data back into the system, deepening the profile (M5).
5. Nothing in the system over-claims about CEFR level; limits are honest (M6).
6. The orchestration agent and voice do NOT exist — they are documented as deliberate future work, not omissions (scope discipline).

When all six hold and every milestone gate has passed, v1 core is done. The orchestration agent becomes a separate effort with its own plan, built ON TOP of this working core — exactly as PRD §7 requires.

---

## 5. Anti-patterns to watch for (self-check for Claude Code)

If any of these are happening, stop and reconsider:

- **Writing to `Profile` from anywhere but the recompute function.** Violates Principle 1; the profile must stay a pure derivation.
- **An LLM call that decides which generator/tag to use.** That is the forbidden agent. Targeting in v1 is deterministic code.
- **Inventing `error_tag` values, or letting the extractor emit free-form tags.** Violates Principle 2; use `uncategorized`.
- **Mutating or deleting `Submission`/`ErrorEvent` rows.** They are immutable events; corrections create NEW submissions.
- **Building voice, STT, or pronunciation anything.** Out of scope, full stop.
- **Collapsing repeated errors into one to "clean up" the data.** Frequency is the signal; keep every occurrence.
- **Adding a vector DB, a Python service, or an abstraction layer "for later."** YAGNI; the design docs argued this explicitly.
- **Skipping a verification gate because the code "looks right."** Looking right is exactly the failure this plan guards against. Run the gate.

---

*End of implementation plan. Build M0 → M6 in order, gate by gate. The design docs answer "what" and "why"; this document answers "in what order" and "how do I know it's correct." When in doubt, stop and ask rather than guess.*
