// ============================================================================
// src/lib/pipeline/prompts/recurring-revenue.ts
//
// Crosscheck: management's characterisation of revenue durability vs. what
// the customer contracts actually provide (erd.md Part 5 §5.7).
//
// This procedure is written as a general diligence step, not the answer.
// It says nothing about 80%, "recurring", 30 days' notice, or any specific
// number — it would read the same way if the planted problem here were a
// large one-off implementation fee booked as recurring, or anything else
// under the same "characterisation vs. contractual commitment" umbrella.
// Litmus test: it should still work if the documents changed to plant a
// different revenue-quality problem (erd.md Part 5 §5.2 Rule 2).
// ============================================================================

import type { CrosscheckDef } from '@/lib/pipeline/crosscheck';

export const version = 'crosscheck-recurring@v1';

export const def: CrosscheckDef = {
  id: 'recurring_revenue',
  title: 'Revenue durability characterisation',
  workstream: 'commercial',
  docIds: ['mgmt-pres', 'contracts'],
  procedure: `Management's characterisation of revenue durability must be tested against the actual \
contractual commitments underlying that revenue. First, identify how management describes the \
durability or quality of revenue — any statement about how much of it recurs, renews, or is otherwise \
durable, including any stated percentage or proportion. Then examine each customer contract \
individually: its term, renewal mechanism, and — critically — the conditions under which either party \
can end it before term, including any termination-for-convenience, termination-without-cause, or "for \
any reason or no reason" language, however it is phrased. Determine what portion of revenue is \
contractually committed for a meaningful period versus terminable at short notice with no substantial \
penalty. Report whether the contractual reality supports management's characterisation, contradicts it, \
or whether the documents do not contain enough information to say.`,
  quantificationHint:
    'the percentage of the most recent fiscal year revenue attributable to contracts that are terminable ' +
    'at short notice without substantial penalty, compared against the percentage management characterised ' +
    'as durable/recurring.',
};
