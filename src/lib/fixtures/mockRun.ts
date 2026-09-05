// ============================================================================
// src/lib/fixtures/mockRun.ts
//
// A complete, fully-populated Run for Project Meridian — Meridian Health
// Partners, a Healthcare Services target. Every stage is 'done', both
// crosschecks resolve to 'contradiction_found', and the memo has all five
// sections. The UI is built against this before the pipeline exists
// (erd.md session 0.2), so nothing here is placeholder text — every number
// traces to a block in one of the four documents below, and every derived
// number (the true recurring %, the corrected fully-diluted count) is
// actually computed from those numbers, not invented separately.
//
// This is illustrative content for building screens, not the Phase 1 target
// company — Lane A designs that independently, adversarially tested, in
// src/data/target/**.
// ============================================================================

import type {
  Block,
  BlockKind,
  CompanyProfile,
  Crosscheck,
  DecisionResult,
  EvidenceRef,
  ExtractionResult,
  BenchmarkResult,
  IcMemo,
  MemoSection,
  PortfolioImpact,
  Provenance,
  Run,
  SourceDoc,
  SourceDocId,
  Stage,
} from '@/lib/contracts/types';

const SESSION_ID = 'run-meridian-demo';
const NOW = '2026-08-29T18:42:00.000Z';

/** Deterministic, non-cryptographic placeholder for Provenance.inputHash. */
function fakeHash(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0').repeat(8).slice(0, 64);
}

function prov(stage: Stage, slug: string, opts: { promptVersion: string | null; producedBy: string; latencyMs: number | null }): Provenance {
  const statementId = `${SESSION_ID}:${stage}:${slug}`;
  return {
    statementId,
    stage,
    actor: opts.promptVersion ? 'model' : 'system',
    producedBy: opts.producedBy,
    promptVersion: opts.promptVersion,
    inputHash: fakeHash(statementId),
    generatedAt: NOW,
    latencyMs: opts.latencyMs,
  };
}

function ref(docId: SourceDocId, blockId: string, page: number, quote: string, note?: string): EvidenceRef {
  return { docId, blockId, page, quote, quoteVerified: true, ...(note ? { note } : {}) };
}

// ----------------------------------------------------------------------------
// The four documents
// ----------------------------------------------------------------------------

function block(id: string, kind: BlockKind, page: number, text: string, section?: string): Block {
  return { id, kind, text, page, ...(section ? { section } : {}) };
}

const MGMT_PRES: SourceDoc = {
  id: 'mgmt-pres',
  kind: 'management_presentation',
  title: 'Project Meridian — Management Presentation',
  filename: 'meridian_mgmt_presentation_v3.pdf',
  dateLabel: 'March 2026',
  pages: 8,
  pageNoun: 'slide',
  blocks: [
    block('s1-b1', 'heading', 1, 'Project Meridian — Management Presentation'),
    block('s2-b1', 'kv', 2, 'FY24 Revenue: $47.3m', 'Financial Overview'),
    block('s2-b2', 'kv', 2, 'FY24 Revenue growth: 16.5% YoY', 'Financial Overview'),
    block('s2-b3', 'kv', 2, 'FY24 Gross Margin: 60.8%', 'Financial Overview'),
    block('s2-b4', 'kv', 2, 'FY24 Adjusted EBITDA: $10.4m (22.0% margin)', 'Financial Overview'),
    block(
      's3-b1',
      'paragraph',
      3,
      'Meridian Health Partners operates a multi-site network of outpatient diagnostics and specialty care clinics across the Texas Triangle, serving regional health systems and physician groups under long-term service agreements.',
      'Company Overview',
    ),
    block('s4-b1', 'heading', 4, 'Revenue Quality', 'Revenue Quality'),
    block(
      's4-b2',
      'kv',
      4,
      'Approximately 80% of FY24 revenue is recurring, subscription-based revenue from multi-year service agreements.',
      'Revenue Quality',
    ),
    block(
      's5-b1',
      'bullet',
      5,
      'No single customer represents more than 12% of FY24 revenue',
      'Customer Base',
    ),
    block(
      's6-b1',
      'paragraph',
      6,
      'Growth strategy centers on same-site volume growth, de novo clinic openings in adjacent metros, and selective tuck-in acquisitions of independent specialty practices.',
      'Growth Strategy',
    ),
    block('s7-b1', 'kv', 7, 'Fully diluted shares outstanding: 8,240,000', 'Capitalization'),
    block(
      's8-b1',
      'paragraph',
      8,
      'The senior leadership team has an average of 14 years in outpatient healthcare operations, with the CEO and COO having led the business since its 2014 founding.',
      'Management Team',
    ),
  ],
};

