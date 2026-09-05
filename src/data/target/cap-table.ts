// ============================================================================
// src/data/target/cap-table.ts — Lane A
//
// Project Kestrel — Capitalization Table ('cap-table', pageNoun: 'row').
// Internally consistent but incomplete — the fully-diluted total excludes
// several board-approved grants (contradiction 2). Blocks land in session 1.3.
// Block id pattern: row-<n>, hdr, total, note-<n>.
// ============================================================================

import type { SourceDoc } from '@/lib/contracts/types';

export const CAP_TABLE: SourceDoc = {
  id: 'cap-table',
  kind: 'cap_table',
  title: 'Project Kestrel — Capitalization Table',
  filename: 'kestrel_cap_table_2026-05.xlsx',
  dateLabel: 'May 2026',
  pages: 0,
  pageNoun: 'row',
  blocks: [],
};
