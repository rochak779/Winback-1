// ============================================================================
// src/lib/evidence.ts
//
// The thing that makes this credible (erd.md Part 2 §7, Part 5 §5.5). Every
// EvidenceRef a model produces is validated here, server-side, before it ever
// reaches the client — the UI can assume every ref it receives resolves to a
// real block.
// ============================================================================

import type { Block, EvidenceRef, SourceDoc } from '@/lib/contracts/types';

/** Collapse whitespace, lowercase, strip smart quotes — for substring matching only. */
function normalize(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findBlock(docs: SourceDoc[], docId: string, blockId: string): Block | null {
  const doc = docs.find((d) => d.id === docId);
  if (!doc) return null;
  return doc.blocks.find((b) => b.id === blockId) ?? null;
}

export interface ValidateEvidenceResult {
  valid: EvidenceRef[];
  dropped: number;
}

/**
 * Validate a batch of evidence refs against the real documents.
 *
 * - Drops any ref whose docId/blockId doesn't resolve, logging each drop.
 * - Overwrites `page` from the real block — never trusts the model's page number.
 * - Sets `quoteVerified` by normalized substring match; if unverified, keeps
 *   the ref but truncates `quote` to the block's first 160 characters so the
 *   UI never shows an invented sentence.
 * - Deduplicates on `docId + blockId`, keeping the longest verified quote.
 */
export function validateEvidence(
  refs: EvidenceRef[],
  docs: SourceDoc[],
  opts?: { purpose?: string },
): ValidateEvidenceResult {
  const kept = new Map<string, EvidenceRef>();
  let dropped = 0;

  for (const ref of refs) {
    const block = findBlock(docs, ref.docId, ref.blockId);
    if (!block) {
      dropped++;
      console.error('[winback] evidence dropped', {
        purpose: opts?.purpose,
        docId: ref.docId,
        blockId: ref.blockId,
      });
      continue;
    }

    const normalizedBlock = normalize(block.text);
    const normalizedQuote = normalize(ref.quote);
    const quoteVerified = normalizedQuote.length > 0 && normalizedBlock.includes(normalizedQuote);

    const resolved: EvidenceRef = {
      ...ref,
      page: block.page,
      quoteVerified,
      quote: quoteVerified ? ref.quote : block.text.slice(0, 160),
    };

    const key = `${resolved.docId}::${resolved.blockId}`;
    const existing = kept.get(key);
    if (!existing || resolved.quote.length > existing.quote.length) {
      kept.set(key, resolved);
    }
  }

  return { valid: Array.from(kept.values()), dropped };
}

/**
 * Recursively finds every `EvidenceRef[]` field in a nested result object
 * (identified by key name — every such field in the contract is named
 * `evidence`, `targetEvidence`, `counterEvidence`, etc.) and replaces it with
 * `fn(refs)`, mutating in place. Lets a route validate a whole
 * `CompanyProfile` — or any nested result — in one call.
 */
export function walkEvidence(obj: unknown, fn: (refs: EvidenceRef[]) => EvidenceRef[]): void {
  if (obj === null || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) walkEvidence(item, fn);
    return;
  }

  const rec = obj as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    const value = rec[key];
    if (Array.isArray(value) && /evidence/i.test(key)) {
      rec[key] = fn(value as EvidenceRef[]);
    } else if (value !== null && typeof value === 'object') {
      walkEvidence(value, fn);
    }
  }
}

/**
 * Renders a document as block-id-annotated text for a prompt — the whole
 * trick behind reliable evidence links (erd.md Part 5 §5.4):
 *
 *   [s4-b1] (slide 4 · Revenue Quality) Meridian's revenue base is anchored...
 *   [s4-b2] (slide 4 · Revenue Quality) Approximately 80% of FY24 revenue...
 */
export function renderDocForPrompt(doc: SourceDoc): string {
  return doc.blocks
    .filter((b) => !b.deprecated)
    .map((b) => {
      const location = `${doc.pageNoun} ${b.page}${b.section ? ` · ${b.section}` : ''}`;
      return `[${b.id}] (${location}) ${b.text}`;
    })
    .join('\n');
}
