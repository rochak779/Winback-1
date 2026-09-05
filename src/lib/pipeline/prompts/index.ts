// ============================================================================
// src/lib/pipeline/prompts/index.ts
//
// The two crosscheck definitions, keyed by CrosscheckId, each paired with its
// prompt version string (erd.md Part 5 §5.1, §5.7).
// ============================================================================

import type { CrosscheckDef } from '@/lib/pipeline/crosscheck';
import { def as recurringRevenueDef, version as recurringRevenueVersion } from './recurring-revenue';
import { def as optionDilutionDef, version as optionDilutionVersion } from './option-dilution';
import type { CrosscheckId } from '@/lib/contracts/types';

export const CROSSCHECK_DEFS: { def: CrosscheckDef; version: string }[] = [
  { def: recurringRevenueDef, version: recurringRevenueVersion },
  { def: optionDilutionDef, version: optionDilutionVersion },
];

export const CROSSCHECK_DEFS_BY_ID: Record<CrosscheckId, { def: CrosscheckDef; version: string }> = {
  recurring_revenue: { def: recurringRevenueDef, version: recurringRevenueVersion },
  option_dilution: { def: optionDilutionDef, version: optionDilutionVersion },
};
