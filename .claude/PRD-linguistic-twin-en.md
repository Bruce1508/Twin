# PRD — Linguistic Twin

**A learner-modeling system for self-studying French toward TCF Canada (B2+)**

| | |
|---|---|
| Document version | 0.2 — adds orchestrator-agent layer |
| Author | Bruce |
| Scope of this document | Problem · positioning · system architecture · data model · agent layer · boundaries & risks |
| **Out of scope** | Implementation roadmap, milestones, time estimates, code-level detail, go-to-market plan |

> This document deliberately does **not** describe *how to build* the system. It describes *what* and *why*, in enough detail that every later architectural decision can be traced back to a clear reason.

---

## 1. Executive summary

Linguistic Twin is not a French-learning app. It is a **data layer that models one specific learner's language ability over time**, plus a generation layer that reads that model to produce practice targeted at the learner's individual weaknesses.

The core difference from every existing platform lies in the **direction of data flow**. Traditional learning platforms push fixed content *into* the learner. AI chatbots respond per session but never accumulate a persistent model of the learner. Linguistic Twin pulls data *out* of the learner's own language production (the sentences they write, the errors they make), stores it permanently, and generates content *back* aimed at their personal error patterns.

The consequence: every use makes the system understand the learner more deeply. This is an **architectural** advantage, not a feature — and it is what creates a data moat that competitors cannot copy by imitating an interface.

The system's first and primary user is the author: a Computer Science student in Canada, self-studying French toward **B2 across all four skills** (equivalent to NCLC 7) for a permanent-residency application. The project is simultaneously a portfolio piece intended to demonstrate the ability to design a stateful user-modeling system, rather than the ability to call an API.

---

## 2. Background & problem statement

### 2.1 The user's problem

A self-learner studying French for the TCF, without a tutor, faces four core problems:

1. **No quality feedback on productive skills (speaking/writing).** Receptive skills (listening/reading) can be self-graded against answer keys. Productive skills cannot — and this is exactly where learners are most likely to fail at the B2 threshold.
2. **No visibility into their own systematic errors.** Learners repeat the same category of error for months without realizing it, because no one (including themselves) tracks the pattern over time.
3. **Forgetting due to passive study.** Memorizing quickly but without context and without correctly-timed review leads to rapid forgetting.
4. **Lack of a clear path and durable motivation.** Without an accountability mechanism, self-learners commonly quit.

### 2.2 Why a tutor solves this, and which parts AI can replace

The real value of a good tutor has six components that are not equally valuable:

| A tutor's value | Can AI replace it? |
|---|---|
| (a) Fine-grained error diagnosis | **Largely** — given the learner's production data |
| (b) Feedback at the right dosage | Yes, if carefully designed |
| (c) Forcing language production (forced output) | **Half** — AI creates unlimited opportunity but carries no social weight |
| (d) Accountability / social motivation | **Almost not at all** — the Achilles' heel of every self-study app |
| (e) Dynamic path adjustment | Yes — this is a data problem |
| (f) Cultural / pragmatic modeling | The knowledge part, yes; the "living in it" part, no |

Linguistic Twin is strongest at (a) and (e), where AI has a clear advantage from its capacity to process data. The system **does not try to replace (d) with technology** — this is a deliberate design decision, not an oversight (see Risks).

### 2.3 What AI can do that even the best tutor cannot

This is where the real advantage lives:

- **Perfect, unlimited memory over time.** A good tutor forgets a learner's errors from a few months ago. So does the learner. The system forgets nothing and detects patterns across thousands of data points.
- **Always available, non-judgmental, near-zero marginal cost.** The learner can practice production at any hour, failing as many times as needed.
- **Measuring the invisible.** Tracking syntactic complexity, lexical diversity, and the learner's *own* progress week over week — turning hidden language ability into visible data.

---

## 3. Product positioning

### 3.1 Positioning statement

Linguistic Twin is positioned in the category of **"personalized learner-modeling systems,"** **not** the category of "AI-powered French-learning apps," which is already overcrowded.

> Not a French-teaching app. A learner-modeling system that accumulates over time: it learns each individual's error patterns and generates practice content aimed back at their weaknesses — including a role-reversal mechanism in which the learner corrects errors that the AI produces. The core difference is a persistent memory layer about *the learner*, which content-fixed apps and structurally memoryless chatbots do not have.

### 3.2 Competitive comparison

