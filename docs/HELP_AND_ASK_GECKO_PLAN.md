# Help and Ask Gecko — the plan

**Draft, 2026-10-15. Nothing built.** Written for the owner and for whoever
takes the API side.

Decisions already taken (owner, 2026-10-15):

| Question | Answer |
|---|---|
| Who is the help for | Every role — gate clerk through tenant admin |
| Where retrieval runs | A new **Gecko.AI** service in the platform |
| Sequencing | **Corpus first, RAG second** |

---

## 1. What already exists

Worth knowing before anything is written, because two thirds of this is
already in the repository.

| Asset | Where | State |
|---|---|---|
| Ask Gecko widget | `src/components/ai/AskGeckoWidget.tsx` (365 lines) | Built, hidden — answers from mock data |
| Intent matching | `src/lib/ask-gecko-intents.ts` (500 lines) | Deterministic keyword/regex intents, **real navigation links** |
| Engineering docs | `docs/*.md`, repo root `*.md` — 47 files | Written for developers and the API owner, **not shippable as help** |
| Inline doc-comments | Every component and lib in the codebase | The richest source of help content that exists; explains *why* in operational terms |
| Refusal wording | `WALK_IN_REFUSALS`, gate findings, API ProblemDetails | Already good; help must not duplicate or contradict it |

There is **no `Gecko.AI` project** in the platform. The Phase-2 note in
`ask-gecko-intents.ts` ("swap `dispatchAskGecko()` for a call to
`Gecko.AI.Service.AskGecko`") was aspirational.

The widget also has **no screen context** — no `usePathname`, no depot, no role.

---

## 2. The shape: one widget, two brains

The single most expensive mistake available here is letting a language model
answer **data** questions. Roughly half of what users ask is not knowledge:

- *"Where is MSKU8112301?"* — that is `GET /api/tos/containers/{no}`.
- *"How do I split a receipt?"* — that is a document.

So the widget routes before it answers:

```
          question + screen + role + depot
                        │
            ┌───────────┴───────────┐
       DATA │                       │ KNOWLEDGE
            ▼                       ▼
   ask-gecko-intents.ts        Gecko.AI  /ai/ask
   → a real Gecko.Api call     → permission-filtered retrieval
   → real answer + deep link   → grounded answer + citations
   (cannot hallucinate)        (only from cited sources)
                        │
                   neither matched
                        ▼
            "I don't know" + search + Report a problem
```

The existing 500-line intent file is **not thrown away** — it becomes the first
branch, and it already returns real links.

### Grounding rules, non-negotiable

Gecko is a live TOS. If an answer says *"click Void on the receipt"* and that
button does not exist, a clerk at the barrier **with a truck waiting will act on
it**. Therefore:

1. Answers come **only** from retrieved chunks. No model world-knowledge.
2. Every answer **cites** the page it came from, and the page is one click away.
3. **"I don't know"** is a first-class answer, not a failure. Low retrieval
   score ⇒ say so and offer search + escalation.
4. Never invent a menu path, a button label or a permission name.

---

## 3. What "all user types" forces

### 3.1 Retrieval must be permission-scoped

A gate clerk asking *"how do I approve a tariff?"* must not get a confident
walkthrough of a screen that answers 403.

Every chunk carries the permissions it assumes. Retrieval filters on the
asker's actual permissions — the ones already in the token (`prm`, and `bpm`
for branch-scoped). When nothing survives the filter, the answer becomes:

> That is done by Accounts, not at the gate. Ask your supervisor.

Cheap to design in now, expensive to retrofit. **This is the main reason the
corpus needs tagging from the first page written, not later.**

### 3.2 The widget needs context

`usePathname()` plus the depot and the role, sent with every question. *"How do
I do this?"* asked on `/gate/eir-in` should bias retrieval to gate-in. Without
it, the commonest question a clerk asks is unanswerable.

### 3.3 Thai

Clerks will ask in Thai. **Most default embedding models are English-first.**
The multilingual model has to be chosen *before* indexing — changing it later
means re-embedding everything. The UI already offers EN/ไทย; the corpus should
be authored in English first with Thai added per page, and the embedding model
must handle both in one index.

