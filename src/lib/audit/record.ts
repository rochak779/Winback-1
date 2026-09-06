//
// The only place anything is written to `run_audit` (erd.md Part 9.3). Two
// deliberate departures from the literal spec text, both explained in the
// plan's Global Constraints: this is awaited by its caller (not `void`'d),
// and it targets Postgres/Supabase, not a Firestore subcollection.

import { nanoid } from 'nanoid';
import type { Actor, AuditAction, EvidenceRef, Provenance, Stage } from '@/lib/contracts/types';

/** Minimal Supabase surface this module needs — mirrors src/lib/org/invites.ts's
 * InvitesSupabaseLike so this stays unit-testable without a live database. */
export interface AuditSupabaseLike {
  from(table: string): {
    upsert: (row: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
  };
}

export interface AuditEntryDraft {
  runId: string;
  userId: string;
  actor: Actor;
  action: AuditAction;
  stage: Stage | null;
  statementId?: string | null;
  statementText?: string | null;
  evidence?: EvidenceRef[];
  provenance?: Provenance | null;
  before?: string | null;
  after?: string | null;
  note?: string | null;
}

/** `${Date.now().toString(36)}-${nanoid(6)}` — sortable lexicographically by
 * time (erd.md §9.2), so `run_audit` never needs a separate time index. */
export function newAuditId(): string {
  return `${Date.now().toString(36)}-${nanoid(6)}`;
}

async function ensureRun(supabase: AuditSupabaseLike, runId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('runs')
    .upsert({ id: runId, user_id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) console.error('[winback] audit: failed to ensure run row', error.message);
}

function toRow(entry: AuditEntryDraft): Record<string, unknown> {
  return {
    id: newAuditId(),
    run_id: entry.runId,
    user_id: entry.userId,
    actor: entry.actor,
    action: entry.action,
    stage: entry.stage,
    statement_id: entry.statementId ?? null,
    statement_text: entry.statementText ?? null,
    evidence: entry.evidence ?? [],
    provenance: entry.provenance ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    note: entry.note ?? null,
  };
}

/**
 * Writes one or more audit entries. Never throws — a failed audit write must
 * never fail a pipeline call (erd.md §9.3's availability-over-completeness
 * tradeoff); errors are logged and swallowed instead.
 */
export async function recordAudit(supabase: AuditSupabaseLike, entries: AuditEntryDraft | AuditEntryDraft[]): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;
  try {
    await ensureRun(supabase, list[0]!.runId, list[0]!.userId);
    const { error } = await supabase.from('run_audit').insert(list.map(toRow));
    if (error) console.error('[winback] audit: failed to write entries', error.message);
  } catch (err) {
    console.error('[winback] audit: unexpected failure', err);
  }
}
