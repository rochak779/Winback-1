// ============================================================================
// src/lib/client/evidence.ts — erd.md Part 6 §6.8
//
// Resolves an EvidenceRef against the docs already sitting in the run store.
// Synchronous, no network — this is what lets the drawer open in <100ms.
// ============================================================================

import type { Block, EvidenceRef, SourceDoc } from '@/lib/contracts/types';

export interface ResolvedEvidence {
  doc: SourceDoc;
  block: Block;
  ref: EvidenceRef;
}

export function resolveEvidence(ref: EvidenceRef, docs: SourceDoc[]): ResolvedEvidence | null {
  const doc = docs.find((d) => d.id === ref.docId);
  if (!doc) return null;
  const block = doc.blocks.find((b) => b.id === ref.blockId);
  if (!block) return null;
  return { doc, block, ref };
}