---

## 4. The corpus

### 4.1 What gets written

Only the first needs writing from nothing.

1. **Task pages** — the real jobs, one page each. First fifteen:
   - Gate in a booked box · Gate in a walk-in truck · Pick up from the yard
   - Gate out a booked box · Correct an EIR after Save · Void an EIR
   - Take cash at the window · Split a receipt / change payer · Void and reissue a receipt
   - Raise a booking · Assign boxes to a booking
   - Price a move (tariff) · Start a new tariff version
   - Register a container · Correct a container number
2. **Vector → Gecko concordance** — *"I used to do this in Vector; where is it?"*
   The dominant question class today and the one with the shortest shelf life.
   Partly derivable from `GATE_IN_VECTOR_PARITY_FOR_API.md` and
   `BOOKING_VECTOR_PARITY_FOR_API.md`, but **the owner is the authority here** —
   I can draft, he must correct.
3. **Field glossary** — largely derivable from the inline doc-comments.
4. **Refusal catalogue** — `BOX_RESERVED`, `ON_AN_ORDER`, `SURVEY_REQUIRED`,
   `GRADE_NOT_ALLOWED`, `LOAD_MISMATCH`, `SEAL_NOT_AS_BOOKED`… already
   semi-structured in code. Each: what it means, what to do.

### 4.2 Where it lives, and the artifact

Retrieval runs in the platform, but the pages are *about the screens* and
belong beside them. So:

- **Authored** in `web.tos.gecko-api` as Markdown with front-matter.
- **Rendered** at `/help` by the UI.
- **Emitted at build time** as a single machine-readable artifact that
  Gecko.AI ingests. This is the interface between the two repositories.

```jsonc
// help-index.json — emitted by the web build, ingested by Gecko.AI
{
  "version": "2026-10-15T09:00:00Z",   // the build that produced it
  "pages": [
    {
      "id": "gate/walk-in",
      "title": "Gate in a truck with no booking",
      "route": "/help/gate/walk-in",     // where a citation links to
      "screens": ["/gate/eir-in"],       // for screen-context boosting
      "permissions": ["tos.gate.create"],// retrieval filter
      "roles": ["GATE_CLERK", "OPS_MANAGER"],
      "lang": "en",
      "updatedAt": "2026-10-15",
      "chunks": [
        { "heading": "What a walk-in is", "text": "…" },
        { "heading": "Drop off or pick up", "text": "…" }
      ]
    }
  ]
}
```

Published at a URL the API can read, or committed to the platform as a build
artifact — the owner's call. The point is that **the index can never be newer
or older than the UI it describes**, because it is produced by the same build.

### 4.3 Tooling decision (web side)

This project is deliberately lean: **5 runtime dependencies, 9 dev**. No
markdown, MDX or search tooling today.

| Option | Cost | Notes |
|---|---|---|
| **A. Markdown in `.ts` modules** | **No new dependency** | Content as tagged template strings with a typed front-matter object; a ~100-line renderer for headings, lists, links, tables. Keeps the dependency count where it is. Authoring is slightly less pleasant. |
| **B. MDX** (`@next/mdx`, `gray-matter`) | 3–4 dependencies + next.config change | Nicer authoring, React components inside pages, standard tooling. |

**Recommendation: A for Phase 0.** The content is prose, tables and links —
nothing needs React inside it. If the corpus grows past ~40 pages and authors
other than us start writing it, revisit B.

Search in Phase 0: **client-side over the same index**, no vendor, works at a
gate lane on a bad connection.

---

## 5. Phases

### Phase 0 — corpus and `/help` (no AI, no services, no spend)

- `/help` route: index, category pages, page view, client-side search.
- The first fifteen task pages + the concordance + the refusal catalogue.
- Front-matter carries `permissions`, `roles`, `screens` from the first page.
- Build step emits `help-index.json`.
- **Help** in the account menu stops being disabled and opens `/help`.
- Ask Gecko re-enabled against **real** pages — its deterministic intents only,
  no model yet. It stops answering from mock data.
