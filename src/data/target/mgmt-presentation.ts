// ============================================================================
// src/data/target/mgmt-presentation.ts — Lane A
//
// Project Kestrel — Management Presentation ('mgmt-pres', pageNoun: 'slide').
// Contradiction 1 (recurring revenue vs. termination-for-convenience) lives
// in the Revenue Quality section of this deck. Blocks land in session 1.2.
// Block id pattern: s<slide>-b<block>, e.g. 's4-b2'.
// ============================================================================

import type { SourceDoc } from '@/lib/contracts/types';

export const MGMT_PRESENTATION: SourceDoc = {
  id: 'mgmt-pres',
  kind: 'management_presentation',
  title: 'Project Kestrel — Management Presentation',
  filename: 'kestrel_mgmt_presentation_v1.pdf',
  dateLabel: 'June 2026',
  pages: 0,
  pageNoun: 'slide',
  blocks: [],
};
