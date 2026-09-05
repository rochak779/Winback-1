// ============================================================================
// src/data/portfolio.ts — erd.md Part 5 §5.6
//
// Five existing portfolio companies across mixed sectors for
// /api/portfolio. Deal sizes are tuned against Kestrelbrook's
// dealSizeUsdM (210, see src/data/target/index.ts) so Healthcare Services
// sits at a clean 30.0% of the portfolio before this deal and 45.0% after —
// a memorable, round jump rather than an arbitrary one.
//
//   before: 231 / 770  = 30.0%
//   after:  441 / 980  = 45.0%   (231 + 210) / (770 + 210)
// ============================================================================

import type { PortfolioCompany } from '@/lib/contracts/types';

export const PORTFOLIO_COMPANIES: PortfolioCompany[] = [
  { id: 'palmetto', name: 'Palmetto Diagnostic Group', sector: 'Healthcare Services', dealSizeUsdM: 231, vintageYear: 2021 },
  { id: 'northfield', name: 'Northfield Logistics', sector: 'Industrials', dealSizeUsdM: 180, vintageYear: 2020 },
  { id: 'brightline', name: 'Brightline Payments', sector: 'Fintech', dealSizeUsdM: 150, vintageYear: 2022 },
  { id: 'ashcombe', name: 'Ashcombe Foods', sector: 'Consumer', dealSizeUsdM: 120, vintageYear: 2019 },
  { id: 'verdant', name: 'Verdant Materials', sector: 'Industrials', dealSizeUsdM: 89, vintageYear: 2023 },
];
