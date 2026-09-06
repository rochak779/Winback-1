import { MemoRequestSchema, MemoResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { runMemo } from '@/lib/pipeline/memo';
import { recordAudit, type AuditSupabaseLike } from '@/lib/audit/record';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/memo', 'llm', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, MemoRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { runId, deal, profile, benchmark, portfolio, crosschecks } = parsed.data;
    const supabaseClient = await createServerSupabaseClient();
    const supabase = supabaseClient as unknown as AuditSupabaseLike;
    await recordAudit(supabase, { runId, userId, actor: 'system', action: 'stage_started', stage: 'memo' });

    let result;
    try {
      result = await runMemo(deal, profile, benchmark, portfolio, crosschecks);
    } catch (err) {
      await recordAudit(supabase, {
        runId, userId, actor: 'system', action: 'stage_failed', stage: 'memo',
        note: err instanceof Error ? err.message : String(err),
      });
      return apiError('LLM_ERROR', 'Memo generation failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const model = result.sections[0]?.provenance.producedBy ?? 'none';
    const violation = validateOwnOutput(MemoResponseSchema, {
      ok: true,
      data: result,
      meta: { ms: 0, model, mock: false },
    });
    if (violation) return violation;

    await recordAudit(supabase, [
      { runId, userId, actor: 'system', action: 'stage_completed', stage: 'memo' },
      ...result.sections.map((s) => ({
        runId, userId, actor: s.provenance.actor, action: 'statement_generated' as const, stage: 'memo' as const,
        statementId: s.statementId, statementText: s.body, evidence: s.evidence, provenance: s.provenance,
      })),
    ]);

    const meta: ApiMeta = { ms: Date.now() - started, model, mock: model === 'mock' };
    return apiSuccess(result, meta);
  });
}
