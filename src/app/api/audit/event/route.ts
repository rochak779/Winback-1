// ============================================================================
// POST /api/audit/event — erd.md Part 9.1 Guarantee 2 (client-originated half)
//
// The only audit actions THIS ROUTE will accept from a client: analyst
// accept/dismiss/edit, memo status changes, and "viewed a previously-run
// deal". Stage lifecycle and statement_generated are always server-computed
// by the five pipeline routes — this route's AuditEventRequestSchema
// restricts `action` to AuditClientActionSchema, a strict subset of
// AuditActionSchema, so a request through THIS endpoint can't claim one of
// those. This is a route-level boundary, not a database-level one: run_audit
// grants INSERT to the authenticated role via RLS (owner-only), so a client
// calling PostgREST directly, bypassing this route, could still insert an
// arbitrary action/actor/provenance for a run it owns. Consistent with the
// audit page's own disclosed caveat — "not tamper-proof, not a
// compliance-grade audit log" — this system does not currently close that
// gap; closing it would mean revoking direct INSERT on run_audit and
// routing all writes through a security-definer RPC or a service-role
// client instead.
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