| Criterion | Duolingo | ChatGPT | Anki | **Linguistic Twin** |
|---|---|---|---|---|
| What it models | Fixed content | Nothing (forgets after each session) | Cards the user enters | **The learner's language ability over time** |
| Personalization | Generic algorithm for everyone | Current-session context | Per-card review schedule | **Per-individual accumulated error patterns** |
| Targets the user's own errors | No | Only if the user points them out | No | **Automatically detects and re-targets** |
| Detects recurring errors over time | No | No | No | **Yes** |
| Data-flow direction | Pushes into the learner | Reacts per session | User loads it | **Pulls out of production, generates back** |
| Barrier to copying | Proprietary content | Almost no moat | User-created content | **Accumulated personal data over time** |

### 3.3 What is NOT unique (stated plainly to avoid self-delusion)

Honest positioning requires naming the parts that do *not* create an advantage:

- **LLM-based writing assessment** — many tools already do this.
- **Spaced repetition** — Anki and other SRS systems have done this for years.
- **Individual features** (including the Reverse Tutor role-reversal mechanism) can each be copied in a short time, technically speaking.

The advantage does **not** lie in any clever feature, but in the **data layer beneath every feature**. A competitor can copy a single drill; they cannot copy months of a specific user's accumulated error data.

---

## 4. Users & goals

### 4.1 Primary user (v1)

A Computer Science student in Canada, self-studying French, targeting **B2 across all four skills** (NCLC 7) for a PR application. Highly and intrinsically motivated (a concrete immigration goal), and therefore willing to put in the effort of language production — this matters because it is a precondition for the system to function at all (see 7.1).

### 4.2 Product goals

- Provide quality, specific, consistent feedback on productive skills.
- Turn the learner's errors from invisible into visible data, trackable over time.
- Generate practice aimed at individual weaknesses rather than generic content.
- Create a closed loop in which every use makes the system understand the learner more deeply.

### 4.3 Portfolio goals

Demonstrate the ability to design a stateful user-modeling system with a memory and analytics layer — positioning the author as a "systems-design engineer" rather than an "API caller."

### 4.4 Reference score thresholds (TCF Canada → NCLC 7)

The system targets the B2 = NCLC 7 threshold. The corresponding TCF Canada score thresholds (from third-party aggregated sources, **to be verified against official IRCC documentation before use for any legal or exam decision**):

| Skill | NCLC 7 threshold |
|---|---|
| Compréhension orale (listening) | 458–502 |
| Compréhension écrite (reading) | 453–498 |
| Expression orale (speaking) | 10–11 |
| Expression écrite (writing) | 10–11 |

Each skill is reported and assessed **separately** — there is no aggregate score. One skill below threshold drags down the entire NCLC. This is why the "B2 across all skills" goal is strict, and it is a design constraint for every assessment feature.

---

## 5. Architecture philosophy

The entire architecture revolves around a single loop:

> **Produce → Get errors caught immediately → Errors remembered permanently → Future review content generated from those very errors → Forced to produce again at the weak spot → repeat.**

Founding principle: **the learner is the data source, not the content recipient.**

Three invariant architectural principles govern every decision:

### Principle 1 — Separate "raw events" from "inferred profile"

Raw events (sentences written, errors extracted) are the **immutable source of truth**, never edited or deleted. The ability profile is **derived, reconstructable** data computed from raw events. If the profile-computation algorithm changes, we recompute from old events with zero loss.

Why: cramming everything into one state table and updating it in place loses history and makes recomputation impossible when our understanding of the data changes. This is the single most common architectural mistake to avoid.

### Principle 2 — Errors must be normalized against a fixed taxonomy

Each error carries a normalized code (`error_tag`) drawn from a fixed classification set, not a free-form label invented by the LLM. This is the precondition for counting error frequencies and for the generation layer to know which error type to target.

Why: if the LLM is allowed to name errors freely, the system accumulates hundreds of near-duplicate labels that cannot be aggregated or counted. The fixed taxonomy is the backbone of all analytical value.

### Principle 3 — The loop must close

The output the learner produces while interacting with the generation layer (e.g., the correction they write) must flow back as new raw-event input. This is the mechanism by which the data moat deepens with use over time.

---

## 6. System architecture

### 6.1 The three core layers

The system has three logical layers, with data flowing in a closed loop:

