// ============================================================================
// src/lib/__tests__/evidence.test.ts
//
// Unit tests for validateEvidence() — erd.md Part 5 §5.5 session 2.1: dropped
// refs, quote verification, dedup, page overwrite.
// ============================================================================

import { describe, expect, it, vi } from 'vitest';
import { renderDocForPrompt, validateEvidence, walkEvidence } from '@/lib/evidence';
import type { EvidenceRef, SourceDoc } from '@/lib/contracts/types';

const DOCS: SourceDoc[] = [
  {
    id: 'mgmt-pres',
    kind: 'management_presentation',
    title: 'Test Deck',
    filename: 'test.pdf',
    dateLabel: 'June 2026',
    pages: 1,
    pageNoun: 'slide',
    blocks: [
      {
        id: 's3-b2',
        kind: 'kv',
        page: 3,
        section: 'Revenue Quality',
        text: 'Approximately 80% of FY24 revenue is recurring, underpinned by multi-year agreements.',
      },
      {
        id: 's3-b3',
        kind: 'kv',
        // Deliberately "wrong" page on the block itself is impossible — but a
        // ref claiming a different page than this block's real page (3)
        // must be overwritten to 3.
        page: 3,
        section: 'Revenue Quality',
        text: 'Revenue mix: Recurring 80%, Project-based 20%.',
      },
    ],
  },
];

function ref(overrides: Partial<EvidenceRef>): EvidenceRef {
  return {
    docId: 'mgmt-pres',
    blockId: 's3-b2',
    page: 999, // wrong on purpose
    quote: 'Approximately 80% of FY24 revenue is recurring',
    quoteVerified: false,
    ...overrides,
  };
}

describe('validateEvidence', () => {
  it('drops refs whose docId does not resolve', () => {
    const { valid, dropped } = validateEvidence([ref({ docId: 'contracts' as never })], DOCS);
    expect(valid).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it('drops refs whose blockId does not resolve', () => {
    const { valid, dropped } = validateEvidence([ref({ blockId: 'nope' })], DOCS);
    expect(valid).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it('overwrites page from the real block, never trusting the model', () => {
    const { valid } = validateEvidence([ref({ page: 1 })], DOCS);
    expect(valid[0]?.page).toBe(3);
  });

  it('verifies a quote that is a normalized substring of the block text', () => {
    const { valid } = validateEvidence([ref({ quote: 'approximately 80% of fy24 revenue is recurring' })], DOCS);
    expect(valid[0]?.quoteVerified).toBe(true);
    expect(valid[0]?.quote).toBe('approximately 80% of fy24 revenue is recurring');
  });

  it('handles whitespace and smart-quote variation when verifying', () => {
    const { valid } = validateEvidence(
      [ref({ quote: 'Approximately   80%  of FY24\nrevenue is recurring' })],
      DOCS,
    );
    expect(valid[0]?.quoteVerified).toBe(true);
  });

  it('truncates an unverified quote to the block text first 160 chars instead of inventing one', () => {
    const { valid } = validateEvidence([ref({ quote: 'this sentence does not appear anywhere' })], DOCS);
    expect(valid[0]?.quoteVerified).toBe(false);
    expect(valid[0]?.quote).toBe(DOCS[0]!.blocks[0]!.text.slice(0, 160));
  });

  it('deduplicates on docId+blockId, keeping the longest verified quote', () => {
    const { valid, dropped } = validateEvidence(
      [
        ref({ quote: 'Approximately 80%' }),
        ref({ quote: 'Approximately 80% of FY24 revenue is recurring' }),
      ],
      DOCS,
    );
    expect(dropped).toBe(0);
    expect(valid).toHaveLength(1);
    expect(valid[0]?.quote).toBe('Approximately 80% of FY24 revenue is recurring');
  });

  it('logs each drop without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    validateEvidence([ref({ blockId: 'nope' })], DOCS, { purpose: 'test:purpose' });
    expect(spy).toHaveBeenCalledWith(
      '[winback] evidence dropped',
      expect.objectContaining({ purpose: 'test:purpose', blockId: 'nope' }),
    );
    spy.mockRestore();
  });
});

describe('walkEvidence', () => {
  it('finds and replaces every EvidenceRef[] in a nested object by key name', () => {
    const obj = {
      claim: { text: 'x', evidence: [ref({})] },
      counterEvidence: [ref({ blockId: 'nope' })],
      nested: { deeper: { targetEvidence: [ref({})] } },
      untouched: 'x',
    };

    walkEvidence(obj, (refs) => validateEvidence(refs, DOCS).valid);

    expect(obj.claim.evidence).toHaveLength(1);
    expect(obj.claim.evidence[0]?.page).toBe(3);
    expect(obj.counterEvidence).toHaveLength(0);
    expect(obj.nested.deeper.targetEvidence).toHaveLength(1);
  });

  it('walks arrays of objects, not just plain nested objects', () => {
    const obj = { items: [{ evidence: [ref({})] }, { evidence: [ref({ blockId: 'nope' })] }] };
    walkEvidence(obj, (refs) => validateEvidence(refs, DOCS).valid);
    expect(obj.items[0]?.evidence).toHaveLength(1);
    expect(obj.items[1]?.evidence).toHaveLength(0);
  });
});

describe('renderDocForPrompt', () => {
  it('annotates each block with its id, location, and text', () => {
    const rendered = renderDocForPrompt(DOCS[0]!);
    expect(rendered).toContain('[s3-b2] (slide 3 · Revenue Quality) Approximately 80%');
    expect(rendered).toContain('[s3-b3] (slide 3 · Revenue Quality) Revenue mix');
  });

  it('excludes deprecated blocks', () => {
    const doc: SourceDoc = {
      ...DOCS[0]!,
      blocks: [...DOCS[0]!.blocks, { id: 's3-b4', kind: 'paragraph', page: 3, text: 'old', deprecated: true }],
    };
    const rendered = renderDocForPrompt(doc);
    expect(rendered).not.toContain('s3-b4');
  });
});
