// ============================================================================
// src/lib/__tests__/portfolio.test.ts
//
// Unit tests for computeConcentration() — erd.md Part 2 §5.4 session 4.1.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { computeConcentration } from '@/lib/pipeline/portfolio';
import type { PortfolioCompany } from '@/lib/contracts/types';

const PORTFOLIO: PortfolioCompany[] = [
  { id: 'p1', name: 'P1', sector: 'Healthcare Services', dealSizeUsdM: 231, vintageYear: 2021 },
  { id: 'p2', name: 'P2', sector: 'Industrials', dealSizeUsdM: 180, vintageYear: 2020 },
  { id: 'p3', name: 'P3', sector: 'Fintech', dealSizeUsdM: 150, vintageYear: 2022 },
  { id: 'p4', name: 'P4', sector: 'Consumer', dealSizeUsdM: 120, vintageYear: 2019 },
  { id: 'p5', name: 'P5', sector: 'Industrials', dealSizeUsdM: 89, vintageYear: 2023 },
];

describe('computeConcentration', () => {
  it('computes totals before and after the deal', () => {
    const result = computeConcentration(PORTFOLIO, 'Healthcare Services', 210);
    expect(result.totalBeforeUsdM).toBe(770);
    expect(result.totalAfterUsdM).toBe(980);
  });

  it('takes Healthcare Services from a clean 30.0% to 45.0%', () => {
    const result = computeConcentration(PORTFOLIO, 'Healthcare Services', 210);
    const hc = result.concentrations.find((c) => c.sector === 'Healthcare Services')!;
    expect(hc.beforePct).toBe(30.0);
    expect(hc.afterPct).toBe(45.0);
    expect(hc.deltaPct).toBe(15.0);
    expect(hc.isTargetSector).toBe(true);
  });

  it('leaves non-target sectors unchanged in absolute dollars but rebalanced as a percentage', () => {
    const result = computeConcentration(PORTFOLIO, 'Healthcare Services', 210);
    const industrials = result.concentrations.find((c) => c.sector === 'Industrials')!;
    expect(industrials.beforeUsdM).toBe(269);
    expect(industrials.afterUsdM).toBe(269);
    expect(industrials.isTargetSector).toBe(false);
    expect(industrials.afterPct).toBeLessThan(industrials.beforePct);
  });

  it('sorts concentrations by afterPct descending', () => {
    const result = computeConcentration(PORTFOLIO, 'Healthcare Services', 210);
    const afterPcts = result.concentrations.map((c) => c.afterPct);
    expect(afterPcts).toEqual([...afterPcts].sort((a, b) => b - a));
  });

  it('adds a target sector with no existing portfolio companies as a new row', () => {
    const result = computeConcentration(PORTFOLIO, 'Biotech', 100);
    const biotech = result.concentrations.find((c) => c.sector === 'Biotech')!;
    expect(biotech.beforeUsdM).toBe(0);
    expect(biotech.beforePct).toBe(0);
    expect(biotech.afterUsdM).toBe(100);
    expect(biotech.isTargetSector).toBe(true);
  });
});