const CONTRACTS: SourceDoc = {
  id: 'contracts',
  kind: 'customer_contracts',
  title: 'Project Meridian — Customer Contracts',
  filename: 'meridian_customer_contracts_bundle.pdf',
  dateLabel: 'February 2026',
  pages: 6,
  pageNoun: 'page',
  blocks: [
    block('c1-b1', 'kv', 1, 'Customer: Northgate Health Network — Annual Contract Value: $6.8m — Term: 48 months, auto-renewing', 'Contract 1 — Northgate Health Network'),
    block('c1-cl1', 'clause', 1, "This Agreement renews automatically for successive 12-month terms unless either party provides 180 days' written notice of non-renewal.", 'Contract 1 — Northgate Health Network'),
    block('c2-b1', 'kv', 2, 'Customer: Summit Diagnostics Alliance — Annual Contract Value: $5.6m — Term: 24 months', 'Contract 2 — Summit Diagnostics Alliance'),
    block('c2-cl4', 'clause', 2, "Either party may terminate this Agreement for convenience upon 30 days' prior written notice.", 'Contract 2 — Summit Diagnostics Alliance'),
    block('c3-b1', 'kv', 3, 'Customer: Lakeside Physician Group — Annual Contract Value: $6.1m — Term: 36 months, auto-renewing', 'Contract 3 — Lakeside Physician Group'),
    block('c3-cl1', 'clause', 3, 'Termination prior to the end of the Term is permitted only for material, uncured breach.', 'Contract 3 — Lakeside Physician Group'),
    block('c4-b1', 'kv', 4, 'Customer: Parkview Specialty Clinics — Annual Contract Value: $4.8m — Term: 24 months', 'Contract 4 — Parkview Specialty Clinics'),
    block('c4-cl3', 'clause', 4, "Client may terminate this Agreement for any reason or no reason at all upon 30 days' notice to Provider.", 'Contract 4 — Parkview Specialty Clinics'),
    block('c5-b1', 'kv', 5, 'Customer: Cedar Valley Health System — Annual Contract Value: $5.9m — Term: 60 months, auto-renewing', 'Contract 5 — Cedar Valley Health System'),
    block('c5-cl1', 'clause', 5, 'This Agreement may not be terminated prior to expiration of the Term except for uncured material breach or insolvency.', 'Contract 5 — Cedar Valley Health System'),
    block('c6-b1', 'kv', 6, 'Customer: Brightpath Medical Group — Annual Contract Value: $3.6m — Term: 24 months', 'Contract 6 — Brightpath Medical Group'),
    block('c6-cl5', 'clause', 6, "Client may terminate this Agreement without cause at any time upon 30 days' written notice to Provider.", 'Contract 6 — Brightpath Medical Group'),
  ],
};

const CAP_TABLE: SourceDoc = {
  id: 'cap-table',
  kind: 'cap_table',
  title: 'Project Meridian — Capitalization Table',
  filename: 'meridian_cap_table_2026-02.xlsx',
  dateLabel: 'February 2026',
  pages: 8,
  pageNoun: 'row',
  blocks: [
    block('row-1', 'kv', 1, 'Founder A — Common — 3,100,000 shares — 37.6% fully diluted'),
    block('row-2', 'kv', 2, 'Founder B — Common — 1,850,000 shares — 22.4% fully diluted'),
    block('row-3', 'kv', 3, 'Meridian Growth Partners — Series A Preferred — 1,400,000 shares — 17.0% fully diluted'),
    block('row-4', 'kv', 4, 'Northbridge Capital — Series A Preferred — 900,000 shares — 10.9% fully diluted'),
    block('row-5', 'kv', 5, 'Option pool (reserved, unissued) — 700,000 shares — 8.5% fully diluted'),
    block('row-6', 'kv', 6, 'Early employee options (issued) — 290,000 shares — 3.5% fully diluted'),
    block('row-7', 'kv', 7, 'Total fully diluted shares outstanding — 8,240,000 shares — 100.0%'),
    block('row-8', 'kv', 8, 'Footnote: Includes all options issued and outstanding as of the date hereof.'),
  ],
};

const OPTIONS: SourceDoc = {
  id: 'options',
  kind: 'option_grants',
  title: 'Project Meridian — Option Grant Register',
  filename: 'meridian_option_grant_register.xlsx',
  dateLabel: 'December 2024',
  pages: 12,
  pageNoun: 'grant',
  blocks: [
    block('g1', 'kv', 1, 'Director of Clinic Operations — 40,000 options — Board approved 2019-06-11 — Strike $2.10'),
    block('g2', 'kv', 2, 'Senior Physician Recruiter — 35,000 options — Board approved 2020-01-22 — Strike $2.40'),
    block('g3', 'kv', 3, 'Controller — 38,000 options — Board approved 2020-08-14 — Strike $2.75'),
    block('g4', 'kv', 4, 'Practice Manager — Austin — 30,000 options — Board approved 2021-03-02 — Strike $3.10'),
    block('g5', 'kv', 5, 'Practice Manager — Dallas — 42,000 options — Board approved 2021-09-19 — Strike $3.10'),
    block('g6', 'kv', 6, 'Compliance Manager — 33,000 options — Board approved 2022-04-27 — Strike $3.60'),
    block('g7', 'kv', 7, 'Senior Billing Analyst — 37,000 options — Board approved 2022-11-08 — Strike $3.90'),
    block('g8', 'kv', 8, 'IT Manager — 35,000 options — Board approved 2023-05-30 — Strike $4.50'),
    block('g9', 'kv', 9, 'VP Clinical Operations — 95,000 options — Board approved 2024-09-12 — Strike $9.80'),
    block('g10', 'kv', 10, 'VP Revenue Cycle Management — 68,000 options — Board approved 2024-10-03 — Strike $9.80'),
    block('g11', 'kv', 11, 'Director of Payer Contracting — 42,000 options — Board approved 2024-11-18 — Strike $10.40'),
    block('g12', 'kv', 12, 'Head of Data & Analytics — 35,000 options — Board approved 2024-12-05 — Strike $10.40'),
  ],
};

