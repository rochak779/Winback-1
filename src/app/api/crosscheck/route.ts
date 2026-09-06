// ============================================================================
// POST /api/crosscheck — erd.md Part 2 §5.5, Part 5 §5.7
// ============================================================================

import { TARGET_DOCS } from '@/data/target';
import { CrosscheckRequestSchema, CrosscheckResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { runDecision } from '@/lib/pipeline/decision';
import { recordAudit, type AuditSupabaseLike } from '@/lib/audit/record';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/crosscheck', 'llm', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, CrosscheckRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { runId, docIds, profile } = parsed.data;
    const supabaseClient = await createServerSupabaseClient();
    const supabase = supabaseClient as unknown as AuditSupabaseLike;
    await recordAudit(supabase, { runId, userId, actor: 'system', action: 'stage_started', stage: 'decision' });

    const unknownId = docIds.find((id) => !TARGET_DOCS.some((d) => d.id === id));
    if (unknownId) return apiError('BAD_REQUEST', `Unknown docId: ${unknownId}`);

    let result;
    try {
      result = await runDecision(docIds, profile, TARGET_DOCS);
    } catch (err) {
      await recordAudit(supabase, {
        runId, userId, actor: 'system', action: 'stage_failed', stage: 'decision',
        note: err instanceof Error ? err.message : String(err),
      });
      return apiError('LLM_ERROR', 'Crosscheck failed for every definition', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const model = result.crosschecks[0]?.provenance.producedBy ?? 'none';
    const violation = validateOwnOutput(CrosscheckResponseSchema, {
      ok: true,
      data: result,
      meta: { ms: 0, model, mock: false },
    });
    if (violation) return violation;

    await recordAudit(supabase, [
      { runId, userId, actor: 'system', action: 'stage_completed', stage: 'decision' },
      ...result.crosschecks.map((c) => ({
        runId, userId, actor: c.provenance.actor, action: 'statement_generated' as const, stage: 'decision' as const,
        statementId: c.statementId, statementText: c.explanation,
        evidence: [...c.claim.evidence, ...c.counterEvidence],
        provenance: c.provenance,
      })),
      ...result.failures.map((failure) => ({
        runId, userId, actor: 'system' as const, action: 'stage_failed' as const, stage: 'decision' as const,
        note: `${failure.docId ? `${failure.docId}: ` : ''}${failure.code} — ${failure.message}`,
      })),
    ]);

    const meta: ApiMeta = { ms: Date.now() - started, model, mock: model === 'mock' };
    return apiSuccess(result, meta);
  });
}
