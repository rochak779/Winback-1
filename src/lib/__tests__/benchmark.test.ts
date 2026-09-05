// ============================================================================
// src/lib/__tests__/benchmark.test.ts
//
// Unit tests for computeBenchmarkRows() — erd.md Part 5 §5.6 session 4.1.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { computeBenchmarkRows } from '@/lib/pipeline/benchmark';
import type { CompanyProfile, PeerCompany } from '@/lib/contracts/types';

const PEERS: PeerCompany[] = [
  { id: 'a', name: 'A', sector: 'Healthcare Services', revenueUsdM: 40, revenueGrowthPct: 10, grossMarginPct: 60, evEbitdaMultiple: 20, descriptor: '' },
  { id: 'b', name: 'B', sector: 'Healthcare Services', revenueUsdM: 50, revenueGrowthPct: 12, grossMarginPct: 65, evEbitdaMultiple: 22, descriptor: '' },
  { id: 'c', name: 'C', sector: 'Healthcare Services', revenueUsdM: 30, revenueGrowthPct: 8, grossMarginPct: 55, evEbitdaMultiple: 18, descriptor: '' },
];

function profileWith(latestFy: Partial<CompanyProfile['financials'][number]>): CompanyProfile {
  return {
    name: 'Target Co',
    sector: 'Healthcare Services',
    hq: null,
    foundedYear: null,
    employees: null,
    businessSummary: '',
    financials: [
      {
        fy: 'FY24',
        revenueUsdM: 45,
        revenueGrowthPct: 15,
        grossMarginPct: 60,
        ebitdaUsdM: 9,
        ebitdaMarginPct: 20,
        evidence: [],
        ...latestFy,
      },
    ],
    revenueMix: [],
    contracts: [],
    capTable: [],
    statedFullyDilutedShares: null,
    optionGrants: [],
    keyTerms: [],
    statementId: 'test:profile',
    provenance: {
      statementId: 'test:profile',
      stage: 'extract',
      actor: 'model',
      producedBy: 'test',
      promptVersion: null,
      inputHash: 'test',
      generatedAt: '2026-01-01T00:00:00.000Z',
      latencyMs: null,
    },
  };
}

describe('computeBenchmarkRows', () => {
  it('computes the median of three peer values', () => {
    const rows = computeBenchmarkRows(profileWith({}), PEERS);
    const growth = rows.find((r) => r.metric === 'revenue_growth_pct')!;
    expect(growth.peerMedian).toBe(10); // middle of 8, 10, 12
  });

  it('marks direction "above" when the target beats the median by more than 1 unit', () => {
    const rows = computeBenchmarkRows(profileWith({ revenueGrowthPct: 15 }), PEERS);
    const growth = rows.find((r) => r.metric === 'revenue_growth_pct')!;
    expect(growth.targetValue).toBe(15);
    expect(growth.deltaVsMedian).toBe(5);
    expect(growth.direction).toBe('above');
  });

  it('marks direction "below" when the target trails the median by more than 1 unit', () => {
    const rows = computeBenchmarkRows(profileWith({ grossMarginPct: 50 }), PEERS);
    const margin = rows.find((r) => r.metric === 'gross_margin_pct')!;
    expect(margin.peerMedian).toBe(60);
    expect(margin.direction).toBe('below');
  });

  it('marks direction "inline" when within +/-1 unit of the median', () => {
    const rows = computeBenchmarkRows(profileWith({ revenueGrowthPct: 10.5 }), PEERS);
    const growth = rows.find((r) => r.metric === 'revenue_growth_pct')!;
    expect(growth.direction).toBe('inline');
  });

  it('propagates a null target value rather than defaulting to 0', () => {
    const rows = computeBenchmarkRows(profileWith({ revenueGrowthPct: null }), PEERS);
    const growth = rows.find((r) => r.metric === 'revenue_growth_pct')!;
    expect(growth.targetValue).toBeNull();
    expect(growth.deltaVsMedian).toBeNull();
    expect(growth.direction).toBe('unknown');
  });

  it('always reports ev_ebitda_multiple as unknown for the target (not derivable from CompanyProfile alone)', () => {
    const rows = computeBenchmarkRows(profileWith({}), PEERS);
    const evEbitda = rows.find((r) => r.metric === 'ev_ebitda_multiple')!;
    expect(evEbitda.targetValue).toBeNull();
    expect(evEbitda.direction).toBe('unknown');
    expect(evEbitda.peerMedian).toBe(20);
  });

  it('returns no rows with an empty financials array', () => {
    const profile = profileWith({});
    profile.financials = [];
    const rows = computeBenchmarkRows(profile, PEERS);
    expect(rows.every((r) => r.targetValue === null)).toBe(true);
  });
});
