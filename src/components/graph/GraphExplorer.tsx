'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApiResponseSchema, KnowledgeGraphSchema, NodeTypeSchema } from '@/lib/contracts/schemas';
import type { EvidenceRef, GraphNode, KnowledgeGraph, NodeType, SourceDoc } from '@/lib/contracts/types';
import { EvidenceDrawer } from '@/components/evidence/EvidenceDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GraphCanvas, TYPE_COLORS } from './GraphCanvas';
import styles from './graph.module.css';

const ResponseSchema = ApiResponseSchema(KnowledgeGraphSchema);
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; graph: KnowledgeGraph };
const labelType = (type: string) => type.replaceAll('_', ' ');

export function GraphExplorer({ docs, historical, initialSessionId }: {
  docs: SourceDoc[]; historical: boolean; initialSessionId: string;
}) {
  const [scope, setScope] = useState<'session' | 'all'>('all');
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [hidden, setHidden] = useState<Set<NodeType>>(new Set());
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [evidence, setEvidence] = useState<EvidenceRef | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ scope });
    if (scope === 'session') params.set('sessionId', sessionId);
    if (historical) params.set('demo', '1');
    fetch(`/api/graph?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const body = ResponseSchema.parse(await response.json());
        if (!body.ok) throw new Error(body.error.message);
        if (!response.ok) throw new Error('The graph could not be loaded. Please retry.');
        if (!controller.signal.aborted) setState({ status: 'ready', graph: body.data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load graph.' });
      });
    return () => controller.abort();
  }, [scope, sessionId, historical, reload]);

  const graph = state.status === 'ready' ? state.graph : null;
  const visibleGraph = useMemo(() => {
    if (!graph) return null;
    const nodes = graph.nodes.filter((node) => !hidden.has(node.type));
    const ids = new Set(nodes.map((node) => node.id));
    return { ...graph, nodes, edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) };
  }, [graph, hidden]);
  const matches = useMemo(() => !search.trim() ? [] : (graph?.nodes ?? [])
    .filter((node) => node.label.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 10), [graph, search]);
  const choose = useCallback((node: GraphNode) => {
    setSelected(node);
    if (node.type === 'block' && node.evidence) setEvidence(node.evidence);
  }, []);
  const changeScope = (value: 'session' | 'all') => {
    if (value === scope) return;
    setState({ status: 'loading' }); setSelected(null); setFocusId(null); setSearch(''); setScope(value);
  };
  const selectedLinks = graph?.edges.filter((edge) => edge.source === selected?.id || edge.target === selected?.id) ?? [];

  return <main className={`${styles.root} mx-auto max-w-screen-2xl p-6 lg:p-8`}>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">WinBack · Evidence and connections</p>
        <h1 className="text-3xl font-semibold tracking-tight">Knowledge graph</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Explore the sources, counterparties and findings behind each deal. Hover or focus a node to isolate its neighbourhood.</p>
      </div>
      <Link href="/" className="text-sm underline underline-offset-4">Back to WinBack</Link>
    </header>

    {historical && <aside className="mb-6 rounded-lg border bg-muted p-4 text-sm" aria-label="Historical data notice">
      <strong>Seeded historical examples.</strong> These two fictional completed deals reuse illustrative financials. They are not live pipeline results or your saved analyses. Blackwood Regional Health Network and Cascade Growth Partners also appear in the Kestrel target documents.
    </aside>}

    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex gap-2" role="group" aria-label="Graph scope">
        <Button variant={scope === 'session' ? 'default' : 'outline'} aria-pressed={scope === 'session'} disabled={!sessionId} onClick={() => changeScope('session')}>This deal</Button>
        <Button variant={scope === 'all' ? 'default' : 'outline'} aria-pressed={scope === 'all'} onClick={() => changeScope('all')}>All my deals</Button>
      </div>
      {historical && <label className="flex items-center gap-2 text-sm">Historical deal
        <select className="rounded-lg border bg-background p-2" value={sessionId} onChange={(event) => {
          setSessionId(event.target.value); setSelected(null); setFocusId(null);
          setScope('session'); setState({ status: 'loading' });
        }}>
          <option value="historical-alder">Project Alder · Historical</option>
          <option value="historical-cedar">Project Cedar · Historical</option>
        </select>
      </label>}
      <Button variant="outline" onClick={() => { setFocusId(null); setResetKey((key) => key + 1); }}>Reset view</Button>
      {graph && <p className="ml-auto text-sm tabular-nums text-muted-foreground">{visibleGraph?.nodes.length} / {graph.stats.nodeCount} nodes · {graph.stats.sessionCount} deals · {graph.stats.sharedEntityCount} shared entities · {graph.stats.contradictionCount} inconsistencies</p>}
    </div>

    <div className="grid grid-cols-[minmax(0,1fr)_18rem] gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0 overflow-hidden rounded-xl border bg-card" aria-label="Graph visualization" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && <p role="status" className="p-8 text-muted-foreground">Connecting the cited sources and findings…</p>}
        {state.status === 'error' && <div role="alert" className="space-y-4 p-8">
          <p>{state.message}</p>
          <Button variant="outline" onClick={() => { setState({ status: 'loading' }); setReload((value) => value + 1); }}>Retry</Button>
          {!historical && <p><Link className="underline underline-offset-4" href="/graph?demo=1">Explore the seeded historical graph</Link></p>}
        </div>}
        {graph && <>
          {graph.stats.sessionCount <= 1 && <p className="border-b bg-muted p-4 text-sm">This graph grows as you run more deals. Shared customers, sectors, and counterparties connect across your portfolio.</p>}
          {visibleGraph && visibleGraph.nodes.length > 0 ? <GraphCanvas graph={visibleGraph} onSelect={choose} selectedId={selected?.id ?? null} focusId={focusId} resetKey={resetKey} />
            : <p className="p-8 text-muted-foreground">{graph.nodes.length ? 'All node types are hidden. Enable a type in the legend to show its connections.' : 'No sessions are available for this scope yet.'}</p>}
          <p className="border-t p-3 text-xs text-muted-foreground">Drag nodes to arrange · Drag background to pan · Scroll to zoom · Tab / Enter for details · Double ring: shared across deals · Dashed outline / edge: inconsistency</p>
        </>}
      </section>

      <aside className="min-w-0 space-y-5" aria-label="Graph controls and node details">
        <section className="rounded-xl border p-4">
          <label htmlFor="graph-search" className="mb-2 block text-sm font-medium">Find a connection</label>
          <Input id="graph-search" placeholder="Search node labels…" value={search} onChange={(event) => setSearch(event.target.value)} disabled={!graph} />
          {search.trim() && <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto" aria-label="Search results">
            {matches.length === 0 && <li className="py-2 text-sm text-muted-foreground">No matching nodes.</li>}
            {matches.map((node) => <li key={node.id}><button className="w-full rounded p-2 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" onClick={() => {
              setHidden((previous) => { const next = new Set(previous); next.delete(node.type); return next; });
              setFocusId(node.id); choose(node);
            }}>{node.label}<span className="block text-xs text-muted-foreground">{labelType(node.type)}{node.meta.shared ? ' · Shared' : ''}</span></button></li>)}
          </ul>}
        </section>

        <fieldset className="rounded-xl border p-4">
          <legend className="px-1 text-sm font-medium">Node types</legend>
          <div className="grid grid-cols-2 gap-3">
            {NodeTypeSchema.options.map((type) => <label key={type} className="flex cursor-pointer items-center gap-2 text-xs capitalize">
              <input type="checkbox" checked={!hidden.has(type)} onChange={() => {
                setHidden((previous) => { const next = new Set(previous); if (next.has(type)) next.delete(type); else next.add(type); return next; });
                if (selected?.type === type) { setSelected(null); setFocusId(null); }
              }} />
              <span style={{ color: TYPE_COLORS[type] }} aria-hidden="true">{type === 'finding' || type === 'metric' ? '◆' : ['entity', 'company', 'sector'].includes(type) ? '●' : '■'}</span>
              {labelType(type)}
            </label>)}
          </div>
        </fieldset>

        <section className="rounded-xl border p-4" aria-live="polite" aria-label="Node details">
          <h2 className="text-base font-semibold">{selected ? selected.label : 'Follow the evidence'}</h2>
          {!selected ? <p className="mt-2 text-sm text-muted-foreground">Select a node for its details. Select a source block to open the cited passage.</p> : <>
            <p className="my-2 text-xs capitalize text-muted-foreground">{labelType(selected.type)}{selected.flagged ? ' · Inconsistency identified' : ''}{selected.meta.shared ? ` · Shared across ${selected.meta.sessionCount} deals` : ''}</p>
            <dl className="max-h-64 space-y-3 overflow-y-auto break-words text-sm">
              {Object.entries(selected.meta).filter(([key]) => !['shared', 'sessionCount'].includes(key)).map(([key, value]) => <div key={key}>
                <dt className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</dt><dd>{value === null ? '—' : String(value)}</dd>
              </div>)}
            </dl>
            {selected.evidence && <Button className="mt-4" variant="outline" onClick={() => setEvidence(selected.evidence)}>Open source block</Button>}
            {selected.type === 'document' && <Button className="mt-4" variant="outline" onClick={() => setDocumentId(String(selected.meta.docId))}>Open source document</Button>}
            {selected.href && !historical && !['block', 'document'].includes(selected.type) && <Link className="mt-4 block text-sm underline" href={selected.href}>Open in {selected.type === 'finding' || selected.type === 'memo_section' ? 'Decision' : 'deal'}</Link>}
            {historical && selected.href && !['block', 'document'].includes(selected.type) && <p className="mt-3 text-xs text-muted-foreground">Historical fixture · No live deal page</p>}
            <h3 className="mb-2 mt-4 text-sm font-medium">Connections ({selectedLinks.length})</h3>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
              {selectedLinks.map((edge) => {
                const other = graph?.nodes.find((node) => node.id === (edge.source === selected.id ? edge.target : edge.source));
                return other && <li key={edge.id}><button className="text-left underline underline-offset-4" onClick={() => choose(other)}>{labelType(edge.type)} · {other.label}</button>{edge.label && <span className="block text-muted-foreground">{edge.label}</span>}</li>;
              })}
            </ul>
          </>}
        </section>
      </aside>
    </div>
    <EvidenceDrawer docs={docs} evidence={evidence} docId={documentId} onClose={() => { setEvidence(null); setDocumentId(null); }} />
  </main>;
}
