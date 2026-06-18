# Prompt Specifications — Linguistic Twin

**Companion to PRD v0.2 and Error Taxonomy v0.1**

| | |
|---|---|
| Purpose | Exact specification of the two core LLM calls: the error extractor (Layer 1) and the Reverse Tutor generator (Layer 3) |
| Status | v0.1 |
| Shared contract | Both prompts consume the Error Taxonomy as a closed enum of `error_tag` values |
| Out of scope | Application code, retry/error-handling plumbing, model selection economics |

---

## How to read this document

Each spec defines four things:
1. **Contract** — inputs in, structured output out.
2. **System prompt** — the instruction block (written to be copied near-verbatim into code).
3. **Output schema** — the exact JSON shape, field by field.
4. **Edge cases & failure modes** — what goes wrong and how the prompt handles it.

A design rule applies to both: **the LLM is asked to classify and generate, never to make the final state decision.** It returns structured data; application code decides what to store and what to do next. This keeps the system debuggable (PRD 7.1 pipeline discipline) and the LLM's role narrow.

Two cross-cutting requirements, true of both prompts:
- **Structured output is mandatory.** Both calls use Gemini's JSON-schema mode: set `generationConfig: { responseMimeType: "application/json", responseSchema: <schema> }` at model-init time (v1 SDK: `@google/genai`). The API enforces conformance to the schema — free-form prose is rejected at the network level. *(Provider-agnostic note: if the provider changes in v2+, only this enforcement wiring changes; the prompt text and output schemas defined below remain exactly as written.)*
- **The taxonomy is injected, not hardcoded in the prompt text.** The list of valid `error_tag` codes is passed in as data (so updating the taxonomy file updates both prompts without rewriting them). The prompt references "the provided list of valid tags," and the code supplies it.

---

## Spec A — Error Extractor (Layer 1)

### A.1 Contract

**Input:**
- The learner's text (a `SUBMISSION`'s content).
- The task context: which writing task type and prompt it answers (so register can be judged — a casual message vs a formal argument have different register expectations).
- The injected taxonomy: the full set of valid `error_tag` codes with their glosses and examples.

**Output:** a single JSON object containing (a) a list of span-level errors, (b) a list of whole-text observations, and (c) quantitative metrics. See A.3.

**What it must NOT do:** assign a CEFR level or a score. (PRD 8.2 — the model is unreliable at the B1/B2 boundary judgment; we do not ask it to make one. We ask only "what specifically is wrong," which it does well.)

### A.2 System prompt

> You are an expert French language analyst specializing in the errors of learners at the B1–B2 level. Your job is to analyze a piece of written French and identify every error, classifying each one using ONLY the fixed taxonomy provided to you.
>
> **Absolute rules:**
> - You MUST classify each error using exactly one `error_tag` from the provided list of valid tags. You are FORBIDDEN from inventing new tags. If a genuine error fits no tag in the list, assign it the tag `uncategorized` — never approximate with a wrong tag and never create a new one.
> - You identify two kinds of findings:
>   - **Span errors**: a specific incorrect span of text (a word, phrase, or clause). For each, you give the exact faulty excerpt, the correction, the `error_tag`, and a brief explanation in simple language.
>   - **Whole-text observations**: judgments about the text as a whole that are not tied to one span (e.g. over-reliance on basic connectors, absence of logical linking, register mismatch across the piece). These use the same tags but have no single excerpt.
> - Judge **register** against the task context provided. A familiar register in a formal argument is an error (`registre_trop_familier`); the same register in a casual message is not.
> - Do NOT assign a CEFR level. Do NOT give an overall score. Do NOT rewrite the whole text. Your sole job is precise, tagged error identification plus the quantitative metrics requested.
> - Be precise, not exhaustive-to-a-fault: flag real errors, not stylistic preferences. If a sentence is correct but could be more elegant, that is NOT an error. Only flag what is actually wrong or clearly sub-B2.
> - Every explanation is written so the learner understands *why* it is wrong and *what rule applies* — in one or two sentences, in simple French or the learner's language, not grammar jargon alone.
>
> Return ONLY a valid JSON object matching the provided schema. No prose outside the JSON.

### A.3 Output schema

