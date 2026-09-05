// ============================================================================
// src/components/analysis/portfolio-panel.tsx — erd.md Part 6 §6.6 (right panel)
//
// The GP's 5 existing companies, then sector concentration before vs. after
// this deal as a paired bar per sector — target sector emphasised, delta
// called out. `headline` sits above in large type; it's the panel's
// takeaway and should be readable from across a room.
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { PortfolioImpact } from '@/lib/contracts/types';

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtUsdM(n: number): string {
  return `$${n}m`;
}

function ConcentrationBar({ label, pct, emphasized }: { label: string; pct: number; emphasized: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', emphasized ? 'bg-primary' : 'bg-foreground/60')}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmtPct(pct)}</span>
    </div>
  );
}

export function PortfolioPanel({ portfolio }: { portfolio: PortfolioImpact }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio impact</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {portfolio.headline && <p className="font-heading text-xl leading-snug font-semibold tracking-tight">{portfolio.headline}</p>}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Deal size</TableHead>
                <TableHead className="text-right">Vintage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolio.portfolio.map((co) => (
                <TableRow key={co.id}>
                  <TableCell className="font-medium">{co.name}</TableCell>
                  <TableCell className="text-muted-foreground">{co.sector}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtUsdM(co.dealSizeUsdM)}</TableCell>
                  <TableCell className="text-right tabular-nums">{co.vintageYear}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Sector concentration of committed capital</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-foreground/60" /> Before
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary" /> After (target sector)
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {portfolio.concentrations.map((c) => (
              <div key={c.sector} className={cn('space-y-1 rounded-lg px-2 py-1.5', c.isTargetSector && 'bg-muted/50 ring-1 ring-border')}>
                <div className="flex items-center justify-between">
                  <span className={cn('text-sm', c.isTargetSector ? 'font-semibold' : 'text-muted-foreground')}>{c.sector}</span>
                  {c.isTargetSector && (
                    <span className="text-xs font-medium tabular-nums text-primary">
                      {c.deltaPct >= 0 ? '+' : ''}
                      {fmtPct(c.deltaPct)}
                    </span>
                  )}
                </div>
                <ConcentrationBar label="Before" pct={c.beforePct} emphasized={false} />
                <ConcentrationBar label="After" pct={c.afterPct} emphasized={c.isTargetSector} />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
