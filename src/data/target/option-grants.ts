// ============================================================================
// src/data/target/option-grants.ts — Lane A
//
// Project Kestrel — Option Grant Register ('options', pageNoun: 'grant').
// Eleven board-approved grants. The first seven (g1-g7), by approval date,
// sum to exactly 520,000 options — the cap table's stated "issued" figure.
// The last four (g8-g11) were approved in the months just before the cap
// table's May 15, 2026 as-of date but sit outside that total: 232,000
// options, ~2.9% of fully diluted ownership once corrected. See index.ts
// for the ground truth. Contradiction 2, same seam as cap-table.ts.
// ============================================================================

import type { SourceDoc } from '@/lib/contracts/types';

export const OPTION_GRANTS: SourceDoc = {
  id: 'options',
  kind: 'option_grants',
  title: 'Project Kestrel — Option Grant Register',
  filename: 'kestrel_option_grant_register.xlsx',
  dateLabel: 'May 2026',
  pages: 11,
  pageNoun: 'grant',
  blocks: [
    {
      id: 'hdr',
      kind: 'heading',
      page: 1,
      section: 'Option Grant Register',
      text: 'All options listed below were approved by the Board of Directors on the dates indicated.',
    },
    { id: 'g1', kind: 'kv', page: 1, section: 'Option Grant Register', text: 'Director of Imaging Operations — 75,000 options — Board approved 2019-05-14 — Strike $2.20.' },
    { id: 'g2', kind: 'kv', page: 2, section: 'Option Grant Register', text: 'VP Clinical Affairs — 95,000 options — Board approved 2020-02-19 — Strike $2.60.' },
    { id: 'g3', kind: 'kv', page: 3, section: 'Option Grant Register', text: 'Controller — 60,000 options — Board approved 2020-09-03 — Strike $2.85.' },
    { id: 'g4', kind: 'kv', page: 4, section: 'Option Grant Register', text: 'Practice Manager — Charlotte — 70,000 options — Board approved 2021-04-12 — Strike $3.15.' },
    { id: 'g5', kind: 'kv', page: 5, section: 'Option Grant Register', text: 'Practice Manager — Greensboro — 68,000 options — Board approved 2021-10-27 — Strike $3.15.' },
    { id: 'g6', kind: 'kv', page: 6, section: 'Option Grant Register', text: 'Compliance & Coding Manager — 72,000 options — Board approved 2022-06-08 — Strike $3.70.' },
    { id: 'g7', kind: 'kv', page: 7, section: 'Option Grant Register', text: 'Senior Revenue Cycle Analyst — 80,000 options — Board approved 2023-01-16 — Strike $4.05.' },
    { id: 'g8', kind: 'kv', page: 8, section: 'Option Grant Register', text: 'VP Payer Contracting — 68,000 options — Board approved 2026-03-18 — Strike $9.60.' },
    { id: 'g9', kind: 'kv', page: 9, section: 'Option Grant Register', text: 'Director of Ambulatory Growth — 58,000 options — Board approved 2026-04-02 — Strike $9.60.' },
    { id: 'g10', kind: 'kv', page: 10, section: 'Option Grant Register', text: 'Head of Data & Clinical Analytics — 52,000 options — Board approved 2026-04-25 — Strike $10.20.' },
    { id: 'g11', kind: 'kv', page: 11, section: 'Option Grant Register', text: 'VP Human Resources — 54,000 options — Board approved 2026-05-09 — Strike $10.20.' },
  ],
};
