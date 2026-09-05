import type { EvidenceRef, GraphEdge, GraphNode, KnowledgeGraph, NodeType, SourceDoc } from '@/lib/contracts/types';
import type { GraphSession } from './types';

/** Legal forms only. Domain words (health, partners, group, holdings) are retained. */
export const LEGAL_FORM_SUFFIXES = ['inc', 'llc', 'ltd', 'corp', 'co', 'plc'] as const;

export function normalizeEntitySlug(name: string): string {
  const words = name.toLowerCase().replace(/[.'’]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/).filter(Boolean);
  while (words.length > 1 && LEGAL_FORM_SUFFIXES.some((suffix) => suffix === words.at(-1))) words.pop();
  return words.join('-');
}

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const evidenceKey = (ref: EvidenceRef): `${EvidenceRef["docId"]}#${string}` => `${ref.docId}#${ref.blockId}`;

/** Pure projection: no clock, randomness, I/O, runtime dependencies, or input mutation. */
export function buildKnowledgeGraph(sessions: readonly GraphSession[], docs: readonly SourceDoc[]): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const membership = new Map<string, Set<string>>();
  const documents = new Map(docs.map((doc) => [doc.id, doc]));
  const blocks = new Map(docs.flatMap((doc) => doc.blocks.map((block) => [`${doc.id}#${block.id}`, block] as const)));
  const ordered = [...sessions].sort((a, b) => compare(a.id, b.id));

  function node(id: string, type: NodeType, label: string, sessionId: string, options: Partial<GraphNode> = {}) {
    const shared = type === 'company' || type === 'sector' || type === 'entity';
    const existing = nodes.get(id);
    if (!existing) nodes.set(id, {
      id, type, label, sessionId: shared ? null : sessionId, href: null,
      evidence: null, weight: 0, flagged: false, meta: {}, ...options,
    });
    else {
      // Stable canonical spelling even when input arrays are reordered.
      if (compare(label, existing.label) < 0) existing.label = label;
      existing.flagged ||= options.flagged ?? false;
      if (options.evidence && (!existing.evidence || compare(JSON.stringify(options.evidence), JSON.stringify(existing.evidence)) < 0)) {
        existing.evidence = options.evidence;
      }
    }
    if (!membership.has(id)) membership.set(id, new Set());
    membership.get(id)!.add(sessionId);
    return id;
  }

  function edge(source: string, target: string, type: GraphEdge['type'], label: string | null = null) {
    if (!nodes.has(source) || !nodes.has(target) || source === target) return;
    const id = JSON.stringify([type, source, target]);
    edges.set(id, { id, source, target, type, weight: type === 'contradicts' ? 3 : 1, label });
  }

  for (const session of ordered) {
    const sid = session.id;
    const base = `/deal/${encodeURIComponent(sid)}`;
    const deal = node(`deal:${sid}`, 'deal', session.deal.name, sid, {
      href: base, meta: { historical: session.historical ?? false, targetCompany: session.deal.targetCompany },
    });
    const company = (name: string, sector: string) => {
      if (!normalizeEntitySlug(name)) return null;
      const id = node(`company:${normalizeEntitySlug(name)}`, 'company', name, sid);
      if (normalizeEntitySlug(sector)) {
        const sectorId = node(`sector:${normalizeEntitySlug(sector)}`, 'sector', sector, sid);
        edge(id, sectorId, 'same_sector');
      }
      return id;
    };
    const profile = session.extraction?.profile;
    const target = company(profile?.name ?? session.deal.targetCompany, profile?.sector ?? session.deal.sector);
    if (target) edge(deal, target, 'belongs_to');
    if (session.deal.thesis.trim()) {
      const thesis = node(`thesis:${sid}`, 'thesis', session.deal.thesis, sid, { href: base });
      edge(thesis, deal, 'belongs_to');
    }
    for (const doc of docs) {
      const id = node(`doc:${sid}:${doc.id}`, 'document', doc.title, sid, {
        href: `${base}/ingest?docId=${encodeURIComponent(doc.id)}`, meta: { docId: doc.id, pages: doc.pages },
      });
      edge(id, deal, 'belongs_to');
    }

    function cite(ref: EvidenceRef, flagged = false): string | null {
      const block = blocks.get(evidenceKey(ref));
      const doc = documents.get(ref.docId);
      if (!block || !doc) return null;
      // Resolve the source again: never display a fabricated quote from stale saved data.
      const verified = ref.quote.length > 0 && block.text.includes(ref.quote);
      const evidence: EvidenceRef = {
        docId: ref.docId, blockId: ref.blockId, page: block.page,
        quote: verified ? ref.quote : block.text.slice(0, 160), quoteVerified: verified,
      };
      const id = node(`block:${sid}:${evidenceKey(ref)}`, 'block', block.section ?? `${doc.pageNoun} ${block.page} · ${block.id}`, sid, {
        evidence, flagged, href: `${base}/ingest?docId=${encodeURIComponent(ref.docId)}&blockId=${encodeURIComponent(ref.blockId)}`,
        meta: { docId: doc.id, blockId: block.id, page: block.page, text: block.text },
      });
      edge(id, `doc:${sid}:${ref.docId}`, 'belongs_to');
      return id;
    }

    // Walk only citation-bearing fields; no text mining and no uncited blocks.
    function collect(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(collect); return; }
      for (const [key, child] of Object.entries(value)) {
        if (/evidence$/i.test(key) && Array.isArray(child)) child.forEach((ref: EvidenceRef) => cite(ref));
        else collect(child);
      }
    }
    [session.extraction, session.benchmark, session.portfolio, session.decision, session.memo].forEach(collect);

    function entity(name: string, refs: EvidenceRef[]) {
      const slug = normalizeEntitySlug(name);
      if (!slug) return;
      const id = node(`entity:${slug}`, 'entity', name, sid);
      if (target) edge(id, target, 'counterparty_of');
      for (const ref of refs) { const block = cite(ref); if (block) edge(block, id, 'mentions'); }
    }
    profile?.contracts.forEach((row) => entity(row.customer, row.evidence));
    profile?.capTable.forEach((row) => entity(row.holder, row.evidence));
    profile?.optionGrants.forEach((row) => entity(row.grantee, row.evidence));

    for (const peer of session.benchmark?.peers ?? []) {
      const id = company(peer.name, peer.sector);
      if (id && target) edge(target, id, 'compares_to');
    }
    for (const holding of session.portfolio?.portfolio ?? []) {
      const id = company(holding.name, holding.sector);
      if (id) edge(id, deal, 'held_in');
    }
    for (const row of session.benchmark?.rows ?? []) {
      const id = node(`metric:${sid}:${row.metric}`, 'metric', row.label, sid, {
        href: `${base}/analysis`, meta: { targetValue: row.targetValue, peerMedian: row.peerMedian, unit: row.unit, direction: row.direction },
      });
      edge(id, deal, 'belongs_to');
      for (const ref of row.targetEvidence) { const block = cite(ref); if (block) edge(id, block, 'derived_from'); }
    }
    for (const row of session.portfolio?.concentrations ?? []) {
      const id = node(`metric:${sid}:concentration:${normalizeEntitySlug(row.sector)}`, 'metric', `${row.sector} concentration`, sid, {
        href: `${base}/analysis`, meta: { beforePct: row.beforePct, afterPct: row.afterPct, deltaPct: row.deltaPct },
      });
      edge(id, deal, 'belongs_to');
      // Concentrations have no block citations in the frozen contract. Do not invent any.
    }
    const findings = session.decision?.crosschecks ?? [];
    for (const finding of findings) {
      const flagged = finding.status === 'contradiction_found';
      const id = node(`finding:${sid}:${finding.id}`, 'finding', finding.title, sid, {
        flagged, href: `${base}/decision#${finding.id}`,
        meta: { status: finding.status, explanation: finding.explanation, analystDecision: finding.analystDecision },
      });
      edge(id, deal, 'belongs_to');
      const claims = finding.claim.evidence.map((ref) => cite(ref, flagged)).filter((id): id is string => id !== null);
      const counters = finding.counterEvidence.map((ref) => cite(ref, flagged)).filter((id): id is string => id !== null);
      for (const block of [...claims, ...counters]) edge(id, block, 'cites');
      if (flagged) for (const claim of claims) for (const counter of counters) edge(claim, counter, 'contradicts');
    }
    for (const section of session.memo?.sections ?? []) {
      const id = node(`memo:${sid}:${section.id}`, 'memo_section', section.heading, sid, {
        href: `${base}/decision#memo-${section.id}`, meta: { body: section.body, edited: section.edited },
      });
      edge(id, deal, 'belongs_to');
      const cited = new Set(section.evidence.map((ref) => cite(ref)).filter((id): id is string => id !== null));
      for (const block of cited) edge(id, block, 'cites');
      // The contract has no finding IDs on a memo section: link shared source blocks only.
      for (const finding of findings) {
        if ([...finding.claim.evidence, ...finding.counterEvidence].some((ref) => cited.has(`block:${sid}:${evidenceKey(ref)}`))) {
          edge(id, `finding:${sid}:${finding.id}`, 'supports', 'Shared cited evidence');
        }
      }
    }
  }

  for (const { source, target } of edges.values()) { nodes.get(source)!.weight++; nodes.get(target)!.weight++; }
  for (const n of nodes.values()) {
    n.weight = Math.max(n.weight, n.type === 'deal' ? 8 : n.type === 'finding' ? 5 : 1);
    n.meta.sessionCount = membership.get(n.id)!.size;
    n.meta.shared = membership.get(n.id)!.size > 1;
  }
  const nodeList = [...nodes.values()].sort((a, b) => compare(a.id, b.id));
  const edgeList = [...edges.values()].sort((a, b) => compare(a.id, b.id));
  const sessionIds = [...new Set(ordered.map((session) => session.id))];
  return {
    nodes: nodeList, edges: edgeList, sessionIds,
    // Content timestamp, not wall-clock time, preserves byte-identical output.
    generatedAt: ordered.map((session) => session.updatedAt).sort(compare).at(-1) ?? '1970-01-01T00:00:00.000Z',
    stats: {
      nodeCount: nodeList.length, edgeCount: edgeList.length, sessionCount: sessionIds.length,
      contradictionCount: nodeList.filter((n) => n.type === 'finding' && n.flagged).length,
      sharedEntityCount: nodeList.filter((n) => n.type === 'entity' && n.meta.shared).length,
    },
  };
}
