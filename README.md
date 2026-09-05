This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Phase 6.4 — Knowledge graph

Run `pnpm dev`, then open **[/graph?demo=1](http://localhost:3000/graph?demo=1)** for the
explicitly labelled historical preview. This change implements only ERD Part 10 / Phase 6.4.
It does not implement authentication, Firestore persistence, the run store, audit, or other screens.

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
  source drawer with the cited passage highlighted, resolved locally without a fetch.
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

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
