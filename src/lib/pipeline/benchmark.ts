// ============================================================================
// src/lib/pipeline/benchmark.ts — erd.md Part 5 §5.6
//
// Pure, unit-tested arithmetic for /api/benchmark (Part 2 §5.3). Rule 1
// (Part 5 §5.2) holds here too: the LLM never computes a median, a delta, or
// a direction — those are TypeScript. The model only ever writes the
// 2-3 sentence commentary, and is handed these already-computed rows so it
// can't introduce a new figure.
//
// EV/EBITDA is defined as dealSizeUsdM / latest ebitdaUsdM, but
// BenchmarkRequest carries only `{ profile }` (frozen contract, Part 3.4) —
// the deal's EV isn't part of CompanyProfile and isn't passed to this
// route. The target's ev_ebitda_multiple row is therefore honestly
// `targetValue: null, direction: 'unknown'`, same as any other metric
// extraction couldn't determine — never defaulted to 0 or invented from a
// number this function doesn't have.
// ============================================================================

import type { BenchmarkRow, CompanyProfile, PeerCompany } from '@/lib/contracts/types';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Median of 3 (or any odd/even count) — the middle value(s) averaged. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const midValue = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  return round1(midValue);
}

function direction(targetValue: number | null, peerMedian: number): BenchmarkRow['direction'] {
  if (targetValue === null) return 'unknown';
  const delta = round1(targetValue - peerMedian);
  if (Math.abs(delta) <= 1) return 'inline';
  return delta > 0 ? 'above' : 'below';
}

function buildRow(
  metric: BenchmarkRow['metric'],
  label: string,
  unit: BenchmarkRow['unit'],
  targetValue: number | null,
  targetEvidence: BenchmarkRow['targetEvidence'],
  peers: PeerCompany[],
  peerValue: (peer: PeerCompany) => number,
): BenchmarkRow {
  const peerValues = peers.map((peer) => ({ peerId: peer.id, value: peerValue(peer) }));
  const peerMedian = median(peerValues.map((p) => p.value));
  return {
    metric,
    label,
    unit,
    targetValue,
    targetEvidence,
    peerValues,
    peerMedian,
    deltaVsMedian: targetValue === null ? null : round1(targetValue - peerMedian),
    direction: direction(targetValue, peerMedian),
  };
}

export function computeBenchmarkRows(profile: CompanyProfile, peers: PeerCompany[]): BenchmarkRow[] {
  const latestFy = profile.financials.at(-1) ?? null;

  return [
    buildRow(
      'revenue_growth_pct',
      'Revenue growth',
      '%',
      latestFy?.revenueGrowthPct ?? null,
      latestFy?.evidence ?? [],
      peers,
      (peer) => peer.revenueGrowthPct,
    ),
    buildRow(
      'gross_margin_pct',
      'Gross margin',
      '%',
      latestFy?.grossMarginPct ?? null,
      latestFy?.evidence ?? [],
      peers,
      (peer) => peer.grossMarginPct,
    ),
    buildRow(
      'ev_ebitda_multiple',
      'EV / EBITDA',
      'x',
      // Deliberately null — see file header. Not derivable from CompanyProfile alone.
      null,
      [],
      peers,
      (peer) => peer.evEbitdaMultiple,
    ),
  ];
}
