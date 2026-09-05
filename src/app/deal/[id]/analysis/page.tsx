// ============================================================================
// src/app/deal/[id]/analysis/page.tsx — Screen 3: Benchmark + Portfolio Impact
// (erd.md Part 6 §6.6, session 4.2)
//
// One screen, two panels, both firing in parallel on mount with independent
// loading/error states — neither blocks the other.
// ============================================================================

'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BenchmarkPanel } from '@/components/analysis/benchmark-panel';
import { PortfolioPanel } from '@/components/analysis/portfolio-panel';
import { runBenchmark, runPortfolio } from '@/lib/client/api';
import { useRun, useStage } from '@/lib/store/RunProvider';

function PanelSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
      <p>{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export default function AnalysisPage() {
  const { run, dispatch } = useRun();
  const benchmarkStage = useStage('benchmark');
  const portfolioStage = useStage('portfolio');
  const startedRef = useRef(false);

  const profile = run.extraction?.profile ?? null;
  const dealSizeUsdM = run.deal?.dealSizeUsdM ?? null;

  function startBenchmark() {
    if (!profile) return;
    void runBenchmark(dispatch, profile);
  }

  function startPortfolio() {
    if (!profile || dealSizeUsdM === null) return;
    void runPortfolio(dispatch, profile, dealSizeUsdM);
  }

  useEffect(() => {
    if (startedRef.current) return;
    if (!profile || dealSizeUsdM === null) return;
    startedRef.current = true;
    if (benchmarkStage.status === 'idle') startBenchmark();
    if (portfolioStage.status === 'idle') startPortfolio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, dealSizeUsdM]);

  if (!profile || dealSizeUsdM === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">Run extraction first — benchmarking needs the extracted profile.</p>
        <Button nativeButton={false} render={<Link href={`/deal/${run.id}/ingest`} />}>
          Go to Ingest
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Benchmark + Portfolio Impact</h1>
        <p className="text-sm text-muted-foreground">
          How {profile.name} compares against three peers, and what this deal does to the fund&apos;s sector concentration.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          {benchmarkStage.status === 'running' && <PanelSkeleton />}
          {benchmarkStage.status === 'error' && (
            <ErrorPanel message={benchmarkStage.error?.message ?? 'Benchmark failed.'} onRetry={startBenchmark} />
          )}
          {run.benchmark && benchmarkStage.status === 'done' && <BenchmarkPanel benchmark={run.benchmark} />}
        </div>

        <div>
          {portfolioStage.status === 'running' && <PanelSkeleton />}
          {portfolioStage.status === 'error' && (
            <ErrorPanel message={portfolioStage.error?.message ?? 'Portfolio impact failed.'} onRetry={startPortfolio} />
          )}
          {run.portfolio && portfolioStage.status === 'done' && <PortfolioPanel portfolio={run.portfolio} />}
        </div>
      </div>

      {benchmarkStage.status === 'done' && portfolioStage.status === 'done' && (
        <Button nativeButton={false} render={<Link href={`/deal/${run.id}/decision`} />}>
          Continue to decision →
        </Button>
      )}
    </div>
  );
}
