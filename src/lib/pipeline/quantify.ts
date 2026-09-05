// ============================================================================
// src/lib/pipeline/quantify.ts
//
// Rule 1 (erd.md Part 5 §5.2): the LLM never does arithmetic that TypeScript
// can do. Both crosscheck quantifications are recomputed here from the
// already-extracted CompanyProfile — the model's own figure is kept only as
// a cross-check note if it materially differs.
// ============================================================================

import type { Crosscheck, CompanyProfile, EvidenceRef } from '@/lib/contracts/types';

type Quantification = NonNullable<Crosscheck['quantification']>;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Sum of the annual value of contracts flagged (during extraction) as
 * terminable for convenience, over the most recent fiscal year's revenue —
 * versus the recurring percentage management stated in revenueMix.
 */
export function computeRecurringRevenueQuantification(profile: CompanyProfile): Quantification | null {
  const latestFy = profile.financials.at(-1);
  if (!latestFy) return null;

  const terminableValueUsdM = profile.contracts
    .filter((c) => c.cancellationForConvenience === true)
    .reduce((sum, c) => sum + c.annualValueUsdM, 0);
  const observedValue = round1((terminableValueUsdM / latestFy.revenueUsdM) * 100);

  const claimedItem = profile.revenueMix.find((r) => /recurring/i.test(r.label));
  const claimedValue = claimedItem?.pct ?? 0;

  return {
    label: `${latestFy.fy} revenue terminable at short notice vs. claimed recurring share`,
    claimedValue,
    observedValue,
    unit: '%',
    note:
      `Computed as $${terminableValueUsdM.toFixed(1)}m across the contracts extraction flagged as ` +
      `terminable for convenience, divided by ${latestFy.fy} revenue of $${latestFy.revenueUsdM.toFixed(1)}m.`,
  };
}

/**
 * Stated fully diluted share count plus every board-approved grant judged
 * missing from the cap table.
 *
 * `optionGrants[].reflectedInCapTable` is set at *extraction* time, but
 * extraction is one call per document (erd.md §5.4) — the options-document
 * call never sees the cap table, so it can only ever be honestly `null`
 * ("unsure"), never `false`. The crosscheck call, by contrast, reads both
 * documents together and *cites* (read-and-judge, not compute-in-your-head —
 * Rule 1) exactly which grant blocks it judges unreflected. So the missing
 * set here comes from the crosscheck's own `counterEvidence` citations,
 * cross-referenced back to each grant's extraction evidence to find its
 * `options` count — the model identifies which grants are missing, but the
 * sum and the resulting corrected total are computed here, not by the model.
 */
export function computeOptionDilutionQuantification(
  profile: CompanyProfile,
  counterEvidence: EvidenceRef[],
): Quantification | null {
  const stated = profile.statedFullyDilutedShares;
  if (stated === null) return null;

  const citedGrantBlockIds = new Set(counterEvidence.filter((e) => e.docId === 'options').map((e) => e.blockId));
  if (citedGrantBlockIds.size === 0) return null;

  const missing = profile.optionGrants.filter((g) =>
    g.evidence.some((e) => e.docId === 'options' && citedGrantBlockIds.has(e.blockId)),
  );
  if (missing.length === 0) return null;

  const missingTotal = missing.reduce((sum, g) => sum + g.options, 0);
  const corrected = stated + missingTotal;
  const dilutionPct = round1((missingTotal / corrected) * 100);

  return {
    label: 'Corrected fully diluted share count',
    claimedValue: stated,
    observedValue: corrected,
    unit: 'shares',
    note:
      `Computed by adding ${missingTotal.toLocaleString()} board-approved options ` +
      `(${missing.map((g) => g.grantee).join(', ')}) the crosscheck cited as unreflected in the stated ` +
      `count of ${stated.toLocaleString()} — a ${dilutionPct} percentage-point dilution.`,
  };
}

/**
 * Prefers the recomputed (deterministic) quantification; if the model's own
 * figure differs materially, that's kept as a note rather than discarded
 * silently — it's a good signal something's off in extraction if it keeps
 * happening.
 */
export function reconcileQuantification(
  computed: Quantification | null,
  modelQuantification: Quantification | null,
): Quantification | null {
  if (!computed) return modelQuantification;
  if (!modelQuantification || Math.abs(modelQuantification.observedValue - computed.observedValue) < 0.5) {
    return computed;
  }
  return {
    ...computed,
    note: `${computed.note} (model's own figure: ${modelQuantification.observedValue}${modelQuantification.unit} — recomputed value used instead.)`,
  };
}