```json
{
  "span_errors": [
    {
      "excerpt": "string — the exact faulty text, copied verbatim from the input",
      "correction": "string — the corrected version of that span",
      "error_tag": "string — one code from the valid tag list, or 'uncategorized'",
      "explanation": "string — one or two sentences, learner-friendly"
    }
  ],
  "whole_text_observations": [
    {
      "error_tag": "string — a frequency/whole-text tag from the valid list",
      "explanation": "string — what the text-wide issue is and how to fix it",
      "evidence": "string — optional short illustration, e.g. 'uses only et/mais across 6 sentences'"
    }
  ],
  "metrics": {
    "word_count": "integer",
    "sentence_count": "integer",
    "avg_sentence_length": "number — words per sentence",
    "lexical_diversity": "number — distinct lemmas / total words (type-token ratio), 0..1",
    "subordinate_clause_count": "integer — a rough proxy for syntactic complexity",
    "distinct_connectors_used": "integer — count of distinct logical connectors observed"
  }
}
```

**Field notes:**
- `excerpt` MUST be copied verbatim so application code can locate it in the original text (for UI highlighting and for linking the resulting `ERROR_EVENT`). If the model paraphrases the excerpt, the link breaks — the prompt stresses "copied verbatim."
- `whole_text_observations` is the schema's answer to taxonomy note #3: frequency-flagged tags (`repetition_connecteur_basique`, `connecteur_logique_absent`) land here, not in `span_errors`, so they never get forced into a fake excerpt.
- `metrics` feed the `SUBMISSION.metrics` JSON and, in aggregate over time, the `PROFILE.complexity_trend`. These are computed by the model as observations of the text, not learner judgments. (If later you want deterministic metrics, these can move to code-based computation; for v1, model-estimated is acceptable and simpler.)

### A.4 Edge cases & failure modes

