'use client';

import { useEffect, useRef } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { drag } from 'd3-drag';
import type { GraphNode, KnowledgeGraph, NodeType } from '@/lib/contracts/types';
import styles from './graph.module.css';

type PositionedNode = GraphNode & SimulationNodeDatum;
type PositionedLink = SimulationLinkDatum<PositionedNode> & { type: KnowledgeGraph['edges'][number]['type']; weight: number };
const WIDTH = 960;
const HEIGHT = 640;
const radius = (node: GraphNode) => Math.min(22, 5 + Math.sqrt(node.weight) * 2);

export const TYPE_COLORS: Record<NodeType, string> = {
  deal: 'var(--primary)', company: 'var(--chart-5)', sector: 'var(--chart-3)',
  document: 'var(--chart-2)', block: 'var(--chart-1)', entity: 'var(--chart-4)',
  metric: 'var(--chart-3)', finding: 'var(--primary)', memo_section: 'var(--chart-4)', thesis: 'var(--chart-2)',
};

export function GraphCanvas({ graph, selectedId, focusId, resetKey, onSelect }: {
  graph: KnowledgeGraph; selectedId: string | null; focusId: string | null;
  resetKey: number; onSelect: (node: GraphNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const controls = useRef<{ focus: (id: string) => void; reset: () => void } | null>(null);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const svg = select(element);
    const viewport = svg.select<SVGGElement>('[data-viewport]');
    viewport.selectAll('*').remove();
    const nodes: PositionedNode[] = graph.nodes.map((node) => ({ ...node }));
    // d3 mutates source/target and position fields: never pass contract objects to it.
    const links: PositionedLink[] = graph.edges.map((edge) => ({ ...edge }));
    const simulation = forceSimulation(nodes)
      .force('link', forceLink<PositionedNode, PositionedLink>(links).id((node) => node.id)
        .distance((edge) => edge.type === 'same_sector' ? 140 : edge.type === 'cites' ? 40 : 75))
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', forceCollide<PositionedNode>((node) => radius(node) + 5))
      .stop();

    const lines = viewport.append('g').attr('aria-hidden', 'true').selectAll('line').data(links).join('line')
      .attr('stroke', (edge) => edge.type === 'contradicts' ? 'var(--attention)' : 'var(--border)')
      .attr('stroke-width', (edge) => edge.weight)
      .attr('stroke-dasharray', (edge) => edge.type === 'contradicts' ? '6 3' : null)
      .attr('data-edge-type', (edge) => edge.type);
    const groups = viewport.append('g').selectAll<SVGGElement, PositionedNode>('g').data(nodes).join('g')
      .attr('class', styles.node ?? '').attr('role', 'button').attr('tabindex', 0)
      .attr('data-node-id', (node) => node.id).attr('data-node-type', (node) => node.type)
      .attr('aria-label', (node) => `${node.label}, ${node.type.replaceAll('_', ' ')}${node.flagged ? ', inconsistency identified' : ''}${node.meta.shared ? ', shared across deals' : ''}`)
      .attr('aria-pressed', 'false').style('cursor', 'pointer');

    // Neighbourhood highlighting is independent of selection and never rebuilds the simulation.
    const neighbours = new Map(nodes.map((node) => [node.id, new Set([node.id])]));
    for (const edge of graph.edges) {
      neighbours.get(edge.source)?.add(edge.target);
      neighbours.get(edge.target)?.add(edge.source);
    }
    function highlight(id: string | null) {
      groups.attr('opacity', (node) => !id || neighbours.get(id)?.has(node.id) ? 1 : 0.12);
      lines.attr('opacity', (edge) => !id || (edge.source as PositionedNode).id === id || (edge.target as PositionedNode).id === id ? 1 : 0.08);
      groups.select('text').attr('visibility', (node) => !id ? node.weight >= 8 ? 'visible' : 'hidden' : neighbours.get(id)?.has(node.id) ? 'visible' : 'hidden');
    }
    groups.on('mouseenter', (_, node) => highlight(node.id)).on('mouseleave', () => highlight(null))
      .on('focus', (_, node) => highlight(node.id)).on('blur', () => highlight(null))
      .on('click', (event: MouseEvent, node) => { if (!event.defaultPrevented) onSelect(node); })
      .on('keydown', (event: KeyboardEvent, node) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node); }
      });
    groups.append('circle').attr('r', (node) => radius(node) + 7).attr('fill', 'none')
      .attr('stroke', 'var(--ring)').attr('stroke-width', 2).attr('data-shared-ring', '')
      .attr('visibility', (node) => node.meta.shared ? 'visible' : 'hidden');
    groups.append('path').attr('d', (node) => {
      const r = radius(node);
      if (node.type === 'finding' || node.type === 'metric') return `M0,${-r}L${r},0L0,${r}L${-r},0Z`;
      if (['deal', 'document', 'block', 'memo_section', 'thesis'].includes(node.type)) return `M${-r},${-r}H${r}V${r}H${-r}Z`;
      return `M${-r},0a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
    }).attr('fill', (node) => TYPE_COLORS[node.type])
      .attr('stroke', (node) => node.flagged ? 'var(--attention)' : 'var(--foreground)')
      .attr('stroke-width', (node) => node.flagged ? 3 : 0.5)
      .attr('stroke-dasharray', (node) => node.flagged ? '3 2' : null);
    groups.append('text').text((node) => node.label.length > 32 ? `${node.label.slice(0, 30)}…` : node.label)
      .attr('y', (node) => radius(node) + 17).attr('text-anchor', 'middle')
      .attr('fill', 'var(--foreground)').attr('font-size', 11).attr('pointer-events', 'none')
      .attr('paint-order', 'stroke').attr('stroke', 'var(--background)').attr('stroke-width', 3);
    groups.append('title').text((node) => `${node.label}\n${node.type.replaceAll('_', ' ')}${node.meta.shared ? ` · ${node.meta.sessionCount} deals` : ''}`);

    function paint() {
      lines.attr('x1', (edge) => (edge.source as PositionedNode).x ?? 0).attr('y1', (edge) => (edge.source as PositionedNode).y ?? 0)
        .attr('x2', (edge) => (edge.target as PositionedNode).x ?? 0).attr('y2', (edge) => (edge.target as PositionedNode).y ?? 0);
      groups.attr('transform', (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);
    }
    // Bounded initial layout: manual ticks have no background timer, including under Strict Mode.
    simulation.tick(300);
    paint();
    highlight(null);
    let dragTicks = 0;
    simulation.on('tick', () => { paint(); if (++dragTicks >= 80) simulation.stop(); });
    groups.call(drag<SVGGElement, PositionedNode>()
      .on('start', (event, node) => {
        if (!event.active) { dragTicks = 0; simulation.alpha(0.15).alphaTarget(0).restart(); }
        node.fx = node.x; node.fy = node.y;
      })
      .on('drag', (event, node) => { node.fx = event.x; node.fy = event.y; node.x = event.x; node.y = event.y; paint(); })
      .on('end', (_, node) => { node.fx = null; node.fy = null; }));

    const zoomer: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [WIDTH, HEIGHT]]).scaleExtent([0.1, 5])
      .on('zoom', (event) => viewport.attr('transform', event.transform.toString()));
    svg.call(zoomer).on('dblclick.zoom', null);
    svg.on('keydown.graph', (event: KeyboardEvent) => {
      if (event.target !== element) return;
      const pan: Record<string, [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
      const delta = pan[event.key];
      if (delta) { event.preventDefault(); svg.call(zoomer.translateBy, ...delta); }
      if (event.key === '+' || event.key === '=' || event.key === '-') {
        event.preventDefault(); svg.call(zoomer.scaleBy, event.key === '-' ? 0.8 : 1.25);
      }
    });
    function reset() {
      const minX = Math.min(...nodes.map((node) => node.x ?? 0), 0);
      const maxX = Math.max(...nodes.map((node) => node.x ?? 0), WIDTH);
      const minY = Math.min(...nodes.map((node) => node.y ?? 0), 0);
      const maxY = Math.max(...nodes.map((node) => node.y ?? 0), HEIGHT);
      const scale = Math.max(0.1, Math.min(1, WIDTH / (maxX - minX + 100), HEIGHT / (maxY - minY + 100)));
      svg.call(zoomer.transform, zoomIdentity.translate(WIDTH / 2, HEIGHT / 2).scale(scale).translate(-(minX + maxX) / 2, -(minY + maxY) / 2));
    }
    controls.current = {
      reset,
      focus: (id) => {
        const node = nodes.find((node) => node.id === id);
        if (!node) return;
        svg.call(zoomer.transform, zoomIdentity.translate(WIDTH / 2, HEIGHT / 2).scale(1.4).translate(-(node.x ?? 0), -(node.y ?? 0)));
        highlight(id);
      },
    };
    reset();
    return () => {
      simulation.stop(); controls.current = null;
      svg.on('.zoom', null).on('.graph', null); groups.on('.drag', null); viewport.selectAll('*').remove();
    };
  }, [graph, onSelect]);

  useEffect(() => {
    select(svgRef.current).selectAll<SVGGElement, PositionedNode>('[data-node-id]')
      .attr('aria-pressed', (node) => String(node.id === selectedId));
  }, [selectedId, graph]);
  useEffect(() => { if (focusId) controls.current?.focus(focusId); }, [focusId, graph]);
  useEffect(() => { controls.current?.reset(); }, [resetKey]);

  return <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.canvas} tabIndex={0}
    role="group" aria-label="Knowledge graph. Arrow keys pan, plus and minus zoom. Tab to nodes, Enter for details. Drag the background to pan and scroll to zoom.">
    <g data-viewport="" />
  </svg>;
}