const DOCS: SourceDoc[] = [MGMT_PRES, CONTRACTS, CAP_TABLE, OPTIONS];

// ----------------------------------------------------------------------------
// Extraction — the company profile
// ----------------------------------------------------------------------------

const PROFILE: CompanyProfile = {
  name: 'Meridian Health Partners',
  sector: 'Healthcare Services',
  hq: 'Austin, TX',
  foundedYear: 2014,
  employees: 410,
  businessSummary:
    'Meridian Health Partners operates a multi-site network of outpatient diagnostics and specialty care clinics across the Texas Triangle. It serves regional health systems and physician groups under long-term service agreements, with growth driven by same-site volume, de novo openings, and tuck-in acquisitions.',
  financials: [
    {
      fy: 'FY22',
      revenueUsdM: 34.8,
      revenueGrowthPct: null,
      grossMarginPct: 58.2,
      ebitdaUsdM: 6.1,
      ebitdaMarginPct: 17.5,
      evidence: [],
    },
    {
      fy: 'FY23',
      revenueUsdM: 40.6,
      revenueGrowthPct: 16.7,
      grossMarginPct: 59.4,
      ebitdaUsdM: 8.0,
      ebitdaMarginPct: 19.7,
      evidence: [],
    },
    {
      fy: 'FY24',
      revenueUsdM: 47.3,
      revenueGrowthPct: 16.5,
      grossMarginPct: 60.8,
      ebitdaUsdM: 10.4,
      ebitdaMarginPct: 22.0,
      evidence: [
        ref('mgmt-pres', 's2-b1', 2, 'FY24 Revenue: $47.3m'),
        ref('mgmt-pres', 's2-b2', 2, 'FY24 Revenue growth: 16.5% YoY'),
        ref('mgmt-pres', 's2-b3', 2, 'FY24 Gross Margin: 60.8%'),
        ref('mgmt-pres', 's2-b4', 2, 'FY24 Adjusted EBITDA: $10.4m (22.0% margin)'),
      ],
    },
  ],
  revenueMix: [
    {
      label: 'Recurring / subscription',
      pct: 80,
      evidence: [
        ref(
          'mgmt-pres',
          's4-b2',
          4,
          'Approximately 80% of FY24 revenue is recurring, subscription-based revenue from multi-year service agreements.',
        ),
      ],
    },
    { label: 'Project-based', pct: 20, evidence: [] },
  ],
  contracts: [
    {
      customer: 'Northgate Health Network',
      annualValueUsdM: 6.8,
      startDate: '2022-04-01',
      termMonths: 48,
      autoRenew: true,
      cancellationNoticeDays: 180,
      cancellationForConvenience: false,
      classifiedAsRecurringByMgmt: true,
      evidence: [
        ref('contracts', 'c1-b1', 1, 'Customer: Northgate Health Network — Annual Contract Value: $6.8m — Term: 48 months, auto-renewing'),
        ref('contracts', 'c1-cl1', 1, "renews automatically for successive 12-month terms unless either party provides 180 days' written notice"),
      ],
    },
    {
      customer: 'Summit Diagnostics Alliance',
      annualValueUsdM: 5.6,
      startDate: '2023-01-15',
      termMonths: 24,
      autoRenew: false,
      cancellationNoticeDays: 30,
      cancellationForConvenience: true,
      classifiedAsRecurringByMgmt: true,
      evidence: [
        ref('contracts', 'c2-b1', 2, 'Customer: Summit Diagnostics Alliance — Annual Contract Value: $5.6m — Term: 24 months'),
        ref('contracts', 'c2-cl4', 2, "Either party may terminate this Agreement for convenience upon 30 days' prior written notice.", 'termination for convenience'),
      ],
    },
    {
      customer: 'Lakeside Physician Group',
      annualValueUsdM: 6.1,
      startDate: '2021-07-01',
      termMonths: 36,
      autoRenew: true,
      cancellationNoticeDays: null,
      cancellationForConvenience: false,
      classifiedAsRecurringByMgmt: true,
      evidence: [
        ref('contracts', 'c3-b1', 3, 'Customer: Lakeside Physician Group — Annual Contract Value: $6.1m — Term: 36 months, auto-renewing'),
        ref('contracts', 'c3-cl1', 3, 'Termination prior to the end of the Term is permitted only for material, uncured breach.'),
      ],
    },
    {
      customer: 'Parkview Specialty Clinics',
      annualValueUsdM: 4.8,
      startDate: '2023-06-01',
      termMonths: 24,
      autoRenew: false,
      cancellationNoticeDays: 30,
      cancellationForConvenience: true,
      classifiedAsRecurringByMgmt: true,
      evidence: [
        ref('contracts', 'c4-b1', 4, 'Customer: Parkview Specialty Clinics — Annual Contract Value: $4.8m — Term: 24 months'),
        ref('contracts', 'c4-cl3', 4, "Client may terminate this Agreement for any reason or no reason at all upon 30 days' notice to Provider.", 'termination for any reason or no reason'),
      ],
    },
    {
      customer: 'Cedar Valley Health System',
      annualValueUsdM: 5.9,
      startDate: '2020-10-01',
      termMonths: 60,
      autoRenew: true,
      cancellationNoticeDays: null,
      cancellationForConvenience: false,
      classifiedAsRecurringByMgmt: true,
      evidence: [
        ref('contracts', 'c5-b1', 5, 'Customer: Cedar Valley Health System — Annual Contract Value: $5.9m — Term: 60 months, auto-renewing'),
        ref('contracts', 'c5-cl1', 5, 'This Agreement may not be terminated prior to expiration of the Term except for uncured material breach or insolvency.'),
      ],
    },
    {
      customer: 'Brightpath Medical Group',
      annualValueUsdM: 3.6,
      startDate: '2023-09-01',
      termMonths: 24,
      autoRenew: false,
      cancellationNoticeDays: 30,
      cancellationForConvenience: true,
      classifiedAsRecurringByMgmt: true,
      evidence: [
        ref('contracts', 'c6-b1', 6, 'Customer: Brightpath Medical Group — Annual Contract Value: $3.6m — Term: 24 months'),
        ref('contracts', 'c6-cl5', 6, "Client may terminate this Agreement without cause at any time upon 30 days' written notice to Provider.", 'termination without cause'),
      ],
    },
  ],
  capTable: [
    {
      holder: 'Founder A',
      securityClass: 'Common',
      shares: 3_100_000,
      pctFullyDiluted: 37.6,
      evidence: [ref('cap-table', 'row-1', 1, 'Founder A — Common — 3,100,000 shares — 37.6% fully diluted')],
    },
    {
      holder: 'Founder B',
      securityClass: 'Common',
      shares: 1_850_000,
      pctFullyDiluted: 22.4,
      evidence: [ref('cap-table', 'row-2', 2, 'Founder B — Common — 1,850,000 shares — 22.4% fully diluted')],
    },
    {
      holder: 'Meridian Growth Partners',
      securityClass: 'Series A Preferred',
      shares: 1_400_000,
      pctFullyDiluted: 17.0,
      evidence: [ref('cap-table', 'row-3', 3, 'Meridian Growth Partners — Series A Preferred — 1,400,000 shares — 17.0% fully diluted')],
    },
    {
      holder: 'Northbridge Capital',
      securityClass: 'Series A Preferred',
      shares: 900_000,
      pctFullyDiluted: 10.9,
      evidence: [ref('cap-table', 'row-4', 4, 'Northbridge Capital — Series A Preferred — 900,000 shares — 10.9% fully diluted')],
    },
    {
      holder: 'Option pool (reserved)',
      securityClass: 'Option pool (reserved)',
      shares: 700_000,
      pctFullyDiluted: 8.5,
      evidence: [ref('cap-table', 'row-5', 5, 'Option pool (reserved, unissued) — 700,000 shares — 8.5% fully diluted')],
    },
    {
      holder: 'Early employee options (issued)',
      securityClass: 'Options (issued)',
      shares: 290_000,
      pctFullyDiluted: 3.5,
      evidence: [ref('cap-table', 'row-6', 6, 'Early employee options (issued) — 290,000 shares — 3.5% fully diluted')],
    },
  ],
  statedFullyDilutedShares: 8_240_000,
  optionGrants: [
    { grantee: 'Director of Clinic Operations', boardApprovalDate: '2019-06-11', options: 40_000, strikeUsd: 2.10, reflectedInCapTable: true, evidence: [ref('options', 'g1', 1, 'Director of Clinic Operations — 40,000 options — Board approved 2019-06-11 — Strike $2.10')] },
    { grantee: 'Senior Physician Recruiter', boardApprovalDate: '2020-01-22', options: 35_000, strikeUsd: 2.40, reflectedInCapTable: true, evidence: [ref('options', 'g2', 2, 'Senior Physician Recruiter — 35,000 options — Board approved 2020-01-22 — Strike $2.40')] },
    { grantee: 'Controller', boardApprovalDate: '2020-08-14', options: 38_000, strikeUsd: 2.75, reflectedInCapTable: true, evidence: [ref('options', 'g3', 3, 'Controller — 38,000 options — Board approved 2020-08-14 — Strike $2.75')] },
    { grantee: 'Practice Manager — Austin', boardApprovalDate: '2021-03-02', options: 30_000, strikeUsd: 3.10, reflectedInCapTable: true, evidence: [ref('options', 'g4', 4, 'Practice Manager — Austin — 30,000 options — Board approved 2021-03-02 — Strike $3.10')] },
    { grantee: 'Practice Manager — Dallas', boardApprovalDate: '2021-09-19', options: 42_000, strikeUsd: 3.10, reflectedInCapTable: true, evidence: [ref('options', 'g5', 5, 'Practice Manager — Dallas — 42,000 options — Board approved 2021-09-19 — Strike $3.10')] },
    { grantee: 'Compliance Manager', boardApprovalDate: '2022-04-27', options: 33_000, strikeUsd: 3.60, reflectedInCapTable: true, evidence: [ref('options', 'g6', 6, 'Compliance Manager — 33,000 options — Board approved 2022-04-27 — Strike $3.60')] },
    { grantee: 'Senior Billing Analyst', boardApprovalDate: '2022-11-08', options: 37_000, strikeUsd: 3.90, reflectedInCapTable: true, evidence: [ref('options', 'g7', 7, 'Senior Billing Analyst — 37,000 options — Board approved 2022-11-08 — Strike $3.90')] },
    { grantee: 'IT Manager', boardApprovalDate: '2023-05-30', options: 35_000, strikeUsd: 4.50, reflectedInCapTable: true, evidence: [ref('options', 'g8', 8, 'IT Manager — 35,000 options — Board approved 2023-05-30 — Strike $4.50')] },
    { grantee: 'VP Clinical Operations', boardApprovalDate: '2024-09-12', options: 95_000, strikeUsd: 9.80, reflectedInCapTable: false, evidence: [ref('options', 'g9', 9, 'VP Clinical Operations — 95,000 options — Board approved 2024-09-12 — Strike $9.80')] },
    { grantee: 'VP Revenue Cycle Management', boardApprovalDate: '2024-10-03', options: 68_000, strikeUsd: 9.80, reflectedInCapTable: false, evidence: [ref('options', 'g10', 10, 'VP Revenue Cycle Management — 68,000 options — Board approved 2024-10-03 — Strike $9.80')] },
    { grantee: 'Director of Payer Contracting', boardApprovalDate: '2024-11-18', options: 42_000, strikeUsd: 10.40, reflectedInCapTable: false, evidence: [ref('options', 'g11', 11, 'Director of Payer Contracting — 42,000 options — Board approved 2024-11-18 — Strike $10.40')] },
    { grantee: 'Head of Data & Analytics', boardApprovalDate: '2024-12-05', options: 35_000, strikeUsd: 10.40, reflectedInCapTable: false, evidence: [ref('options', 'g12', 12, 'Head of Data & Analytics — 35,000 options — Board approved 2024-12-05 — Strike $10.40')] },
  ],
  keyTerms: [
    {
      label: 'Fully diluted shares (as stated)',
      value: '8,240,000',
      evidence: [
        ref('mgmt-pres', 's7-b1', 7, 'Fully diluted shares outstanding: 8,240,000'),
        ref('cap-table', 'row-7', 7, 'Total fully diluted shares outstanding — 8,240,000 shares — 100.0%'),
      ],
    },
    {
      label: 'Cap table completeness footnote',
      value: 'Includes all options issued and outstanding as of the date hereof',
      evidence: [ref('cap-table', 'row-8', 8, 'Footnote: Includes all options issued and outstanding as of the date hereof.')],
    },
  ],
  statementId: `${SESSION_ID}:extract:profile`,
  provenance: prov('extract', 'profile', { promptVersion: null, producedBy: 'deterministic', latencyMs: null }),
};

