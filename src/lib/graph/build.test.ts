import { describe, expect, it } from 'vitest';
import { KnowledgeGraphSchema } from '@/lib/contracts/schemas';
import { mockRun } from '@/lib/fixtures/mockRun';
import { SEED_DOCS, SEED_SESSIONS } from '@/data/seed-sessions';
import { buildKnowledgeGraph, LEGAL_FORM_SUFFIXES, normalizeEntitySlug } from './build';
import type { GraphSession } from './types';

function session(id = 'one'): GraphSession {
  return structuredClone({ ...mockRun, id, deal: mockRun.deal!, updatedAt: '2026-08-29T18:42:00.000Z' });
}

describe('exact entity normalization', () => {
  it('removes punctuation and trailing legal forms only', () => {
    expect(normalizeEntitySlug('  Northgate Health, Inc. LLC ')).toBe('northgate-health');
    expect(normalizeEntitySlug('NORTHGATE-HEALTH')).toBe('northgate-health');
    expect(normalizeEntitySlug('Northgate Health Partners Group Holdings Ltd')).toBe('northgate-health-partners-group-holdings');
    expect(normalizeEntitySlug('Co Health')).toBe('co-health');
    expect(normalizeEntitySlug('北方 Health PLC')).toBe('北方-health');
    expect(LEGAL_FORM_SUFFIXES).not.toContain('health');
  });
  it('does not fuzzy-match or merge similar domain names', () => {
    expect(normalizeEntitySlug('North Gate Health')).not.toBe(normalizeEntitySlug('Northgate Health'));
    expect(normalizeEntitySlug('Northgate Partners')).not.toBe(normalizeEntitySlug('Northgate Health'));
  });
});

