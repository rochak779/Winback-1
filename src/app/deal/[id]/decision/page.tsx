// ============================================================================
// src/app/deal/[id]/decision/page.tsx — Screen 4: Decision (erd.md Part 6 §6.7)
// ============================================================================

'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CrosscheckCard } from '@/components/decision/crosscheck-card';
import { ComingSoonCard } from '@/components/decision/coming-soon-card';
import { runCrosscheck } from '@/lib/client/api';
import { useRun, useStage } from '@/lib/store/RunProvider';
import type { SourceDocId } from '@/lib/contracts/types';

export default function DecisionPage() {
  const { run, dispatch } = useRun();
  const decisionStage = useStage('decision');
  const startedRef = useRef(false);

  const docIds = run.docs.map((d) => d.id) as SourceDocId[];

  function start() {
    if (!run.extraction) return;
    void runCrosscheck(dispatch, docIds, run.extraction.profile);
  }

  useEffect(() => {
    if (startedRef.current) return;
    if (decisionStage.status !== 'idle') return;
    if (!run.extraction) return;
    startedRef.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionStage.status, run.extraction]);

  if (!run.extraction) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">Run extraction first — the crosscheck needs the extracted profile.</p>
        <Button nativeButton={false} render={<Link href={`/deal/${run.id}/ingest`} />}>
          Go to Ingest
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Decision</h1>
        <p className="text-sm text-muted-foreground">
          Claims cross-checked against the underlying records. WinBack states the gap; the analyst decides what it means.
        </p>
      </div>

      {decisionStage.status === 'running' && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground" role="status">
          Running both crosschecks against the source documents…
        </div>
      )}

      {decisionStage.status === 'error' && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <p>{decisionStage.error?.message ?? 'Crosscheck failed.'}</p>
          <Button variant="outline" size="sm" onClick={start}>
            Retry
          </Button>
        </div>
      )}

      {run.decision && decisionStage.status === 'done' && (
        <>
          <div className="space-y-4">
            {run.decision.crosschecks.map((c) => (
              <CrosscheckCard key={c.id} crosscheck={c} />
            ))}
          </div>

          {run.decision.comingSoon.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Other workstreams</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {run.decision.comingSoon.map((item) => (
                  <ComingSoonCard key={item.workstream} item={item} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