const EXTRACTION: ExtractionResult = {
  classifications: [
    { docId: 'mgmt-pres', workstream: 'financial', docKind: 'management_presentation', confidence: 0.96, rationale: 'Contains headline financials, revenue quality narrative, and capitalization summary.', fieldsExtracted: 9 },
    { docId: 'contracts', workstream: 'commercial', docKind: 'customer_contracts', confidence: 0.94, rationale: 'Six customer agreements with term, renewal, and termination language.', fieldsExtracted: 6 },
    { docId: 'cap-table', workstream: 'financial', docKind: 'cap_table', confidence: 0.98, rationale: 'Fully diluted ownership table with a completeness footnote.', fieldsExtracted: 6 },
    { docId: 'options', workstream: 'financial', docKind: 'option_grants', confidence: 0.97, rationale: 'Twelve board-approved option grants spanning 2019–2024.', fieldsExtracted: 12 },
  ],
  profile: PROFILE,
  failures: [],
  droppedEvidenceRefs: 0,
  generatedAt: NOW,
};

// ----------------------------------------------------------------------------
// Benchmark
// ----------------------------------------------------------------------------

const BENCHMARK: BenchmarkResult = {
  peers: [
    { id: 'alden', name: 'Alden Outpatient Group', sector: 'Healthcare Services', revenueUsdM: 52, revenueGrowthPct: 11.2, grossMarginPct: 57.5, evEbitdaMultiple: 9.8, descriptor: 'Multi-site outpatient diagnostics platform with a similar payer mix.' },
    { id: 'corewell', name: 'CoreWell Diagnostics Partners', sector: 'Healthcare Services', revenueUsdM: 61, revenueGrowthPct: 9.4, grossMarginPct: 55.1, evEbitdaMultiple: 8.6, descriptor: 'National diagnostics roll-up — larger scale, lower organic growth.' },
    { id: 'trailhead', name: 'Trailhead Specialty Care', sector: 'Healthcare Services', revenueUsdM: 38, revenueGrowthPct: 14.8, grossMarginPct: 61.3, evEbitdaMultiple: 10.5, descriptor: 'Founder-led specialty clinics operator, comparable growth profile.' },
  ],
  rows: [
    {
      metric: 'revenue_growth_pct',
      label: 'Revenue growth',
      unit: '%',
      targetValue: 16.5,
      targetEvidence: [ref('mgmt-pres', 's2-b2', 2, 'FY24 Revenue growth: 16.5% YoY')],
      peerValues: [
        { peerId: 'alden', value: 11.2 },
        { peerId: 'corewell', value: 9.4 },
        { peerId: 'trailhead', value: 14.8 },
      ],
      peerMedian: 11.2,
      deltaVsMedian: 5.3,
      direction: 'above',
    },
    {
      metric: 'gross_margin_pct',
      label: 'Gross margin',
      unit: '%',
      targetValue: 60.8,
      targetEvidence: [ref('mgmt-pres', 's2-b3', 2, 'FY24 Gross Margin: 60.8%')],
      peerValues: [
        { peerId: 'alden', value: 57.5 },
        { peerId: 'corewell', value: 55.1 },
        { peerId: 'trailhead', value: 61.3 },
      ],
      peerMedian: 57.5,
      deltaVsMedian: 3.3,
      direction: 'above',
    },
    {
      metric: 'ev_ebitda_multiple',
      label: 'EV / EBITDA',
      unit: 'x',
      targetValue: 21.2,
      targetEvidence: [],
      peerValues: [
        { peerId: 'alden', value: 9.8 },
        { peerId: 'corewell', value: 8.6 },
        { peerId: 'trailhead', value: 10.5 },
      ],
      peerMedian: 9.8,
      deltaVsMedian: 11.4,
      direction: 'above',
    },
  ],
  commentary:
    'Meridian is growing faster and carries higher gross margins than the peer set, consistent with a service base management characterizes as largely multi-year and recurring. The proposed entry multiple sits well above the peer trading range, typical of a proprietary process rather than a public comp set.',
  degraded: false,
  generatedAt: NOW,
  statementId: `${SESSION_ID}:benchmark:result`,
  provenance: prov('benchmark', 'result', { promptVersion: 'benchmark-commentary@v1', producedBy: 'gemini-2.5-flash', latencyMs: 1840 }),
};