**Layer 1 — Ingestion & extraction**
Receives the learner's language production. In v1, the data source is limited to **written text** (see 6.4 for the reasoning). An LLM-based extractor analyzes the text and outputs a structured list of errors (each tagged with an `error_tag` from the fixed taxonomy) along with quantitative metrics for the text.

**Layer 2 — Event store + Inference**
- *Event store* (immutable): stores every sentence written and every error extracted. This is the source of truth.
- *Inference layer*: runs periodically over the event store to build the "ability profile" — frequency of each error type, estimated active vocabulary, syntactic-complexity trend over time. This profile is a derived, reconstructable cache.

**Layer 3 — Reverse generation**
Reads the ability profile to decide what the learner should practice next. This is the layer into which "generators" plug — each learning feature is a generator. The first generator is the **Reverse Tutor**. Other generators (e.g., reactivating old errors in new contexts) plug in later without touching the two layers below.

The output of Layer 3 (the correction the learner writes) flows back to Layer 1, closing the loop.

### 6.2 First generator: Reverse Tutor

Reverse Tutor inverts the teaching relationship: instead of the AI correcting the learner's errors, **the learner corrects errors the AI intentionally produces**. Logic flow:

1. The generation layer queries the profile: which `error_tag` is both high-frequency and **unresolved**.
2. The LLM is asked to create a set of French sentences, some of which intentionally contain that exact error type, some correct, with an internal marker of which are wrong.
3. The interface displays the sentences, **hides the answer key**, and asks the learner to play tutor: identify which are wrong, where, and fix them.
4. The LLM grades the response: did the learner correctly detect and fix the error.
5. The result is recorded. The correction the learner writes becomes a new input event.

**Cognitive-science basis:** it combines two strong learning mechanisms in one exercise — *retrieval* (error recognition) and *output* (producing the correction) — while leveraging the protégé effect (deeper learning when teaching others). Crucially, the drill targets the learner's *known* weaknesses rather than random errors.

**Honest boundary:** technically, Reverse Tutor is only clever prompt engineering and **can be copied quickly**. Its unique value lies not in the mechanism, but in (1) the cog-sci insight and (2) the fact that it plugs into the Twin to generate personally-targeted errors. The generator itself is not the moat; the data layer beneath it is.

### 6.3 Data model

Five core entities:

**USER** — the learner. Stores target level (`target_level`).

**SUBMISSION** — a unit of language production (a sentence/paragraph the learner writes). Stores source (`source` — e.g., free practice, or generated from a drill), the prompt, the content, word count, and quantitative metrics (`metrics`, JSON — e.g., average sentence length, lexical diversity).

**ERROR_EVENT** — a single error extracted from a submission. Stores:
- `category` — broad error type (grammaire / lexique / orthographe / syntaxe / registre).
- `error_tag` — **specific normalized code** from the fixed taxonomy (e.g., `subjonctif_apres_que`, `accord_participe_passe`, `faux_ami_actuellement`). This is the single most important field in the entire system — the soul of frequency-counting and error-targeting.
- `excerpt`, `correction`, `explanation` — the faulty span, the fix, the explanation.

**PROFILE** — the derived ability profile, one-to-one with the user. Stores (as JSON): per-error-type frequency (`error_frequencies`), estimated active vocabulary (`known_vocab`), complexity trend over time (`complexity_trend`), and the computation timestamp (`computed_at`). **Not a source of truth** — only a cache computed from the event store.

**DRILL** — a practice item produced by the generation layer. Stores type (`type`), content (`payload`), resolved status (`resolved`), and most importantly `source_error_id` — the foreign key linking the drill back to the exact error that produced it.

**Relationships:**
- USER 1–N SUBMISSION
- USER 1–1 PROFILE
- USER 1–N DRILL
- SUBMISSION 1–N ERROR_EVENT
- DRILL 0–1 SUBMISSION (a drill is answered by a new submission — closing the loop)
- ERROR_EVENT 0–N DRILL (one error may be targeted by multiple drills over time)

**Two data decisions worth emphasizing:**

1. `DRILL.source_error_id` + `DRILL.resolved` allow measuring "has this error been fixed" over time — i.e., measuring *real learning effectiveness*. This is both a gold learning signal and a strong portfolio metric (retention rate per error pattern).

2. `PROFILE` must never be written directly without a corresponding event in the event store. Every number in the profile must be traceable back to real `ERROR_EVENT` / `SUBMISSION` records.

