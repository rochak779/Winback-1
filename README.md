# WinBack

**Autonomous first-pass diligence for private equity deal teams.**

## The Problem

A PE deal team signs an LOI having verified only a fraction of what's in the data room. Not because they're careless — because the pipeline math doesn't leave room for anything else.

A mid-market data room holds 3,000–10,000 documents. Confirmatory diligence runs 4–8 weeks, split across accountants, lawyers, and consultants working in parallel, each sampling under time pressure. Deal teams reviewed 80–100 opportunities for every one they closed last year, and that ratio keeps getting worse.\* The result: teams realistically review 10–20% of a data room at the depth a real decision requires. The other 80–90% gets skimmed by a junior, or waved through on management's word.

That's where deals go wrong — not in the numbers everyone reads carefully, but in the contract clause, the board minute, or the cap table footnote nobody had time to cross-reference against the headline claim.

*\*Sutton Place Strategies, 2024 Deal Origination Benchmark Report — median pipeline-to-close rate ~24% and declining for three straight years.*

## Why It's a Problem

- **Coverage, not effort, is the bottleneck.** Deal teams aren't understaffed relative to a normal deal — they're understaffed relative to the volume of paper a real deal actually produces.
- **The gaps are structural, not random.** Legal gets prioritized by material-agreement triage; the associate backlog is where undisclosed liabilities and restrictive covenants hide. Financial diligence stress-tests EBITDA add-backs but rarely has time to reconcile every representation in the CIM against the underlying contracts line by line.
- **Firms know this, and are stuck on execution.** 95% of PE funds report their AI initiatives are meeting or exceeding expectations — yet 43% of their own portfolio companies have no meaningful AI deployment, and only 7% use it at enterprise scale.\* The gap isn't appetite. It's that a generic AI assistant pointed at a 10,000-document data room doesn't produce a diligence-grade, cited output — it produces another thing to fact-check.
- **The cost shows up after close.** An overstated recurring-revenue claim or an incomplete cap table doesn't get caught in the memo — it gets caught in the first board meeting after the deal is done, when it's a lot more expensive to fix.

*\*FTI Consulting, 2026 Private Equity AI Radar.*

## Product Concept (What's Built)

WinBack automates the first pass of diligence — the read-everything, cross-reference-everything work that today gets rationed to whatever hours are left — across four layers:

1. **Extraction** — pulls a structured company profile out of fragmented source documents.
2. **Benchmarking** — computes peer comparisons deterministically, in code, off the extracted values.
3. **Portfolio Impact** — models how the target would shift the fund's existing sector concentration.
4. **Crosscheck** — surfaces contradictions between what management claims and what the underlying documents actually say, each one linked directly to its source evidence.

Every claim WinBack makes is either computed (never by the LLM) or cited back to an exact document block — never asserted on its own authority. The analyst reviews each finding and accepts, edits, or dismisses it before WinBack drafts the IC Memo. WinBack never issues a verdict; it surfaces what a human would otherwise have had to find by reading everything, and leaves the judgment call where it belongs.