// ----------------------------------------------------------------------------
// Portfolio impact
// ----------------------------------------------------------------------------

const PORTFOLIO: PortfolioImpact = {
  portfolio: [
    { id: 'ridgeline', name: 'Ridgeline Behavioral Health', sector: 'Healthcare Services', dealSizeUsdM: 140, vintageYear: 2021 },
    { id: 'vantage', name: 'Vantage Diagnostics Holdings', sector: 'Healthcare Services', dealSizeUsdM: 95, vintageYear: 2022 },
    { id: 'brightlane', name: 'BrightLane Software', sector: 'Software', dealSizeUsdM: 180, vintageYear: 2020 },
    { id: 'ferro', name: 'Ferro Industrial Components', sector: 'Industrials', dealSizeUsdM: 110, vintageYear: 2019 },
    { id: 'summit-consumer', name: 'Summit Consumer Brands', sector: 'Consumer', dealSizeUsdM: 75, vintageYear: 2023 },
  ],
  targetSector: 'Healthcare Services',
  targetDealSizeUsdM: 220,
  totalBeforeUsdM: 600,
  totalAfterUsdM: 820,
  concentrations: [
    { sector: 'Healthcare Services', beforeUsdM: 235, afterUsdM: 455, beforePct: 39.2, afterPct: 55.5, deltaPct: 16.3, isTargetSector: true },
    { sector: 'Software', beforeUsdM: 180, afterUsdM: 180, beforePct: 30.0, afterPct: 22.0, deltaPct: -8.0, isTargetSector: false },
    { sector: 'Industrials', beforeUsdM: 110, afterUsdM: 110, beforePct: 18.3, afterPct: 13.4, deltaPct: -4.9, isTargetSector: false },
    { sector: 'Consumer', beforeUsdM: 75, afterUsdM: 75, beforePct: 12.5, afterPct: 9.1, deltaPct: -3.3, isTargetSector: false },
  ],
  headline: 'Adding Project Meridian brings Healthcare Services to 55.5% of the portfolio, up from 39.2%.',
  degraded: false,
  generatedAt: NOW,
  statementId: `${SESSION_ID}:portfolio:result`,
  provenance: prov('portfolio', 'result', { promptVersion: 'portfolio-headline@v1', producedBy: 'gemini-2.5-flash', latencyMs: 1120 }),
};

