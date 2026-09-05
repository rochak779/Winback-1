// ============================================================================
// src/components/ingest/document-card.tsx — erd.md Part 6 §6.5
// ============================================================================

'use client';

import { FileTextIcon, LoaderCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEvidenceDrawer } from '@/lib/store/EvidenceDrawerProvider';
import { WORKSTREAM_LABEL } from '@/lib/labels';
import type { DocClassification, SourceDoc } from '@/lib/contracts/types';

export function DocumentCard({
  doc,
  classification,
  status,
}: {
  doc: SourceDoc;
  classification: DocClassification | null;
  status: 'idle' | 'working' | 'done';
}) {
  const { open } = useEvidenceDrawer();
  const firstBlock = doc.blocks[0];

  function preview() {
    if (!firstBlock) return;
    open([{ docId: doc.id, blockId: firstBlock.id, page: firstBlock.page, quote: firstBlock.text, quoteVerified: true }]);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            {doc.title}
          </CardTitle>
          {status === 'working' && <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-stage-active" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <div>
          {doc.filename} · {doc.pages} {doc.pageNoun}
          {doc.pages === 1 ? '' : 's'}
        </div>
        {status === 'working' ? (
          <Skeleton className="h-4 w-24" />
        ) : classification ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{WORKSTREAM_LABEL[classification.workstream] ?? classification.workstream}</Badge>
            <span>{Math.round(classification.confidence * 100)}% confidence</span>
            <span>· {classification.fieldsExtracted} fields</span>
          </div>
        ) : (
          <Badge variant="outline">Unclassified</Badge>
        )}
        <button type="button" onClick={preview} className="text-xs font-medium text-foreground underline-offset-2 hover:underline">
          Preview →
        </button>
      </CardContent>
    </Card>
  );
}