### 6.4 v1 scope decisions and rationale

**Ingest only from written text in v1; voice in v2.**
Reason: the Twin needs *volume* of data points for patterns to emerge. Written text accumulates faster and is cleaner to analyze than speech. Voice requires added STT, is costlier, and is more complex to analyze. The schema is designed open to add a voice source later (`SUBMISSION.source` already anticipates this).

**Deliberately minimal stack — anti-over-engineering:**

| Component | v1 choice | Deliberately NOT used in v1, and why |
|---|---|---|
| Backend | Logic running inside the web app (TypeScript) | **No** separate Python microservice. All v1 logic is LLM calls + DB queries + simple statistics; no ML training or Python-specific libraries. A separate service adds only a failure point and a network hop. Split it off when genuinely needed (e.g., deep syntactic parsing). |
| Database | Relational PostgreSQL + JSON columns for the flexible parts (metrics, profile) | — |
| Search | Queries by `error_tag` / time / category | **No** vector database in v1. The Twin core needs no semantic search — errors are queried by code and time, not by semantic similarity. A vector DB is only needed for later generators like "comprehensible input" or RAG. |
| LLM | **Gemini free tier (v1)** — `gemini-2.5-flash` via Google AI Studio (`ai.google.dev`), no credit card. Rate limits: **10 RPM; daily quota verify at ai.google.dev** (reported 250–1,500 RPD across sources; was reduced in Dec 2025 — confirm live number before relying on it). Provider-agnostic in v2+. *Privacy: free-tier prompts may be used by Google to improve their models; acceptable here since all data is the author's own French practice, not sensitive.* | No separate Python service. All v1 logic is LLM calls + DB queries + simple statistics; no ML training needed. |

Overarching principle: **v1 must be lean enough to finish, not get bogged down.** Every "impressive-sounding" component (microservice, vector DB, multi-agent) is added only when there is a concrete need that a simpler tool cannot meet.

---

## 7. The orchestration agent layer (later phase)

This section describes an agentic layer that sits **above** the three core layers. It is documented here so the vision is recorded — but it is explicitly a **later-phase** layer with hard prerequisites (see 7.4). Building it before the core exists would be building a conductor for a one-person orchestra.

### 7.1 Pipeline vs. agent — the distinction that justifies this layer

It is important not to confuse two things:

- **What the Twin core already is: a pipeline.** The core has state — it remembers, infers, generates — but each step is orchestrated by *application code*: ingest → extract → build profile → generate drill. The LLM is invoked at each specific step with a narrow task. For most of what the Twin does, a pipeline is *correct*: it gives control, consistency, and low cost.
- **What an agent actually is.** An LLM given a **goal** (not a set of steps), a set of **tools**, and the **authority to decide which tool to call, in what order, iterating until the goal is met**. An agent earns its place only where the path to the result is *not predictable in advance* — where you cannot write the steps ahead of time because they depend on the situation.

The decisive question is: where in the Twin is the path genuinely unpredictable? Only those places deserve an agent. Everywhere else, inserting an agent only makes the system slower, costlier, harder to debug, and less consistent — in exchange for nothing.

### 7.2 Where an agent genuinely adds value: the learning orchestrator

There is exactly one role where an agent clearly outperforms a pipeline, and it happens to be the most valuable part of the whole project: the **learning-orchestrator agent**.

This is the role a good tutor actually performs — component (e), "dynamic path adjustment," from the tutor analysis. The decision *"what should this learner practice today"* is genuinely unpredictable, because it depends on: which errors are surging, which "fixed" errors have resurfaced, whether the learner is discouraged or on a roll, how long since a given skill was touched, and how far the B2 goal still is. You *cannot* pre-write an if-else tree for this — which is precisely the signal that an agent fits.

The orchestrator agent would have:
- **A goal:** "move the learner toward B2 across all skills as effectively as possible."
- **Tools:** query the profile, query error history, invoke the generators (Reverse Tutor and future ones), check the resolved status of error tags.
- **Authority to decide:** each session, it *reads the learner's state and decides* which generator to call, which `error_tag` to target, in what order — and explains its reasoning.

**Architectural placement:** this does **not** replace the three core layers. It sits **on top of** the generation layer as an orchestration layer. The generators become the agent's *tools* rather than being called directly by application code. The Twin core stays intact; the agent only converts the "orchestration" part from hard (code) to soft (LLM decides). This means adopting the agent does not require re-founding the architecture in this PRD.

