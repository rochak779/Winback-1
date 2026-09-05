// ============================================================================
// src/app/deal/[id]/ingest/page.tsx — Screen 2: Ingest / Extraction (erd.md Part 6 §6.5)
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DocumentCard } from '@/components/ingest/document-card';
import { ProfileView } from '@/components/ingest/profile-view';
import { fetchDocs, runExtract } from '@/lib/client/api';
import { useRun, useStage } from '@/lib/store/RunProvider';
import type { SourceDocId } from '@/lib/contracts/types';

const LOADING_COPY = ['Classifying documents…', 'Extracting financials and contracts…', 'Reconciling the profile…'];

/**
 * Staged, honest loading copy for the ~10-30s extraction wait (erd.md Part 6
 * §6.5) — never a single centered spinner. Keyed by the stage's `startedAt`
 * so each new run remounts fresh at "Classifying…" instead of needing an
 * imperative reset inside an effect.
 */
function LoadingBanner() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, LOADING_COPY.length - 1)), 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground" role="status">
      {LOADING_COPY[i] ?? LOADING_COPY[0]}
    </div>
  );
}

export default function IngestPage() {
  const { run, dispatch } = useRun();
  const extractStage = useStage('extract');

  const docIds = run.docs.map((d) => d.id) as SourceDocId[];

  function handleExtract() {
    if (docIds.length === 0) return;
    void runExtract(dispatch, docIds);
  }

  if (run.docs.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">The target&apos;s documents haven&apos;t loaded yet.</p>
        <Button onClick={() => void fetchDocs(dispatch)}>Load documents</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Ingest</h1>
        <p className="text-sm text-muted-foreground">Four diligence documents, loaded and ready to extract.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {run.docs.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            classification={run.extraction?.classifications.find((c) => c.docId === doc.id) ?? null}
            status={extractStage.status === 'running' ? 'working' : run.extraction ? 'done' : 'idle'}
          />
        ))}
      </div>

      {extractStage.status === 'idle' && (
        <Button onClick={handleExtract}>Run extraction</Button>
      )}

      {extractStage.status === 'running' && <LoadingBanner key={run.stages.extract.startedAt} />}

      {extractStage.status === 'error' && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p>{extractStage.error?.message ?? 'Extraction failed.'}</p>
          <Button variant="outline" size="sm" onClick={handleExtract}>
            Retry
          </Button>
        </div>
      )}

      {run.extraction && extractStage.status === 'done' && (
        <>
          {run.extraction.failures.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {run.extraction.failures.length} document{run.extraction.failures.length === 1 ? '' : 's'} could not be extracted; showing
              the rest.
            </p>
          )}
          <ProfileView profile={run.extraction.profile} />
          <Button nativeButton={false} render={<Link href={`/deal/${run.id}/analysis`} />}>
            Continue to analysis →
          </Button>
        </>
      )}
    </div>
  );
}