- Widget gains screen, role and depot context.

Deliverable: help that works, and the artifact the API will need.

### Phase 1 — Gecko.AI retrieval

Needs the API owner. Spec in §6.

### Phase 2 — escalation

**Report a problem** in the account menu: captures the screen, user, role,
depot, branch and the last API error, and raises a ticket. That context is
worth more than a chat transcript. Deliberately *not* a third-party support
chatbot — it would not know Gecko and would invent menu paths.

---

## 6. For the API owner — `Gecko.AI`

> **Prompt for the API:** a new `Gecko.AI` service with one read endpoint, plus
> an ingest path for the corpus.

### 6.1 Ask

`POST /api/ai/ask` — `RequireAuthorization()`; no new permission, every signed-in
user may ask. Rate-limited per user.

```json
{
  "question": "How do I gate in a truck with no booking?",
  "screen": "/gate/eir-in",
  "branchId": "…",
  "language": "en"
}
```

**200**

```json
{
  "answer": "A truck with no paperwork is a walk-in…",
  "confidence": "HIGH",
  "citations": [
    { "pageId": "gate/walk-in", "title": "Gate in a truck with no booking", "route": "/help/gate/walk-in" }
  ],
  "suggested": ["What is a walk-in order type?", "Why was my walk-in refused?"]
}
```

- **Retrieval is filtered by the caller's own permissions**, read from their
  token — never from anything the client sends. A chunk whose `permissions` the
  caller does not hold is not retrievable, and the answer says who does it
  instead.
- `screen` boosts but never filters: a clerk may ask about another screen.
- **Grounded only.** When nothing clears the score threshold, answer
  `confidence: "NONE"` with no prose, and let the UI offer search and
  escalation. Do not let the model fill the gap.
- `language`: answer in the language asked, from the same index.
- Every request/response/cost logged for audit — the original Phase-2 note
  called for a confidence chip and an audit log, and both are right.

### 6.2 Ingest

`POST /api/ai/corpus` — `mdm.commercial.manage` or a new `ai.corpus.manage`.
Takes the `help-index.json` of §4.2, embeds and replaces the index as a set
(same replace-as-set discipline as the tariff rates). Returns the page and chunk
counts so a deploy can assert them.

### 6.3 Two choices worth making once

- **Embedding model must be multilingual** (English + Thai in one index).
  Changing it later means re-embedding everything.
- **Vector store.** From the Vercel marketplace: Upstash Vector (serverless,
  cheapest to start), Supabase/pgvector (if a Postgres is wanted anyway), Redis,
  AWS S3 Vectors. If Gecko.AI runs in the platform against Azure SQL, note that
  **SQL Server 2025 has native vector support** — worth checking before adding a
  fourth datastore to the estate.

---

## 7. What not to do

- **No CMS.** Content ships with the build; help that drifts from the product
  is worse than none.
- **No third-party support chatbot.** AssistLoop and Chatbase are on the
  marketplace; neither knows Gecko and both would invent menu paths.
- **Do not start with the vector store.** Writing is the bottleneck. Retrieval
  over a thin corpus is a confident assistant with nothing true to say.
- **Do not index the engineering docs as-is.** `docs/*.md` is written for the
  API owner, not for a gate clerk. Mining them for content is right; shipping
  them is not.

---

## 8. Open questions

1. **Who writes the content?** I can draft all of it from the inline
   doc-comments and the parity docs, but the **Vector concordance needs the
   owner** — he built Vector and knows what the clerks called each screen.
2. **Thai translation** — per page, by whom, and when? The index supports it
   from day one; the content does not exist.
3. **Where the artifact is published** so Gecko.AI can read it (§4.2).
4. **Does the token carry enough?** Retrieval filters on permissions, which are
   in the token. Nothing more is needed for Phase 1 — but if help should ever
   say *"ask Somchai in Accounts"*, `/auth/me` needs names.

---

Do not change anything in `D:\SHARMA\PROJECT\gecko\platform`; report API
problems back to the owner.