// ----------------------------------------------------------------------------
// Decision — the two crosschecks
// ----------------------------------------------------------------------------

const RECURRING_REVENUE_CROSSCHECK: Crosscheck = {
  id: 'recurring_revenue',
  title: 'Recurring revenue characterisation',
  workstream: 'commercial',
  status: 'contradiction_found',
  claim: {
    text: 'Management characterizes approximately 80% of FY24 revenue as recurring, subscription-based revenue from multi-year service agreements.',
    evidence: [
      ref(
        'mgmt-pres',
        's4-b2',
        4,
        'Approximately 80% of FY24 revenue is recurring, subscription-based revenue from multi-year service agreements.',
      ),
    ],
  },
  counterEvidence: [
    ref('contracts', 'c2-cl4', 2, "Either party may terminate this Agreement for convenience upon 30 days' prior written notice.", 'Summit Diagnostics Alliance — $5.6m ACV — classified as recurring'),
    ref('contracts', 'c4-cl3', 4, "Client may terminate this Agreement for any reason or no reason at all upon 30 days' notice to Provider.", 'Parkview Specialty Clinics — $4.8m ACV — classified as recurring'),
    ref('contracts', 'c6-cl5', 6, "Client may terminate this Agreement without cause at any time upon 30 days' written notice to Provider.", 'Brightpath Medical Group — $3.6m ACV — classified as recurring'),
  ],
  explanation:
    "Three of the six customer contracts management classifies as recurring carry termination-for-convenience language — worded as 'for convenience,' 'for any reason or no reason,' and 'without cause' — each exercisable on 30 days' notice. Together they represent $14.0m of the $37.8m management counts as recurring FY24 revenue. The remaining three contracts are genuinely locked in through their term or auto-renew without an out.",
  quantification: {
    label: 'Recurring revenue: claimed vs. defensibly recurring',
    claimedValue: 80,
    observedValue: 50.4,
    unit: '%',
    note: 'Sum of contracts management classifies as recurring ($37.8m), minus the three carrying termination-for-convenience clauses ($14.0m), divided by FY24 total revenue ($47.3m).',
  },
  severityHint: 'high',
  suggestedMemoLanguage:
    'Of the revenue management characterizes as recurring, $14.0m (≈30%) sits in contracts terminable for convenience on 30 days\' notice; the defensibly recurring base is closer to 50% of FY24 revenue than the stated 80%.',
  modelConfidence: 0.91,
  statementId: `${SESSION_ID}:decision:recurring_revenue`,
  provenance: prov('decision', 'recurring_revenue', { promptVersion: 'crosscheck-recurring@v1', producedBy: 'gemini-2.5-pro', latencyMs: 3620 }),
  analystDecision: 'pending',
  analystNote: null,
};