describe('buildKnowledgeGraph', () => {
  it('is byte deterministic, independent of the wall clock and does not mutate inputs', () => {
    const input = [session('b'), session('a')];
    const before = JSON.stringify([input, mockRun.docs]);
    const first = JSON.stringify(buildKnowledgeGraph(input, mockRun.docs));
    expect(JSON.stringify(buildKnowledgeGraph(input, mockRun.docs))).toBe(first);
    expect(JSON.stringify(buildKnowledgeGraph([...input].reverse(), [...mockRun.docs].reverse()))).toBe(first);
    expect(JSON.stringify([input, mockRun.docs])).toBe(before);
    expect(JSON.parse(first).generatedAt).toBe(input[0]!.updatedAt);
  });
  it('returns a valid deterministic empty graph', () => {
    const graph = buildKnowledgeGraph([], mockRun.docs);
    expect(KnowledgeGraphSchema.safeParse(graph).success).toBe(true);
    expect(graph.stats).toEqual({ nodeCount: 0, edgeCount: 0, sessionCount: 0, contradictionCount: 0, sharedEntityCount: 0 });
  });
  it('includes all node types and only valid cited blocks, with no dangling or duplicate edges', () => {
    const graph = buildKnowledgeGraph([session()], [...mockRun.docs,].map((doc) => ({
      ...doc, blocks: [...doc.blocks, { id: 'uncited', kind: 'paragraph' as const, text: 'Never cited', page: 99 }],
    })));
    expect(KnowledgeGraphSchema.safeParse(graph).success).toBe(true);
    expect(new Set(graph.nodes.map((node) => node.type)).size).toBe(10);
    expect(graph.nodes.some((node) => node.id.endsWith('#uncited'))).toBe(false);
    const ids = new Set(graph.nodes.map((node) => node.id));
    expect(ids.size).toBe(graph.nodes.length);
    expect(new Set(graph.edges.map((edge) => edge.id)).size).toBe(graph.edges.length);
    for (const edge of graph.edges) {
      expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true);
    }
    expect(graph.edges.find((edge) => edge.type === 'derived_from')).toBeDefined();
    expect(graph.edges.find((edge) => edge.type === 'supports')).toBeDefined();
  });
  it('drops missing refs and repairs stale quotes/pages without inventing source text', () => {
    const input = session();
    input.decision!.crosschecks[0]!.claim.evidence.push({ docId: 'contracts', blockId: 'missing', page: 99, quote: 'invented', quoteVerified: true });
    input.benchmark!.rows[0]!.targetEvidence = [{ docId: 'mgmt-pres', blockId: 's2-b2', page: 99, quote: 'fabrication', quoteVerified: true }];
    // Remove other refs to this block so the repaired one is selected deterministically.
    input.extraction = null;
    const graph = buildKnowledgeGraph([input], mockRun.docs);
    expect(graph.nodes.some((node) => node.id.endsWith('#missing'))).toBe(false);
    const node = graph.nodes.find((node) => node.id === 'block:one:mgmt-pres#s2-b2')!;
    expect(node.evidence?.page).toBe(2);
    expect(node.evidence?.quote).not.toBe('fabrication');
  });
  it('merges exact normalized entities across sessions, but namespaces source blocks', () => {
    const a = session('a');
    const b = session('b');
    a.extraction!.profile.contracts[0]!.customer = 'Northgate Health Inc.';
    b.extraction!.profile.contracts[0]!.customer = 'northgate health LLC';
    b.extraction!.profile.contracts[1]!.customer = 'North Gate Health';
    const graph = buildKnowledgeGraph([a, b], mockRun.docs);
    const shared = graph.nodes.filter((node) => node.id === 'entity:northgate-health');
    expect(shared).toHaveLength(1);
    expect(shared[0]!.sessionId).toBeNull();
    expect(shared[0]!.meta.sessionCount).toBe(2);
    expect(graph.nodes.find((node) => node.id === 'entity:north-gate-health')?.meta.shared).toBe(false);
    expect(graph.nodes.filter((node) => node.id.endsWith('mgmt-pres#s4-b2'))).toHaveLength(2);
    expect(graph.stats.sharedEntityCount).toBeGreaterThan(0);
  });
  it('flags cited claim and counter blocks and weights contradiction edges at 3', () => {
    const graph = buildKnowledgeGraph([session()], mockRun.docs);
    expect(graph.stats.contradictionCount).toBe(2);
    for (const finding of graph.nodes.filter((node) => node.type === 'finding')) {
      expect(finding.flagged).toBe(true);
      expect(finding.weight).toBeGreaterThanOrEqual(5);
      for (const edge of graph.edges.filter((edge) => edge.source === finding.id && edge.type === 'cites')) {
        expect(graph.nodes.find((node) => node.id === edge.target)?.flagged).toBe(true);
      }
    }
    for (const edge of graph.edges.filter((edge) => edge.type === 'contradicts')) expect(edge.weight).toBe(3);
    expect(graph.nodes.find((node) => node.type === 'deal')!.weight).toBeGreaterThanOrEqual(8);
  });
  it('never asserts contradictions for consistent or inconclusive findings', () => {
    const input = session();
    input.decision!.crosschecks[0]!.status = 'consistent';
    input.decision!.crosschecks[1]!.status = 'inconclusive';
    const graph = buildKnowledgeGraph([input], mockRun.docs);
    expect(graph.stats.contradictionCount).toBe(0);
    expect(graph.nodes.some((node) => node.flagged)).toBe(false);
    expect(graph.edges.some((edge) => edge.type === 'contradicts')).toBe(false);
  });
  it('does not create blocks for an unrun session', () => {
    const input = { ...session(), extraction: null, benchmark: null, portfolio: null, decision: null, memo: null };
    expect(buildKnowledgeGraph([input], mockRun.docs).nodes.some((node) => node.type === 'block')).toBe(false);
  });
  it('projects labelled historical snapshots with shared live-target entities and valid sources', () => {
    const graph = buildKnowledgeGraph(SEED_SESSIONS, SEED_DOCS);
    expect(graph.stats.nodeCount).toBeGreaterThan(150);
    expect(graph.stats.nodeCount).toBeLessThan(600);
    expect(graph.nodes.find((node) => node.id === 'entity:blackwood-regional-health-network')?.meta.sessionCount).toBe(2);
    expect(graph.nodes.find((node) => node.id === 'entity:cascade-growth-partners')?.meta.sessionCount).toBe(2);
    expect(graph.nodes.filter((node) => node.type === 'deal').every((node) => node.meta.historical)).toBe(true);
    for (const node of graph.nodes.filter((node) => node.type === 'block')) {
      const ref = node.evidence!;
      const block = SEED_DOCS.find((doc) => doc.id === ref.docId)!.blocks.find((block) => block.id === ref.blockId)!;
      expect(block).toBeDefined();
      expect(block.text).toContain(ref.quote);
    }
  });
});
