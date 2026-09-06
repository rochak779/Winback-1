// ============================================================================
// src/components/decision/crosscheck-card.tsx — erd.md Part 6 §6.7
//
// The most important component in the build. Neutral status pill, the
// quantification as the visual centrepiece, and analyst accept/dismiss/edit
// controls that are actually wired to state (Part 1 Rule 3 — WinBack never
// issues a verdict; the analyst stays in the loop).
// ============================================================================

'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { DerivedMarker } from '@/components/audit/derived-marker';
import { EvidenceChip } from '@/components/evidence/evidence-chip';
import { WORKSTREAM_LABEL, CROSSCHECK_STATUS_LABEL } from '@/lib/labels';
import { useRun } from '@/lib/store/RunProvider';
import { recordAuditEvent } from '@/lib/client/api';
import type { Crosscheck } from '@/lib/contracts/types';

function statusBadgeClass(status: Crosscheck['status']): string {
  if (status === 'contradiction_found') return 'border-attention/40 bg-attention/15 text-attention-foreground';
  if (status === 'consistent') return 'border-stage-done/40 bg-stage-done/15 text-stage-done';
  return 'border-border bg-muted text-muted-foreground';
}

export function CrosscheckCard({ crosscheck }: { crosscheck: Crosscheck }) {
  const { run, dispatch } = useRun();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(crosscheck.analystNote ?? crosscheck.suggestedMemoLanguage);

  function setDecision(decision: 'accepted' | 'dismissed') {
    dispatch({ type: 'CROSSCHECK_DECISION', crosscheckId: crosscheck.id, decision });
    recordAuditEvent({
      runId: run.id,
      action: decision === 'accepted' ? 'analyst_accepted' : 'analyst_dismissed',
      stage: 'decision',
      statementId: crosscheck.statementId,
      statementText: crosscheck.explanation,
    });
  }

  function saveEdit() {
    dispatch({ type: 'CROSSCHECK_DECISION', crosscheckId: crosscheck.id, decision: 'accepted', note: draft });
    recordAuditEvent({
      runId: run.id,
      action: 'analyst_edited',
      stage: 'decision',
      statementId: crosscheck.statementId,
      before: crosscheck.analystNote ?? crosscheck.suggestedMemoLanguage,
      after: draft,
    });
    setEditing(false);
  }

  async function copyLanguage() {
    await navigator.clipboard.writeText(crosscheck.analystNote ?? crosscheck.suggestedMemoLanguage);
    toast.success('Copied to clipboard');
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{crosscheck.title}</CardTitle>
          <Badge variant="outline">{WORKSTREAM_LABEL[crosscheck.workstream] ?? crosscheck.workstream}</Badge>
          <Badge variant="outline" className={statusBadgeClass(crosscheck.status)}>
            {CROSSCHECK_STATUS_LABEL[crosscheck.status] ?? crosscheck.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">The claim</p>
          <p className="mt-1 flex flex-wrap items-start gap-1.5 text-sm">
            <span>&ldquo;{crosscheck.claim.text}&rdquo;</span>
            <EvidenceChip refs={crosscheck.claim.evidence} />
          </p>
        </div>

        {crosscheck.counterEvidence.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">What the records show</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {crosscheck.counterEvidence.map((ref, i) => (
                <EvidenceChip
                  key={`${ref.docId}-${ref.blockId}`}
                  refs={crosscheck.counterEvidence}
                  index={i}
                  label={ref.note ?? `Citation ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        {crosscheck.quantification && (
          <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Claimed</div>
              <div className="font-heading text-2xl tabular-nums">
                {crosscheck.quantification.claimedValue}
                {crosscheck.quantification.unit}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Observed</div>
              <div className="inline-flex items-center gap-1 font-heading text-2xl tabular-nums">
                {crosscheck.quantification.observedValue}
                {crosscheck.quantification.unit}
                <DerivedMarker formula={crosscheck.quantification.label} inputs={[crosscheck.quantification.note]} />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Gap</div>
              <div className="font-heading text-2xl tabular-nums text-attention-foreground">
                {Math.abs(crosscheck.quantification.claimedValue - crosscheck.quantification.observedValue).toFixed(1)}
                {crosscheck.quantification.unit}
              </div>
            </div>
            <p className="col-span-3 text-xs text-muted-foreground">{crosscheck.quantification.note}</p>
          </div>
        )}

        <p className="text-sm">{crosscheck.explanation}</p>
        <p className="text-xs text-muted-foreground">Model severity hint: {crosscheck.severityHint}</p>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Suggested memo language</p>
          {editing ? (
            <div className="mt-1 space-y-2">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <p>{crosscheck.analystNote ?? crosscheck.suggestedMemoLanguage}</p>
              <Button size="icon-sm" variant="ghost" onClick={copyLanguage} aria-label="Copy suggested language">
                <CopyIcon />
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={crosscheck.analystDecision === 'accepted' ? 'default' : 'outline'}
            onClick={() => setDecision('accepted')}
          >
            <CheckIcon /> Accept into memo
          </Button>
          <Button
            size="sm"
            variant={crosscheck.analystDecision === 'dismissed' ? 'default' : 'outline'}
            onClick={() => setDecision('dismissed')}
          >
            <XIcon /> Dismiss
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {crosscheck.analystDecision !== 'pending' && (
            <span className="text-xs text-muted-foreground">
              {crosscheck.analystDecision === 'accepted' ? 'Accepted' : 'Dismissed'} by analyst
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