### 7.3 Secondary agent fits (weaker; even later)

- **Multi-step error-extraction agent:** instead of one LLM call to extract errors, an agent could self-verify ("I tagged this `subjonctif` — re-check the rule before committing"), consult a grammar reference, then output. Higher accuracy — but higher cost and latency. Only worth it if extraction accuracy turns out to be a real bottleneck.
- **Conversational "ask anything about my progress" agent:** the learner asks "where was I weakest this week, why, and what should I do about it?" → the agent queries multiple data sources and answers. Useful, but this is a *convenience feature*, not the core value.

### 7.4 Prerequisites and risks of the agent layer

**Hard prerequisites (the agent is meaningless without these):**
- The three core layers must be working and producing a real profile.
- At least two generators must exist — an orchestrator has nothing to orchestrate when there is only one generator to choose from.

**Risks, stated plainly:**

1. **An agent is less consistent than a pipeline.** When the LLM decides, two similar sessions can produce two different decisions. For learning, which benefits from stability, this is a real drawback. Mitigate by giving the agent authority *within a frame* (choosing among existing generators), not unbounded freedom.

2. **Harder to debug and more expensive.** When the agent makes a strange decision, you must trace its reasoning chain. Each session costs multiple LLM calls instead of one. For a solo developer paying the API bill, this cost is real.

3. **Risk of diluting focus.** The agent layer is attractive precisely because it sounds advanced. Pouring effort into it before the core works risks building the showy part on a foundation that does not yet exist.

### 7.5 Portfolio framing

Done in the right order, this layer raises the project from "a learning tool" to "a self-orchestrating learning system." The framing — "an agentic learning orchestrator with tool-use over a learner-modeling layer" — is materially stronger than "an AI French app," and it is also product-correct because it digitizes exactly the tutor's path-adjustment role.

---

## 8. Boundaries, assumptions & risks

### 8.1 Existential risk: output friction

The entire moat rests on one assumption: the learner will **produce enough** (write/speak) for the system to accumulate patterns. But production is exactly what self-learners avoid most. Lightweight platforms (multiple choice, tapping) win *because* they are light; this system is *heavy* because it demands real production.

**The unique strength and the largest adoption barrier are the same thing.** For the first user (high PR motivation) this is not a problem. To scale into a product for many users, there must be a mechanism to reduce friction or increase motivation (e.g., a behavioral commitment device, gamifying errors). This document records the risk without pretending it does not exist.

### 8.2 LLM reliability limits at the B2 threshold

The LLM grades well and classifies errors well, but is **not perfectly reliable at fine CEFR-level judgments** around the B1/B2 boundary — exactly where the learner needs it most. Design consequences:

- Trustworthy part: identifying specific errors, fixing them, producing model rewrites.
- NOT trustworthy to rely on: the score number and the "has reached B2" label.
- The system gives a **conservative estimate**, not a verdict. Confirmation of reaching B2 should rely on official assessment sources (a real exam / mock exam / a native corrector), not on a number the system produces.

### 8.3 Error-taxonomy assumption

The system assumes a French error taxonomy can be defined that is broad and stable enough. The initial taxonomy will be imperfect and need refinement as real errors appear. Risk: too coarse and targeting suffers; too granular and the data fragments. This is a point to iterate on deliberately, not a one-time setup.

### 8.4 Explicitly out of scope

- Listening and reading (receptive) skills are not the v1 focus — the Twin concentrates on productive skills where it creates the most distinctive value.
- No community/social component in v1 (though this is the direction for addressing risk 8.1 later).
- No voice in v1.

---

## 9. Success criteria

Since the first user is the author, success is measured by both learning value and portfolio value:

**Learning value:**
- The system detects personal error patterns the learner does not notice themselves.
- The `resolved` rate on high-frequency `error_tag`s rises over time (evidence of real learning).
- The learner produces language more frequently than they would without the system.

**Portfolio value:**
- Demonstrates a stateful system with a memory + analytics layer, not an API wrapper.
- Can present the data moat and the architectural decisions (event/profile separation, fixed taxonomy, closed loop, agentic orchestration layer) as reasoned choices.

---

*End of foundational document. Later versions will add: the detailed error taxonomy, prompt specifications for the extractor and the Reverse Tutor, and the implementation roadmap — all out of scope here.*
