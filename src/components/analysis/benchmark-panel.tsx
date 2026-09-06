// ============================================================================
// src/components/analysis/benchmark-panel.tsx — erd.md Part 6 §6.6 (left panel)
//
// Three metric rows against three peers. `direction` is descriptive only —
// above/below/inline the peer median, never good/bad (Part 1 Rule 3): an
// above-median EV/EBITDA means the target is expensive, not excellent. The
// legend says exactly that, and every direction chip carries an icon *and*
// a label, never color alone.
// ============================================================================

import { ArrowDownIcon, ArrowUpIcon, EqualIcon, MinusIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DerivedMarker } from '@/components/audit/derived-marker';
import { EvidenceChip } from '@/components/evidence/evidence-chip';
import { BENCHMARK_DIRECTION_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { BenchmarkResult, BenchmarkRow } from '@/lib/contracts/types';

function fmtValue(n: number | null, unit: BenchmarkRow['unit']): string {
  if (n === null) return '—';
  return unit === 'x' ? `${n.toFixed(1)}x` : `${n.toFixed(1)}%`;
}

function directionReason(row: BenchmarkRow): string {
  if (row.metric === 'ev_ebitda_multiple') {
    return "The deal's enterprise value isn't part of the extracted document profile, so this multiple can't be computed for the target.";
  }
  return 'Not stated in the source documents.';
}

function DirectionChip({ direction }: { direction: BenchmarkRow['direction'] }) {
  const base = 'gap-1 border font-normal';
  if (direction === 'above') {
    return (
      <Badge variant="outline" className={cn(base, 'border-above-median/40 bg-above-median/15 text-above-median')}>
        <ArrowUpIcon /> {BENCHMARK_DIRECTION_LABEL.above}
      </Badge>
    );
  }
  if (direction === 'below') {
    return (
      <Badge variant="outline" className={cn(base, 'border-below-median/40 bg-below-median/15 text-below-median')}>
        <ArrowDownIcon /> {BENCHMARK_DIRECTION_LABEL.below}
      </Badge>
    );
  }
  if (direction === 'inline') {
    return (
      <Badge variant="outline" className={cn(base, 'border-inline-median/40 bg-inline-median/15 text-inline-median')}>
        <EqualIcon /> {BENCHMARK_DIRECTION_LABEL.inline}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(base, 'text-muted-foreground')}>
      <MinusIcon /> {BENCHMARK_DIRECTION_LABEL.unknown}
    </Badge>
  );
}

export function BenchmarkPanel({ benchmark }: { benchmark: BenchmarkResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Benchmark</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Target</TableHead>
                {benchmark.peers.map((peer) => (
                  <TableHead key={peer.id} className="text-right">
                    <Tooltip>
                      <TooltipTrigger render={<span className="cursor-default underline decoration-dotted underline-offset-2" tabIndex={0} />}>
                        {peer.name}
                      </TooltipTrigger>
                      <TooltipContent>{peer.descriptor}</TooltipContent>
                    </Tooltip>
                  </TableHead>
                ))}
                <TableHead className="text-right">Median</TableHead>
                <TableHead>vs. median</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {benchmark.rows.map((row) => (
                <TableRow key={row.metric}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right font-bold text-base tabular-nums text-foreground">
                    {row.targetValue === null ? (
                      <Tooltip>
                        <TooltipTrigger render={<span className="cursor-default text-muted-foreground" tabIndex={0} />}>—</TooltipTrigger>
                        <TooltipContent>{directionReason(row)}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {fmtValue(row.targetValue, row.unit)}
                        {row.targetEvidence.length > 0 && <EvidenceChip refs={row.targetEvidence} />}
                      </span>
                    )}
                  </TableCell>
                  {benchmark.peers.map((peer) => {
                    const value = row.peerValues.find((p) => p.peerId === peer.id)?.value ?? null;
                    return (
                      <TableCell key={peer.id} className="text-right tabular-nums text-muted-foreground">
                        {fmtValue(value, row.unit)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    <span className="inline-flex items-center justify-end gap-1">
                      {fmtValue(row.peerMedian, row.unit)}
                      <DerivedMarker
                        formula={`Median of ${row.peerValues.length} peer values`}
                        inputs={row.peerValues.map((pv) => {
                          const peer = benchmark.peers.find((p) => p.id === pv.peerId);
                          return `${peer?.name ?? pv.peerId}: ${fmtValue(pv.value, row.unit)}`;
                        })}
                      />
                    </span>
                  </TableCell>
                  <TableCell>
                    <DirectionChip direction={row.direction} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          &ldquo;Above&rdquo;, &ldquo;below&rdquo;, and &ldquo;in line with&rdquo; describe the target&apos;s position against the peer
          median only — they are not an assessment of quality. An above-median EV/EBITDA means the target is priced richer than its
          peers, not that it is a better business.
        </p>

        {benchmark.commentary && <p className="border-t pt-4 text-sm">{benchmark.commentary}</p>}
      </CardContent>
    </Card>
  );
}
