# WinBack

**Autonomous first-pass diligence for private equity deal teams.**

## The Problem

A PE deal team signs an LOI having verified only a fraction of what's in the data room. Not because they're careless, but  because the pipeline math doesn't leave room for anything else.

A mid-market data room holds 3,000–10,000 documents. Confirmatory diligence runs 4–8 weeks, split across accountants, lawyers, and consultants working in parallel, each sampling under time pressure. Deal teams reviewed 80–100 opportunities for every one they closed last year, and that ratio keeps getting worse.\* The result: teams realistically review 10–20% of a data room at the depth a real decision requires. The other 80–90% gets skimmed by a junior, or waved through on management's word.

That's where deals go wrong: not in the numbers everyone reads carefully, but in the contract clause, the board minute, or the cap table footnote nobody had time to cross-reference against the headline claim.

*\*Sutton Place Strategies, 2024 Deal Origination Benchmark Report  median pipeline-to-close rate ~24% and declining for three straight years.*

## Why It's a Problem

- **Coverage, not effort, is the bottleneck.** Deal teams aren't understaffed relative to a normal deal — they're understaffed relative to the volume of paper a real deal actually produces.
- **The gaps are structural, not random.** Legal gets prioritised by material-agreement triage; the associate backlog is where undisclosed liabilities and restrictive covenants hide. Financial diligence stress-tests EBITDA add-backs but rarely has time to reconcile every CIM representation against the underlying contracts line by line.
- **Firms know this, and are stuck on execution.** 95% of PE funds report their AI initiatives are meeting or exceeding expectations — yet 43% of their own portfolio companies have no meaningful AI deployment, and only 7% use it at enterprise scale.\* The gap isn't appetite. A generic AI assistant pointed at a 10,000-document data room doesn't produce a diligence-grade, cited output — it produces another thing to fact-check.
- **The cost shows up after close.** An overstated recurring-revenue claim or an incomplete cap table doesn't get caught in the memo — it gets caught in the first board meeting after the deal is done, when it's a lot more expensive to fix.

*\*FTI Consulting, 2026 Private Equity AI Radar.*

## Product Concept (What's Built)

WinBack automates the first pass of diligence — the read-everything, cross-reference-everything work that today gets rationed to whatever hours are left — across four layers:

1. **Extraction** — pulls a structured company profile out of fragmented source documents.
2. **Benchmarking** — computes peer comparisons deterministically, in code, from the extracted values.
3. **Portfolio Impact** — models how the target would shift the fund's existing sector concentration.
4. **Crosscheck** — surfaces contradictions between what management claims and what the underlying documents actually say, each one linked directly to its source evidence.

Every claim WinBack makes is either computed (never by the LLM) or cited back to an exact document block — never asserted on its own authority. The analyst reviews each finding and accepts, edits, or dismisses it before WinBack drafts the IC Memo. WinBack never issues a verdict; it surfaces what a human would otherwise have had to find by reading everything, and leaves the judgment call where it belongs.

## Moonshot

The version built here is one crosscheck engine on one deal, running against static fixtures. The moonshot is a single system that runs the **full lifecycle of a fund manager** — not just first-pass diligence on one deal, but every workstream a deal team and portfolio team touch today across separate tools and spreadsheets:

- Every diligence workstream (legal, tax, HR, IT — not just financial/commercial), on real uploaded data rooms, not fixtures.
- Diligence findings that don't stop at the IC memo — they flow into portfolio monitoring, so a covenant or concentration risk flagged pre-close keeps getting tracked post-close.
- A living knowledge graph across the whole portfolio, so a pattern the firm has seen before (a customer, a shareholder, a contract clause) surfaces automatically on the next deal instead of every deal starting from a blank slate.
- One system of record for a fund's entire lifecycle — sourcing, diligence, IC, close, portfolio management, exit — instead of the diligence memo living in one place and everything downstream of it living somewhere else.

## Live URL

The application is deployed live on Vercel:
**[https://winback-1.vercel.app](https://winback-1.vercel.app)**