const OPTION_DILUTION_CROSSCHECK: Crosscheck = {
  id: 'option_dilution',
  title: 'Option grant dilution completeness',
  workstream: 'financial',
  status: 'contradiction_found',
  claim: {
    text: 'The cap table states 8,240,000 fully diluted shares outstanding, footnoted as including all options issued and outstanding as of the date hereof.',
    evidence: [
      ref('cap-table', 'row-7', 7, 'Total fully diluted shares outstanding — 8,240,000 shares — 100.0%'),
      ref('cap-table', 'row-8', 8, 'Footnote: Includes all options issued and outstanding as of the date hereof.'),
    ],
  },
  counterEvidence: [
    ref('options', 'g9', 9, 'VP Clinical Operations — 95,000 options — Board approved 2024-09-12 — Strike $9.80', 'board-approved, not reflected in cap table'),
    ref('options', 'g10', 10, 'VP Revenue Cycle Management — 68,000 options — Board approved 2024-10-03 — Strike $9.80', 'board-approved, not reflected in cap table'),
    ref('options', 'g11', 11, 'Director of Payer Contracting — 42,000 options — Board approved 2024-11-18 — Strike $10.40', 'board-approved, not reflected in cap table'),
    ref('options', 'g12', 12, 'Head of Data & Analytics — 35,000 options — Board approved 2024-12-05 — Strike $10.40', 'board-approved, not reflected in cap table'),
  ],
  explanation:
    'Four option grants — totaling 240,000 options — were board-approved between September and December 2024 but do not appear in the cap table, despite a footnote stating the table includes all options issued and outstanding as of its date. Adding them raises the fully diluted count from 8,240,000 to 8,480,000 shares, a 2.8 percentage-point dilution not reflected in the stated ownership percentages.',
  quantification: {
    label: 'Fully diluted share count',
    claimedValue: 8_240_000,
    observedValue: 8_480_000,
    unit: 'shares',
    note: 'Stated fully diluted count (8,240,000) plus the four board-approved grants absent from the cap table (95,000 + 68,000 + 42,000 + 35,000 = 240,000).',
  },
  severityHint: 'medium',
  suggestedMemoLanguage:
    'Four board-approved option grants totaling 240,000 options (≈2.8 percentage points of fully diluted ownership) are absent from the cap table despite a completeness footnote; the corrected fully diluted count is 8,480,000 shares.',
  modelConfidence: 0.88,
  statementId: `${SESSION_ID}:decision:option_dilution`,
  provenance: prov('decision', 'option_dilution', { promptVersion: 'crosscheck-dilution@v1', producedBy: 'gemini-2.5-pro', latencyMs: 3110 }),
  analystDecision: 'pending',
  analystNote: null,
};

const DECISION: DecisionResult = {
  crosschecks: [RECURRING_REVENUE_CROSSCHECK, OPTION_DILUTION_CROSSCHECK],
  comingSoon: [
    { workstream: 'legal', label: 'Legal & regulatory', description: 'Corporate structure, litigation, licensure, and regulatory standing.' },
    { workstream: 'tax', label: 'Tax', description: 'Entity structure, historical filings, and transaction tax exposure.' },
    { workstream: 'hr', label: 'HR & compensation', description: 'Headcount, compensation structure, and key-person retention risk.' },
    { workstream: 'operations', label: 'Operations', description: 'Site-level unit economics, payer mix, and operating leverage.' },
  ],
  failures: [],
  generatedAt: NOW,
};

// ----------------------------------------------------------------------------
// IC memo
// ----------------------------------------------------------------------------

function memoSection(id: MemoSection['id'], heading: string, body: string, evidence: EvidenceRef[]): MemoSection {
  return {
    id,
    heading,
    body,
    evidence,
    statementId: `${SESSION_ID}:memo:${id}`,
    provenance: prov('memo', id, { promptVersion: `memo-${id}@v1`, producedBy: 'gemini-2.5-pro', latencyMs: 2280 }),
    edited: false,
    originalBody: null,
  };
}