See [The Two Crosschecks](#the-two-crosschecks) below for the two contradictions this build actually finds, and [Out of Scope](#out-of-scope) for what a 24-hour build deliberately left out.

## Moonshot

The version built here is one crosscheck engine on one deal, running against static fixtures. The moonshot is a single system that runs the **full lifecycle of a fund manager** — not just first-pass diligence on one deal, but every workstream a deal team and portfolio team touch today across separate tools and spreadsheets:

- Every diligence workstream (legal, tax, HR, IT — not just financial/commercial), on real uploaded data rooms, not fixtures.
- Diligence findings that don't stop at the IC memo — they flow into portfolio monitoring, so a covenant or concentration risk flagged pre-close keeps getting tracked post-close.
- A living knowledge graph across the whole portfolio, so a pattern the firm has seen before (a customer, a shareholder, a contract clause) surfaces automatically on the next deal instead of every deal starting from a blank slate.
- One system of record for a fund's entire lifecycle — sourcing, diligence, IC, close, portfolio management, exit — instead of the diligence memo living in one place and everything downstream of it living somewhere else.

## Live URL

The application is deployed live on Vercel:
**[https://winback-1.vercel.app](https://winback-1.vercel.app)**

Sign up at `/sign-up` to create your own account (see [Authentication Setup](#authentication-setup) below).

## The Two Crosschecks

WinBack’s value lies in autonomously finding contradictions that are not immediately obvious. The platform implements two specific diligence crosschecks:

1. **Recurring Revenue Overstatement:** The management presentation claims ~80% of FY24 revenue is "recurring". However, the underlying customer contracts reveal that several major contracts—comprising roughly 28% of revenue—contain termination-for-convenience clauses with only 30 days' notice. Revenue that can be canceled on 30 days' notice is not underwriteable as recurring.
2. **Option Dilution Understatement:** The provided capitalization table is arithmetically consistent but incomplete. It silently excludes several recently board-approved option grants, causing the stated fully-diluted share count to be artificially low, and resulting in ownership percentages being overstated by a material margin.

These findings are surfaced in the Decision screen with inline citations, allowing the analyst to accept, edit, or dismiss them before WinBack drafts the IC Memo.

![Crosscheck Finding Card](./public/window.svg) *(Placeholder for screenshot of a finding card with evidence link)*

## Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│  Browser (Next.js client)                                        │
│   RunStore (React context + useReducer + localStorage mirror)    │
│   ├─ deal, docs, extraction, benchmark, portfolio, decision      │
│   └─ stageStatus                                                 │
│                                                                  │
│   Evidence drawer resolves EvidenceRef → exact document block    │
└───────────────┬───────────────────────────────────────────────────┘
                │  fetch() — plain JSON POST, no streaming
┌───────────────▼───────────────────────────────────────────────────┐
│  Next.js API routes (server, stateless)                          │
│   POST /api/extract     → ExtractionResult   (4 parallel calls)  │
│   POST /api/benchmark   → BenchmarkResult    (deterministic)     │
│   POST /api/portfolio   → PortfolioImpact    (deterministic)     │
│   POST /api/crosscheck  → DecisionResult     (2 parallel calls)  │
│   POST /api/memo        → IcMemo             (1 call)            │
│                                                                  │
│   Each route: auth → rateLimit → zod in → handler → zod out      │
└───────────────┬───────────────────────────────────────────────────┘
                │
     ┌──────────┴───────────┬─────────────────────┐
     ▼                      ▼                     ▼
 Gemini API          data/ fixtures        Supabase (Postgres)
 (server-only key)   (static docs)         (auth & persistence)
```

**Stateless Routes:** API routes remain stateless with respect to the pipeline. Supabase holds *saved results*, not *in-flight state*. If a route needs the extracted profile, the client sends it. This ensures parallelizability and durability against database outages.

**Evidence Model:** Every document is an ordered list of blocks with stable, permanent IDs (e.g., `s4-b2`). The UI resolves evidence references natively without needing secondary network requests.

**Auth + Persistence:** Handled via Supabase (Postgres + Auth) — see [Authentication Setup](#authentication-setup) below for the full flow.

## Phase 6.4 — Knowledge graph

Run `pnpm dev`, then open **[/graph?demo=1](http://localhost:3000/graph?demo=1)** for the
explicitly labelled historical preview. This change implements only ERD Part 10 / Phase 6.4.
It reuses the existing app shell, run store and shared evidence drawer; it does not implement
audit or other screens. (Authentication and Supabase persistence are covered in [Authentication Setup](#authentication-setup) above.)

- `src/lib/graph/build.ts`: pure, synchronous `buildKnowledgeGraph(sessions, docs)`.
  `GraphSession` is a structural projection of the ERD's persisted session, so a full
  `PersistedSession` can be passed without changing the frozen contracts. No I/O or LLM calls.
- Only resolvable **cited** blocks become nodes. Block IDs include the session ID; entities,
  companies and sectors share exact normalized IDs. Degree drives size; deals have a floor
  of 8 and findings 5. Contradiction edges have weight 3 and only appear for flagged findings.
- Normalization lowercases, removes punctuation, collapses whitespace/hyphens, and removes
  trailing legal forms from the exported `LEGAL_FORM_SUFFIXES`: **inc, llc, ltd, corp, co, plc**.
  **health, partners, group, holdings are retained**. No fuzzy matching, embeddings, or aliases.
- Output ordering is stable. `generatedAt` is the latest input `updatedAt` (epoch for no
  sessions), not the current clock, preserving byte-identical output for identical inputs.
- Concentration rows have no evidence refs in the frozen contract; the graph does not invent
  them. Memo-to-finding `supports` edges mean **shared cited evidence**, as their labels state;
  the contract supplies no explicit finding IDs or independently verified support relation.
- `/graph` uses the installed `d3-force`, `d3-selection`, `d3-drag`, and `d3-zoom` with SVG.
  Hover/focus highlights immediate neighbours. Click opens details; block clicks open the
  shared source drawer with the cited passage highlighted, resolved locally without a fetch.
  An optional document snapshot on the existing drawer provider keeps historical sources
  separate from the active run without creating another drawer or overwriting run state.
  Search selects and pans to matches (also revealing a hidden matching type), the legend
  filters types, and the scope switches between one session and all sessions. Shared nodes
  have an extra ring; flagged nodes/edges also use dashed outlines, not colour alone.
  Initial layout stops after 300 manual ticks; drag restarts at low alpha for at most 80 ticks.
  Cleanup stops the simulation. Tab/Enter operates nodes; focus the SVG and use arrows to
  pan, +/- to zoom. Reset view restores the fitted layout. Esc closes the drawer.

### Historical fixtures and saved-session integration

`src/data/seed-sessions.ts` supplies two **synthetic seeded historical** healthcare deals,
Alder and Cedar, adapted from the existing illustrative `mockRun` financials. Both contain
completed stage snapshots, benchmarks, portfolio impact, findings and memo sections. Their
shared customer (Blackwood Regional Health Network) and shareholder (Cascade Growth Partners)
also occur in the actual Kestrel documents. These are not newly generated or recorded live
results. Every source snapshot has namespaced block IDs, and `SEED_DOCS` is kept separate from
`TARGET_DOCS` so historical quotes never accidentally resolve to live target blocks. No docs
are stored inside the session objects. Nothing is seeded into a database by this change.

The checkout has **no Phase 6.1 auth service or Phase 6.2 saved-session reader**. Consequently:

- `GET /api/graph?demo=1&scope=all` returns only the public historical fixtures.
- `GET /api/graph?demo=1&scope=session&sessionId=historical-alder` returns one fixture.
- Requests without `demo=1` return **503** with the standard error envelope until those
  prerequisites are connected. `/graph` explains this and links to the historical preview.
  No production navigation entry is added; ERD §10.8's prerequisites remain unmet.
- `createGraphHandler(source)` in `src/lib/graph/http.ts` is the integration boundary.
  Supply the existing `getUserId()`, session read/list methods and rehydrated docs when
  those modules arrive, then wire that handler into `src/app/api/graph/route.ts` for non-demo
  requests. Do not replace it with a fixed user ID or accept an owner from the request.
  The handler rechecks ownership, gives identical 404s for missing/foreign sessions, filters
  all-scope results by owner, caps at the 10 most recent sessions, validates query/output
  with Zod, and caches all-scope graphs by authenticated user for 60 seconds. HTTP responses
  are `private, no-store`; the cache is bounded and never shared between source adapters.

Validation: `pnpm test` (projection, normalization, provenance boundaries, ownership,
cache isolation/expiry, session cap, preview separation), `pnpm typecheck`, `pnpm lint`,
and `pnpm build`. Browser check: open the preview, focus a node to isolate its neighbours,
click a block, inspect the cited highlight, close with Esc, then try search, filters and scope.


## Design Decisions and Tradeoffs

1. **LLM never does arithmetic:** Medians, percentages, deltas, concentration ratios, and corrected share counts are all computed in plain TypeScript from extracted values. The model’s job is reading and judgment, not calculation.
2. **Evidence refs are validated server-side:** Any reference produced by the LLM is verified against the actual documents server-side. A dead link or hallucinated quote is dropped or downgraded, ensuring the UI cannot render a broken citation.
3. **Procedure-not-answer prompts:** Crosscheck prompts (see `src/lib/pipeline/prompts/`) state a *procedure* ("Compare management's characterisation of revenue quality against the actual contracts"), not the answer. 
4. **No verdicts by design:** WinBack states facts, comparisons, and contradictions. It never issues verdicts (e.g., "Do not do this deal"). The analyst stays in the loop with explicit Accept/Dismiss/Edit controls.
5. **Documents are never persisted:** WinBack stores derived analysis, not the underlying confidential documents. Documents are static fixtures rehydrated on load.
6. **Provenance on every statement:** Every generated assertion carries strict provenance (cited vs. derived vs. unsourced). `assertSourced()` runs in dev to enforce this constraint.
7. **Audit trail as an append-only subcollection:** Written fire-and-forget to avoid blocking the pipeline. An availability-over-completeness tradeoff appropriate for this tier of product.
8. **`getUserId()` as the single auth surface:** Auth is completely decoupled from the rest of the application logic. If Supabase Auth had to be swapped for Clerk, it would be a 90-minute isolated change.
9. **Deterministic Knowledge Graph:** The graph is a strict projection of existing data using exact string matching. No fuzzy matching, no LLMs. This restraint prevents false edges, which are fatal in a diligence context.

## Run It Yourself

You can clone and run the application completely locally **without an API key**. 

```bash
git clone https://github.com/rochak779/Winback-1.git
cd Winback-1
pnpm i
MOCK_LLM=1 pnpm dev
```

Thanks to pre-recorded golden fixtures (`src/data/golden/`), the entire pipeline—extraction, benchmarking, crosschecks, and memo drafting—will work instantly and identically as it would with real LLM calls.

### Authentication Setup

The application requires Supabase (Postgres + Auth) for all authentication. Every route is protected; unauthenticated requests redirect to `/sign-in`.

**Environment Variables:**

Add these to your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
```

**First Run:**

When you start `pnpm dev`, the app will redirect to `/sign-in` until you create an account:

1. Go to **[http://localhost:3000/sign-up](http://localhost:3000/sign-up)** and create an account with email + password.
2. Complete the **onboarding wizard** (4 steps):
   - **Your details** — enter your full name.
   - **Company details** — create an organization (you become an `admin`).
   - **Invite teammates** — optionally generate copyable `/invite/[token]` links to share with others.
   - **Upload documents** — optionally name companies to track (stub only; extraction wiring is future work).
3. Redirect to `/` (Plan screen) as an authenticated user.

**Auth Flows:**

- **Sign up:** Email + password → user profile → onboarding wizard.
- **Sign in:** `/sign-in` for returning users.
- **Forgot password:** Email link → `/reset-password`.
- **Invites:** `/invite/[token]` — admins generate links, teammates accept to join the org.

**Permissions:**

Two roles, enforced via Postgres row-level security:
- **Admin:** Can invite users, edit org details, and manage company list.
- **Member:** View-only.

For the complete design, architecture, and data model, see [`docs/superpowers/specs/2026-09-05-auth-onboarding-foundation-design.md`](./docs/superpowers/specs/2026-09-05-auth-onboarding-foundation-design.md).

## Out of Scope

To ensure a high-quality slice of value within the 24-hour build constraints, the following were deliberately omitted:
- **Real file parsing:** No PDF/DOCX/XLSX parsing or user uploads. Documents are structured JSON/TS fixtures.
- **Other diligence workstreams:** Legal, tax, HR, and IT are rendered as disabled "Coming Soon" cards.
- **Diversification modeling:** Portfolio impact only checks sector concentration, not complex risk-contribution modeling.
- **General peer benchmarking:** Benchmarking uses exactly 3 fixed comparables and 3 metrics.

## Repo Map & Env Vars

- `src/app/` — Next.js App Router (UI routes and API endpoints).
- `src/components/` — UI components (shadcn/ui + bespoke analysis components).
- `src/lib/pipeline/` — Gemini client, extraction, benchmark, portfolio, crosscheck, and memo logic.
- `src/lib/contracts/` — The central Zod schemas and TypeScript types.
- `src/data/` — Static data fixtures (target docs, peers, portfolio, golden fixtures).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | API Key for Google Gemini |
| `MOCK_LLM` | No | Set to `1` to run without API key using local golden fixtures |
| `RUN_BUDGET_MAX` | No | Global rate limit on LLM calls (default `500`) |
| `GOOGLE_CLOUD_PROJECT` | Yes | GCP Project ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service-role secret key (server-only) |
