# WinBack

**First-pass diligence for private equity deal teams: read the whole data room, cross-check management's claims, and cite the evidence for every finding.**

[Live app →](https://winback-1.vercel.app)

<!-- TODO(Rochak): the live app is behind sign-in, so add a screenshot of a deal's crosscheck or analysis screen at docs/readme/screenshot.png, then uncomment the line below. -->
<!-- ![WinBack crosscheck findings linked to source documents](docs/readme/screenshot.png) -->

## The problem

A PE deal team signs a letter of intent having verified only a fraction of the data room. A mid-market data room holds 3,000 to 10,000 documents, and confirmatory diligence runs 4 to 8 weeks across accountants, lawyers and consultants who each sample under time pressure. In practice, teams review 10 to 20% of a data room at the depth a real decision needs.

That's where deals go wrong: not in the headline numbers everyone reads, but in the contract clause, board minute or cap-table footnote nobody had time to cross-check. A generic AI assistant pointed at the data room doesn't fix this. It produces another thing to fact-check.

## What it does

- **Extraction:** pulls a structured company profile out of scattered source documents.
- **Benchmarking:** compares the target with peers, calculated in code from the extracted values.
- **Portfolio impact:** shows how the deal would shift the fund's existing sector concentration.
- **Crosscheck:** surfaces contradictions between what management claims and what the documents say, each linked to its source.
- **Review, then memo:** the analyst accepts, edits or dismisses each finding before WinBack drafts the investment committee memo.
- **Audit trail:** every number shows whether it was extracted, derived or edited, and by whom.

## Key product decisions

- **The AI never does the maths.** Every number is either calculated in code or cited back to an exact passage in a document, never asserted by the model.
- **No verdicts.** WinBack surfaces what a person would otherwise have to find by reading everything. The judgement stays with the deal team.
- **Nothing reaches the memo without a human.** Each finding has to be accepted, edited or dismissed first.
- **Derived values are marked.** Medians, concentration percentages and crosscheck figures carry a marker that opens how they were calculated, so a reviewer can trace any number.

## Results & evidence

- One crosscheck engine running end to end on one deal: extraction, benchmarking, portfolio impact, crosscheck, review and memo.
- Built against prepared documents and a golden set of expected findings, not a live data room.

## Scope & limits

- **One deal, prepared documents.** It runs on static fixtures rather than uploaded data rooms.
- **Financial and commercial checks only.** Legal, tax, HR and IT diligence are not covered.
- **Not a decision tool.** It produces findings for review, not recommendations.

## Next in roadmap

- Real uploaded data rooms instead of fixtures.
- More diligence workstreams: legal, tax, HR and IT.
- Carry findings past the deal into portfolio monitoring, so a risk flagged before close keeps being tracked after it.
- A knowledge graph across the portfolio, so a customer, shareholder or clause the firm has seen before surfaces on the next deal.

<details>
<summary><strong>Tech stack</strong></summary>

Next.js (App Router), TypeScript, Tailwind CSS with shadcn/ui, Supabase (Auth, Postgres), Vitest, pnpm, deployed on Vercel.

</details>