| Situation | Handling |
|---|---|
| Text is fully correct | Return empty `span_errors` and `whole_text_observations`; still return metrics. An empty error list is a valid, important result (it's evidence of mastery). |
| Same error type repeated many times | Emit one span error per occurrence (so counts are accurate), all sharing the `error_tag`. Do NOT collapse into one — frequency is the signal. |
| Overlapping/nested errors in one span | Emit the most specific applicable tag for the primary error; if two genuinely independent errors share a span, emit two entries. |
| Ambiguous: error vs stylistic choice | Default to NOT flagging. The prompt explicitly forbids flagging mere inelegance. False positives erode trust faster than false negatives. |
| Model wants to invent a tag | The prompt forbids it; `uncategorized` is the pressure-release valve. A rising `uncategorized` rate is monitored as a taxonomy-gap signal. |
| Excerpt the model returns isn't found verbatim in source | Application-code concern, not prompt: code attempts a fuzzy locate; if it fails, the event is stored without a UI offset but still counted. |
| Very short input (one sentence) | Process normally; metrics like `lexical_diversity` are noisy on short text — this is acknowledged downstream in the profile (small-sample caveat), not in the prompt. |

---

## Spec B — Reverse Tutor Generator (Layer 3)

### B.1 Contract

**Input:**
- A single target `error_tag` (chosen by the generation layer because it is high-frequency and unresolved for this learner).
- The taxonomy entry for that tag (gloss + example), injected.
- A topic/context hint (to keep sentences varied and relevant; optional, can be learner-set or rotated).
- Difficulty/quantity parameters: how many sentences, and the ratio of faulty to correct.

**Output:** a JSON object describing a drill — a set of sentences, an internal answer key marking which are faulty and why, and the targeted tag. See B.3.

**The core challenge (stated honestly):** the value of this prompt is making the planted errors **natural and subtle** — the kind a B1→B2 learner actually makes — not cartoonish errors anyone spots instantly. And the "correct" sentences must be *genuinely* correct, or the drill teaches the wrong thing. These two quality bars are where the prompt earns its keep.

### B.2 System prompt

> You are a French teacher creating a diagnostic exercise for a learner at the B1–B2 level. The learner's role is REVERSED: instead of you correcting them, THEY must find and correct errors that you deliberately plant. This builds error-recognition skill and leverages the way teaching something deepens one's own mastery.
>
> You are given ONE target error type (an `error_tag` with its definition and example). Your task:
>
> 1. Write the requested number of French sentences on the given topic.
> 2. In some of them (per the faulty/correct ratio given), plant exactly the target error type — and ONLY that error type. The rest must be fully correct.
> 3. Mark, in the answer key, which sentences are faulty, where the error is, and the correction.
>
> **Absolute rules:**
> - The planted error must be the TARGET type only. Do not introduce other errors, even small ones, into any sentence — a "correct" sentence with an accidental typo ruins the exercise. Proofread every sentence.
> - The planted errors must be **natural and plausible** — the kind a real B1–B2 learner makes. Avoid obvious, exaggerated errors. The difficulty is in making the learner think.
> - The "correct" sentences must be genuinely, unambiguously correct French at B2 level. If you are not certain a sentence is correct, replace it.
> - Vary sentence structure and vocabulary so the exercise doesn't feel formulaic. Use the topic provided to keep it engaging.
> - Sentences should be B1–B2 in complexity — not trivially simple, not C2-obscure.
>
> Return ONLY a valid JSON object matching the provided schema. The answer key is for the application, not shown to the learner until they respond.

### B.3 Output schema

```json
{
  "target_error_tag": "string — echoes the requested tag",
  "topic": "string — the topic used",
  "sentences": [
    {
      "id": "integer — stable id within this drill",
      "text": "string — the French sentence as shown to the learner",
      "is_faulty": "boolean",
      "error_span": "string|null — if faulty, the exact faulty span; null if correct",
      "correction": "string|null — if faulty, the corrected full sentence; null if correct",
      "explanation": "string|null — if faulty, why it's wrong; null if correct"
    }
  ]
}
```

**Field notes:**
- The learner UI renders only `id` and `text`, with `is_faulty`/`error_span`/`correction`/`explanation` withheld until they submit their judgment.
- The whole `sentences` array (with key) is stored as the `DRILL.payload`. The `target_error_tag` plus the originating error link populate `DRILL.source_error_id`.
- After the learner answers, a separate grading step (below) compares their judgment to this key.

### B.4 The grading sub-step

When the learner submits their answers (which sentences they think are faulty + their corrections), a second LLM call grades it. This is a small, well-bounded call:

**Input:** the drill's sentences + answer key, and the learner's responses.
**Output:**

```json
{
  "results": [
    {
      "sentence_id": "integer",
      "learner_flagged_faulty": "boolean",
      "correctly_identified": "boolean — did they match the key on faulty/correct",
      "correction_quality": "string enum: 'correct' | 'partial' | 'wrong' | 'not_applicable'",
      "feedback": "string — brief, encouraging, specific"
    }
  ],
  "summary": {
    "detection_accuracy": "number — fraction of sentences correctly judged faulty/correct",
    "correction_accuracy": "number — of the faulty ones they caught, fraction corrected well",
    "tag_mastery_signal": "string enum: 'improving' | 'mixed' | 'still_struggling'"
  }
}
```

**Why `tag_mastery_signal` matters:** this is the value that, fed back to application code, updates whether the originating `error_tag` trends toward `resolved`. It is the measurable learning signal (PRD §9). Note it is a *signal*, not a verdict — application code combines it with the longer history before flipping `resolved`, never on a single drill.

### B.5 Edge cases & failure modes

| Situation | Handling |
|---|---|
| Model plants an unintended second error | Highest-severity failure (corrupts the exercise). Mitigation: the prompt's explicit proofread instruction + the faulty/correct ratio; optionally a verification pass (a cheap second call asking "does any 'correct' sentence contain any error?") before showing to the learner. This is the strongest candidate for the secondary extraction-agent in PRD 7.3. |
| Learner's correction is valid but different from the key | The grading prompt judges *correctness*, not string-match to the key — a different valid correction counts as correct. The system prompt for grading must state this explicitly. |
| Learner flags a "correct" sentence as faulty | Grade as a detection miss, but the feedback explains *why the sentence was actually correct* — this is itself a learning moment about the rule. |
| Target tag is a whole-text type (e.g. `connecteur_logique_absent`) | These tags are poorly suited to the sentence-level Reverse Tutor format. The generation layer should NOT route whole-text tags to this generator; they need a different drill type (a future generator). Documented here so the routing logic excludes them. |
| Requested topic is too narrow to yield varied sentences | Model falls back to a broader related topic; acceptable. |

---

## Cross-spec integration notes (not implementation)

1. **Shared taxonomy is the contract.** The extractor *writes* `error_tag`s; the Reverse Tutor *reads* one and generates against it; the grader *confirms* movement on it. All three speak the same closed vocabulary — which is the entire point of Principle 2. A change to the taxonomy file propagates to all three because it is injected, not hardcoded.

2. **The loop closes here, concretely.** Extractor turns a submission into tagged errors → generation layer picks a tag → Reverse Tutor builds a drill → learner's correction is itself new French production → that correction is fed back through the *extractor* as a new submission. The learner never stops generating data.

3. **What is deliberately still a pipeline, not an agent.** All of the above is fixed-sequence: extract, then store, then later generate, then grade. No step needs to decide *what to do next* dynamically — so none of it is an agent. The agent (PRD §7) sits above this, deciding *which tag to target and which generator to invoke* — a decision these specs deliberately leave to the caller, which is exactly the seam the orchestrator agent later occupies.

---

*This completes the foundational design set: PRD (what/why), Taxonomy (the shared vocabulary), and Prompt Specs (the two core LLM contracts). Implementation — schema migration, API routes, UI — can now proceed against fixed contracts rather than guesses.*