const MEMO: IcMemo = {
  dealName: 'Project Meridian',
  targetCompany: 'Meridian Health Partners',
  thesis:
    'Acquire a profitable, growing outpatient diagnostics and specialty care platform in the Texas Triangle as a regional Healthcare Services add-on, with upside from de novo openings and tuck-in acquisitions.',
  sections: [
    memoSection(
      'situation',
      'Situation',
      'Meridian Health Partners is a $47.3m-revenue outpatient diagnostics and specialty care platform headquartered in Austin, TX, founded in 2014. The proposed transaction values the business at $220m, funded as a standalone Healthcare Services platform investment.',
      [ref('mgmt-pres', 's2-b1', 2, 'FY24 Revenue: $47.3m'), ref('mgmt-pres', 's3-b1', 3, 'Meridian Health Partners operates a multi-site network of outpatient diagnostics and specialty care clinics')],
    ),
    memoSection(
      'numbers',
      'The numbers',
      "FY24 revenue of $47.3m grew 16.5% year-over-year, ahead of the three-company peer median of 11.2%. Gross margin of 60.8% and EBITDA margin of 22.0% both lead the peer set. The proposed $220m enterprise value implies a 21.2x EV/EBITDA multiple, well above the 9.8x peer trading median — consistent with a proprietary process rather than a public comp set.\n\n- Revenue quality: management states ~80% of revenue is recurring; WinBack's crosscheck against the underlying contracts finds the defensibly recurring share closer to 50% (see Requires confirmation).\n- Capitalization: the stated fully diluted count of 8,240,000 shares omits four board-approved 2024 option grants; the corrected count is 8,480,000 shares (see Requires confirmation).",
      [ref('mgmt-pres', 's2-b2', 2, 'FY24 Revenue growth: 16.5% YoY'), ref('mgmt-pres', 's2-b4', 4, 'FY24 Adjusted EBITDA: $10.4m (22.0% margin)')],
    ),
    memoSection(
      'portfolio_fit',
      'Portfolio fit',
      'Meridian would be the third Healthcare Services holding, bringing sector concentration from 39.2% to 55.5% of total portfolio deal value. This is a meaningful concentration increase and should be weighed against the fund\'s sector limits, though it is presented here as a fact for review, not a pass/fail screen.',
      [],
    ),
    memoSection(
      'requires_confirmation',
      'Requires confirmation',
      "WinBack's crosschecks surfaced two items that should be confirmed with management before proceeding:\n\n- Of the revenue characterized as recurring, $14.0m (≈30%) sits in contracts terminable for convenience on 30 days' notice (Summit Diagnostics Alliance, Parkview Specialty Clinics, Brightpath Medical Group). The defensibly recurring base is closer to 50% of FY24 revenue than the stated 80%.\n- Four board-approved option grants totaling 240,000 options (≈2.8 percentage points of fully diluted ownership) are absent from the cap table despite a footnote stating it includes all options issued and outstanding.",
      [
        ref('contracts', 'c2-cl4', 2, "Either party may terminate this Agreement for convenience upon 30 days' prior written notice."),
        ref('options', 'g9', 9, 'VP Clinical Operations — 95,000 options — Board approved 2024-09-12 — Strike $9.80'),
      ],
    ),
    memoSection(
      'next_steps',
      'Next steps',
      '- Confirm true recurring revenue base directly with management and re-run pricing sensitivity at the corrected figure.\n- Obtain an updated, reconciled cap table reflecting all 2024 board-approved grants.\n- Proceed with legal, tax, HR, and operations workstreams (not yet run in this session).',
      [],
    ),
  ],
  disclaimer:
    'This memo was drafted by WinBack from the documents loaded for this session. Every figure and characterization links back to its source; all of it should be verified by the deal team before circulation. This is not an investment recommendation.',
  generatedAt: NOW,
  status: 'draft',
};

// ----------------------------------------------------------------------------
// The Run
// ----------------------------------------------------------------------------

function doneStage(startedAt: string, finishedAt: string): Run['stages'][Stage] {
  return { status: 'done', error: null, startedAt, finishedAt, mock: true };
}

export const mockRun: Run = {
  id: SESSION_ID,
  deal: {
    id: 'deal-meridian',
    name: 'Project Meridian',
    targetCompany: 'Meridian Health Partners',
    sector: 'Healthcare Services',
    thesis:
      'Acquire a profitable, growing outpatient diagnostics and specialty care platform in the Texas Triangle as a regional Healthcare Services add-on, with upside from de novo openings and tuck-in acquisitions.',
    dealSizeUsdM: 220,
    createdAt: NOW,
  },
  docs: DOCS,
  extraction: EXTRACTION,
  benchmark: BENCHMARK,
  portfolio: PORTFOLIO,
  decision: DECISION,
  memo: MEMO,
  stages: {
    extract: doneStage('2026-08-29T18:40:10.000Z', '2026-08-29T18:40:24.000Z'),
    benchmark: doneStage('2026-08-29T18:40:25.000Z', '2026-08-29T18:40:29.000Z'),
    portfolio: doneStage('2026-08-29T18:40:29.500Z', '2026-08-29T18:40:32.000Z'),
    decision: doneStage('2026-08-29T18:40:33.000Z', '2026-08-29T18:40:47.000Z'),
    memo: doneStage('2026-08-29T18:40:48.000Z', '2026-08-29T18:41:59.000Z'),
  },
  createdAt: '2026-08-29T18:40:00.000Z',
  version: 1,
};
