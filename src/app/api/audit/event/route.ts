// ============================================================================
// POST /api/audit/event — erd.md Part 9.1 Guarantee 2 (client-originated half)
//
// The only audit actions a client is trusted to self-report: analyst
// accept/dismiss/edit, memo status changes, and "viewed a previously-run
// deal". Stage lifecycle and statement_generated are always server-computed
// (see the five pipeline routes) — a client can never fabricate those here,
// because AuditEventRequestSchema's `action` is restricted to
// AuditClientActionSchema, a strict subset of AuditActionSchema.
// ============================================================================

import { AuditEventRequestSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiSuccess, parseBody, withRoute } from '@/lib/pipeline/http';
import { recordAudit, type AuditSupabaseLike } from '@/lib/audit/record';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/audit/event', 'standard', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, AuditEventRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { runId, action, stage, statementId, statementText, before, after, note } = parsed.data;
    const supabaseClient = await createServerSupabaseClient();
    const supabase = supabaseClient as unknown as AuditSupabaseLike;
    await recordAudit(supabase, {
      runId,
      userId,
      actor: 'analyst',
      action,
      stage,
      statementId,
      statementText,
      before,
      after,
      note,
    });

    const meta: ApiMeta = { ms: Date.now() - started, model: 'none', mock: false };
    return apiSuccess({ recorded: true as const }, meta);
  });
}
