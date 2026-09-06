// ============================================================================
// src/components/audit/audit-timeline.tsx — erd.md Part 9.6
//
// Reverse-chronological (the API already returns newest-first). Renders
// standalone against a runId — no dependency on the client-side Run object,
// so it works even after sign-out/sign-in on a fresh browser.
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AuditListResponseSchema } from '@/lib/contracts/schemas';
import type { AuditAction, AuditEntry } from '@/lib/contracts/types';
import { AUDIT_ACTION_LABEL, ACTOR_LABEL } from '@/lib/labels';

const ACTOR_FILTERS = ['all', 'system', 'model', 'analyst'] as const;

function actorBadgeClass(actor: AuditEntry['actor']): string {
  if (actor === 'analyst') return 'border-primary/40 bg-primary/15 text-primary';
  if (actor === 'model') return 'border-attention/40 bg-attention/15 text-attention-foreground';
  return 'border-border bg-muted text-muted-foreground';
}

export function AuditTimeline({ runId }: { runId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actorFilter, setActorFilter] = useState<(typeof ACTOR_FILTERS)[number]>('all');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const qs = actionFilter === 'all' ? '' : `?action=${actionFilter}`;
        const res = await fetch(`/api/runs/${runId}/audit${qs}`);
        const json = await res.json();
        const parsed = AuditListResponseSchema.safeParse(json);
        if (cancelled) return;
        if (!parsed.success || !parsed.data.ok) {
          setError('Could not load the audit trail.');
          return;
        }
        setEntries(parsed.data.data.entries);
      } catch {
        if (!cancelled) setError('Could not load the audit trail.');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [runId, actionFilter]);

  async function exportTrail() {
    window.open(`/api/runs/${runId}/audit/export`, '_blank');
  }

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (entries === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const visible = actorFilter === 'all' ? entries : entries.filter((e) => e.actor === actorFilter);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No activity yet. Every extraction, comparison, and analyst decision will be recorded here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={actorFilter} onValueChange={(v) => setActorFilter(v as (typeof ACTOR_FILTERS)[number])}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Actor" />
          </SelectTrigger>
          <SelectContent>
            {ACTOR_FILTERS.map((a) => (
              <SelectItem key={a} value={a}>
                {a === 'all' ? 'All actors' : ACTOR_LABEL[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as AuditAction | 'all')}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportTrail}>
          Export
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries match the current filters.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((entry) => (
            <li key={entry.id} className="rounded-lg border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(entry.at).toLocaleString()}</span>
                <Badge variant="outline" className={actorBadgeClass(entry.actor)}>
                  {ACTOR_LABEL[entry.actor]}
                </Badge>
                <span>{AUDIT_ACTION_LABEL[entry.action] ?? entry.action}</span>
                {entry.stage && <span>· {entry.stage}</span>}
              </div>
              {entry.statementText && <p className="mt-1 text-sm">{entry.statementText}</p>}
              {entry.note && <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>}
              {(entry.before || entry.after) && (
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                  {entry.before && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Before:</span> {entry.before}
                    </p>
                  )}
                  {entry.after && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">After:</span> {entry.after}
                    </p>
                  )}
                </div>
              )}
              {entry.provenance && (
                <details className="mt-1 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Provenance</summary>
                  <p>Produced by: {entry.provenance.producedBy}</p>
                  <p>Prompt version: {entry.provenance.promptVersion ?? '—'}</p>
                  <p>Input hash: {entry.provenance.inputHash}</p>
                  <p>Latency: {entry.provenance.latencyMs !== null ? `${entry.provenance.latencyMs}ms` : '—'}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
