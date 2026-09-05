// ============================================================================
// src/data/peers.ts — erd.md Part 5 §5.6
//
// Three Healthcare Services peers for /api/benchmark. Numbers are picked so
// the target (Kestrelbrook, see src/data/target/index.ts) lands
// *interestingly* against the set rather than uniformly ahead: above the
// peer median on growth, below on gross margin, roughly inline on
// EV/EBITDA. A target that beats every peer on every metric is a boring
// screen and a slightly dishonest one.
//
// Kestrelbrook FY24: revenueGrowthPct 15.7, grossMarginPct 60.1,
// implied EV/EBITDA ~21.4x (dealSizeUsdM 210 / ebitdaUsdM 9.8) — though the
// pipeline itself never computes that multiple server-side; see the comment
// in src/lib/pipeline/benchmark.ts for why.
// ============================================================================

import type { PeerCompany } from '@/lib/contracts/types';

export const PEER_COMPANIES: PeerCompany[] = [
  {
    id: 'meadowlark',
    name: 'Meadowlark Imaging Partners',
    sector: 'Healthcare Services',
    revenueUsdM: 41.5,
    revenueGrowthPct: 11.0,
    grossMarginPct: 63.4,
    evEbitdaMultiple: 20.5,
    descriptor: 'Multi-site outpatient imaging platform in the Southeast, similar payer mix to Kestrelbrook.',
  },
  {
    id: 'wrenfield',
    name: 'Wrenfield Specialty Clinics',
    sector: 'Healthcare Services',
    revenueUsdM: 58.0,
    revenueGrowthPct: 9.0,
    grossMarginPct: 65.2,
    evEbitdaMultiple: 22.0,
    descriptor: 'Larger, slower-growing specialty-care roll-up with a longer track record of tuck-ins.',
  },
  {
    id: 'brightpath',
    name: 'Brightpath Diagnostic Group',
    sector: 'Healthcare Services',
    revenueUsdM: 33.0,
    revenueGrowthPct: 13.0,
    grossMarginPct: 61.0,
    evEbitdaMultiple: 21.0,
    descriptor: 'Founder-led diagnostics operator of comparable scale, most similar growth profile of the three.',
  },
];
