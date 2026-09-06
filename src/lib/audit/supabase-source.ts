// ============================================================================
// Supabase-backed AuditSource (Task 13's read.ts DI seam) — erd.md Part 9.5
// ============================================================================

import type { AuditEntry } from '@/lib/contracts/types';
import type { AuditSource } from '@/lib/audit/read';
import { getUserId } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export function toEntry(row: Record<string, unknown>): AuditEntry {
  return {
    id: row.id as string,
    sessionId: row.run_id as string,
    userId: row.user_id as string,
    at: row.at as string,
    actor: row.actor as AuditEntry['actor'],
    action: row.action as AuditEntry['action'],
    stage: (row.stage as AuditEntry['stage']) ?? null,
    statementId: (row.statement_id as string | null) ?? null,
    statementText: (row.statement_text as string | null) ?? null,
    evidence: (row.evidence as AuditEntry['evidence']) ?? [],
    provenance: (row.provenance as AuditEntry['provenance']) ?? null,
    before: (row.before as string | null) ?? null,
    after: (row.after as string | null) ?? null,
    note: (row.note as string | null) ?? null,
  };
}

export async function buildAuditSource(): Promise<AuditSource> {
  const supabase = await createServerSupabaseClient();
  return {
    getUserId,
    getRun: async (id) => {
      const { data, error } = await supabase.from('runs').select('id, user_id').eq('id', id).maybeSingle();
      if (error) throw new Error('Failed to load run: ' + error.message);
      return data ? { id: data.id, userId: data.user_id } : null;
    },
    listAuditEntries: async (runId, { limit, cursor, action }) => {
      let query = supabase.from('run_audit').select('*').eq('run_id', runId).order('id', { ascending: false }).limit(limit);
      if (cursor) query = query.lt('id', cursor);
      if (action) query = query.eq('action', action);
      const { data, error } = await query;
      if (error) throw new Error('Failed to load audit entries: ' + error.message);
      return (data ?? []).map(toEntry);
    },
  };
}
