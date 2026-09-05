// ============================================================================
// src/lib/pipeline/prompts/option-dilution.ts
//
// Crosscheck: whether the stated fully diluted position reconciles to every
// board-approved equity grant (erd.md Part 5 §5.7).
//
// General diligence procedure, not the answer — it never mentions specific
// grant ids, dollar amounts, or a percentage-point figure. It would read the
// same way for any capitalisation reconciliation problem, not just the one
// planted here (erd.md Part 5 §5.2 Rule 2).
// ============================================================================

import type { CrosscheckDef } from '@/lib/pipeline/crosscheck';

export const version = 'crosscheck-dilution@v1';

export const def: CrosscheckDef = {
  id: 'option_dilution',
  title: 'Fully diluted share reconciliation',
  workstream: 'financial',
  docIds: ['cap-table', 'options'],
  procedure: `The capitalisation table must reconcile to all equity instruments the board has approved. \
First, identify the fully diluted share count as stated in the capitalisation table, and the basis on \
which that table says it was prepared (any footnote or qualifying language about what it does or does \
not include). Then, independently, reconcile every board-approved option or equity grant against that \
stated basis — for each grant, determine whether it is already reflected in the capitalisation table's \
fully diluted count or appears to be a separate approved instrument not counted there. Report whether \
the stated fully diluted position reflects all approved grants, whether it does not, or whether the \
documents do not contain enough information to say.`,
  quantificationHint:
    'the corrected fully diluted share count (the stated count plus any board-approved grants not ' +
    'reflected in it) and the resulting shift in fully diluted ownership, in percentage points.',
};
