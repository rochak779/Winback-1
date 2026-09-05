// ============================================================================
// src/data/target/option-grants.ts — Lane A
//
// Project Kestrel — Option Grant Register ('options', pageNoun: 'grant').
// 10-14 board-approved grants; 3-4 recent ones are absent from the cap table
// (contradiction 2, same seam as cap-table.ts). Blocks land in session 1.3.
// Block id pattern: g<n>, hdr.
// ============================================================================

import type { SourceDoc } from '@/lib/contracts/types';

export const OPTION_GRANTS: SourceDoc = {
  id: 'options',
  kind: 'option_grants',
  title: 'Project Kestrel — Option Grant Register',
  filename: 'kestrel_option_grant_register.xlsx',
  dateLabel: 'May 2026',
  pages: 0,
  pageNoun: 'grant',
  blocks: [],
};
