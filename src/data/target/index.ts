// ============================================================================
// src/data/target/index.ts — Lane A
//
// Exports TARGET_DOCS, the four hand-authored source documents for Project
// Kestrel. This file — and only this file — carries the ground truth for
// both planted contradictions, once they're written (sessions 1.2 and 1.3):
// the true recurring revenue %, the true fully-diluted share count, and the
// true ownership delta. It is a comment for humans; the pipeline never reads it.
//
// GROUND TRUTH (filled in as each contradiction is planted):
//   - True defensibly-recurring revenue %:      48.3% (sticky contracts only,
//     $22.1m / $45.8m FY24 revenue), vs. the mgmt deck's claimed 80%.
//     Convenience-terminable contracts: $14.2m, 31.0% of FY24 revenue.
//   - True fully-diluted share count:           8,082,000 (stated 7,850,000
//     + four board-approved grants absent from the cap table: g8-g11,
//     232,000 options total).
//   - True fully-diluted ownership delta:       2.87 percentage points
// ============================================================================

import type { SourceDoc } from '@/lib/contracts/types';
import { MGMT_PRESENTATION } from './mgmt-presentation';
import { CUSTOMER_CONTRACTS } from './customer-contracts';
import { CAP_TABLE } from './cap-table';
import { OPTION_GRANTS } from './option-grants';

export const TARGET_DOCS: SourceDoc[] = [
  MGMT_PRESENTATION,
  CUSTOMER_CONTRACTS,
  CAP_TABLE,
  OPTION_GRANTS,
];

/**
 * The agreed target-company identity (erd.md Part 4 §4.2). Not part of the
 * frozen contract — this is Lane A's own bookkeeping, kept here so Lane B's
 * peers.ts/portfolio.ts and Lane D's mockRun.ts seed from one place instead
 * of each re-typing these numbers.
 */
export const TARGET_COMPANY_IDENTITY = {
  name: 'Kestrelbrook Health Partners',
  dealCodename: 'Project Kestrel',
  sector: 'Healthcare Services',
  hq: 'Raleigh, NC',
  foundedYear: 2013,
  employees: 430,
  dealSizeUsdM: 210,
  businessSummary:
    'Kestrelbrook Health Partners operates a network of outpatient diagnostic imaging and specialty care clinics across the Carolinas, serving regional health systems and independent physician groups under long-term service agreements. Founded in 2013 and headquartered in Raleigh, NC, it has grown through same-site volume gains, de novo clinic openings, and selective tuck-in acquisitions of independent practices.',
  financials: [
    { fy: 'FY22', revenueUsdM: 34.2, revenueGrowthPct: null, grossMarginPct: 57.8, ebitdaUsdM: 5.9, ebitdaMarginPct: 17.3 },
    { fy: 'FY23', revenueUsdM: 39.6, revenueGrowthPct: 15.8, grossMarginPct: 58.9, ebitdaUsdM: 7.6, ebitdaMarginPct: 19.2 },
    { fy: 'FY24', revenueUsdM: 45.8, revenueGrowthPct: 15.7, grossMarginPct: 60.1, ebitdaUsdM: 9.8, ebitdaMarginPct: 21.4 },
  ],
} as const;
