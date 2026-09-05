// ============================================================================
// src/lib/pipeline/portfolio.ts — erd.md Part 5 §5.6, Part 2 §5.4
//
// Pure, unit-tested sector-concentration arithmetic for /api/portfolio.
// The LLM only ever writes the one-sentence `headline`, handed these
// already-computed numbers.
// ============================================================================

import type { PortfolioCompany, SectorConcentration } from '@/lib/contracts/types';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface ConcentrationResult {
  concentrations: SectorConcentration[];
  totalBeforeUsdM: number;
  totalAfterUsdM: number;
}

export function computeConcentration(
  portfolio: PortfolioCompany[],
  targetSector: string,
  dealSizeUsdM: number,
): ConcentrationResult {
  const totalBeforeUsdM = portfolio.reduce((sum, co) => sum + co.dealSizeUsdM, 0);
  const totalAfterUsdM = totalBeforeUsdM + dealSizeUsdM;

  const sectors = new Set(portfolio.map((co) => co.sector));
  sectors.add(targetSector);

  const concentrations: SectorConcentration[] = [...sectors].map((sector) => {
    const beforeUsdM = portfolio.filter((co) => co.sector === sector).reduce((sum, co) => sum + co.dealSizeUsdM, 0);
    const isTargetSector = sector === targetSector;
    const afterUsdM = beforeUsdM + (isTargetSector ? dealSizeUsdM : 0);
    const beforePct = round1((beforeUsdM / totalBeforeUsdM) * 100);
    const afterPct = round1((afterUsdM / totalAfterUsdM) * 100);
    return {
      sector,
      beforeUsdM,
      afterUsdM,
      beforePct,
      afterPct,
      deltaPct: round1(afterPct - beforePct),
      isTargetSector,
    };
  });

  concentrations.sort((a, b) => b.afterPct - a.afterPct);

  return { concentrations, totalBeforeUsdM, totalAfterUsdM };
}
