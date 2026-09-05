# WinBack

**Autonomous first-pass diligence for private equity deal teams.**

First-pass diligence is traditionally ~100+ hours of reading across fragmented documents to assemble a profile and identify material inconsistencies. WinBack automates this initial pass across four layers: extracting a structured profile, computing peer benchmarks, modeling portfolio concentration impact, and surfacing crosscheck contradictions directly linked to source evidence.

## Live URL

The application is deployed live on Vercel:
**[https://winback-1.vercel.app](https://winback-1.vercel.app)**

**Demo Credentials:**
- **Email:** `demo@example.com`
- **Password:** Passwordless email-link and Google sign-in supported.

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
 Gemini API          data/ fixtures        Cloud Firestore
 (server-only key)   (static docs)         (auth & persistence)
```

**Stateless Routes:** API routes remain stateless with respect to the pipeline. Firestore holds *saved results*, not *in-flight state*. If a route needs the extracted profile, the client sends it. This ensures parallelizability and durability against database outages.

**Evidence Model:** Every document is an ordered list of blocks with stable, permanent IDs (e.g., `s4-b2`). The UI resolves evidence references natively without needing secondary network requests.

**Auth + Persistence:** Handled securely via Firebase Auth (session cookies) and Firestore.

## Design Decisions and Tradeoffs

1. **LLM never does arithmetic:** Medians, percentages, deltas, concentration ratios, and corrected share counts are all computed in plain TypeScript from extracted values. The model’s job is reading and judgment, not calculation.
2. **Evidence refs are validated server-side:** Any reference produced by the LLM is verified against the actual documents server-side. A dead link or hallucinated quote is dropped or downgraded, ensuring the UI cannot render a broken citation.
3. **Procedure-not-answer prompts:** Crosscheck prompts (see `src/lib/pipeline/prompts/`) state a *procedure* ("Compare management's characterisation of revenue quality against the actual contracts"), not the answer. 
4. **No verdicts by design:** WinBack states facts, comparisons, and contradictions. It never issues verdicts (e.g., "Do not do this deal"). The analyst stays in the loop with explicit Accept/Dismiss/Edit controls.
5. **Firestore over Cloud SQL:** Sessions are self-contained JSON documents with no relational queries against them. A document-shaped database was chosen for speed, reliability, and to avoid ORM overhead.
6. **Documents are never persisted:** WinBack stores derived analysis, not the underlying confidential documents. Documents are static fixtures rehydrated on load.
7. **Provenance on every statement:** Every generated assertion carries strict provenance (cited vs. derived vs. unsourced). `assertSourced()` runs in dev to enforce this constraint.
8. **Audit trail as an append-only subcollection:** Written fire-and-forget to avoid blocking the pipeline. An availability-over-completeness tradeoff appropriate for this tier of product.
9. **`getUserId()` as the single auth surface:** Auth is completely decoupled from the rest of the application logic. If Firebase Auth had to be swapped for Clerk, it would be a 90-minute isolated change.
10. **Deterministic Knowledge Graph:** The graph is a strict projection of existing data using exact string matching. No fuzzy matching, no LLMs. This restraint prevents false edges, which are fatal in a diligence context.

## Run It Yourself

You can clone and run the application completely locally **without an API key**. 

```bash
git clone https://github.com/rochak779/Winback-1.git
cd Winback-1
pnpm i
MOCK_LLM=1 pnpm dev
```

Thanks to pre-recorded golden fixtures (`src/data/golden/`), the entire pipeline—extraction, benchmarking, crosschecks, and memo drafting—will work instantly and identically as it would with real LLM calls.

## Out of Scope

To ensure a high-quality slice of value within the 24-hour build constraints, the following were deliberately omitted:
- **Real file parsing:** No PDF/DOCX/XLSX parsing or user uploads. Documents are structured JSON/TS fixtures.
- **Other diligence workstreams:** Legal, tax, HR, and IT are rendered as disabled "Coming Soon" cards.
- **Diversification modeling:** Portfolio impact only checks sector concentration, not complex risk-contribution modeling.
- **General peer benchmarking:** Benchmarking uses exactly 3 fixed comparables and 3 metrics.
- **Multi-tenancy / org permissions:** Auth is implemented, but there is no org-level sharing or role-based RBAC.

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
| `FIREBASE_SERVICE_ACCOUNT_JSON`| Yes | Single-line JSON for Firebase Admin SDK |
| `NEXT_PUBLIC_FIREBASE_*` | Yes | Public keys for Firebase Client SDK |
