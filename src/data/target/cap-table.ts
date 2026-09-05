// ============================================================================
// src/data/target/cap-table.ts — Lane A
//
// Project Kestrel — Capitalization Table ('cap-table', pageNoun: 'row').
// Internally consistent — every row and the total tie out exactly — but
// incomplete: the footnote's "issued and outstanding" language quietly
// excludes board-approved grants not yet formally issued. See
// option-grants.ts for the four grants this total leaves out, and index.ts
// for the ground truth. Contradiction 2.
// ============================================================================

import type { SourceDoc } from '@/lib/contracts/types';

export const CAP_TABLE: SourceDoc = {
  id: 'cap-table',
  kind: 'cap_table',
  title: 'Project Kestrel — Capitalization Table',
  filename: 'kestrel_cap_table_2026-05.xlsx',
  dateLabel: 'May 2026',
  pages: 1,
  pageNoun: 'row',
  blocks: [
    {
      id: 'hdr',
      kind: 'heading',
      page: 1,
      section: 'Capitalization Table',
      text: 'Kestrelbrook Health Partners — Capitalization Table as of May 15, 2026.',
    },
    {
      id: 'row-1',
      kind: 'kv',
      page: 1,
      section: 'Capitalization Table',
      text: 'Dana Whitfield (Founder & CEO) — Common — 2,900,000 shares — 36.9% fully diluted.',
    },
    {
      id: 'row-2',
      kind: 'kv',
      page: 1,
      section: 'Capitalization Table',
      text: 'Marcus Ellery (Founder & COO) — Common — 1,750,000 shares — 22.3% fully diluted.',
    },
    {
      id: 'row-3',
      kind: 'kv',
      page: 1,
      section: 'Capitalization Table',
      text: 'Cascade Growth Partners — Series A Preferred — 1,250,000 shares — 15.9% fully diluted.',
    },
    {
      id: 'row-4',
      kind: 'kv',
      page: 1,
      section: 'Capitalization Table',
      text: 'Redwood Capital Partners — Series A Preferred — 780,000 shares — 9.9% fully diluted.',
    },
    {
      id: 'row-5',
      kind: 'kv',
      page: 1,
      section: 'Capitalization Table',
      text: 'Option pool (reserved, unissued) — 650,000 shares — 8.3% fully diluted.',
    },
    {
      id: 'row-6',
      kind: 'kv',
      page: 1,
      section: 'Capitalization Table',
      text: 'Early employee options (issued) — 520,000 shares — 6.6% fully diluted.',
    },
    {
      id: 'total',
      kind: 'kv',
      page: 1,
      section: 'Capitalization Table',
      text: 'Total fully diluted shares outstanding — 7,850,000 shares — 100.0%.',
    },
    {
      id: 'note-1',
      kind: 'kv',
      page: 1,
      section: 'Capitalization Table — Footnotes',
      text: 'Includes all options issued and outstanding as of the date hereof.',
    },
  ],
};
