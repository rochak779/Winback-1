// ============================================================================
// POST /api/extract — erd.md Part 2 §5.2, Part 5 §5.4
// ============================================================================

import { TARGET_DOCS } from '@/data/target';
import { ExtractRequestSchema, ExtractResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { runExtraction } from '@/lib/pipeline/extraction';
import { recordAudit, type AuditSupabaseLike } from '@/lib/audit/record';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/extract', 'llm', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, ExtractRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { runId, docIds } = parsed.data;
    const supabaseClient = await createServerSupabaseClient();
    const supabase = supabaseClient as unknown as AuditSupabaseLike;
    await recordAudit(supabase, { runId, userId, actor: 'system', action: 'stage_started', stage: 'extract' });

    const docs = docIds.map((id) => TARGET_DOCS.find((d) => d.id === id));
    const unknownIndex = docs.findIndex((d) => !d);
    if (unknownIndex !== -1) {
      return apiError('BAD_REQUEST', `Unknown docId: ${docIds[unknownIndex]}`);
    }

    let result;
    try {
      result = await runExtraction(
        docs.filter((d): d is NonNullable<typeof d> => Boolean(d)),
        TARGET_DOCS,
      );
    } catch (err) {
      await recordAudit(supabase, {
        runId, userId, actor: 'system', action: 'stage_failed', stage: 'extract',
        note: err instanceof Error ? err.message : String(err),
      });
      return apiError('LLM_ERROR', 'Extraction failed for every document', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const violation = validateOwnOutput(ExtractResponseSchema, {
      ok: true,
      data: result,
      meta: { ms: 0, model: result.profile.provenance.producedBy, mock: false },
    });
    if (violation) return violation;

    await recordAudit(supabase, [
      { runId, userId, actor: 'system', action: 'stage_completed', stage: 'extract' },
      {
        runId, userId, actor: result.profile.provenance.actor, action: 'statement_generated', stage: 'extract',
        statementId: result.profile.statementId, statementText: result.profile.businessSummary,
        provenance: result.profile.provenance,
      },
      ...result.failures.map((failure) => ({
        runId, userId, actor: 'system' as const, action: 'stage_failed' as const, stage: 'extract' as const,
        note: `${failure.docId ? `${failure.docId}: ` : ''}${failure.code} — ${failure.message}`,
      })),
      ...(result.droppedEvidenceRefs > 0
        ? [{
            runId, userId, actor: 'system' as const, action: 'evidence_dropped' as const, stage: 'extract' as const,
            note: `${result.droppedEvidenceRefs} evidence ref(s) dropped during extraction`,
          }]
        : []),
    ]);

    const meta: ApiMeta = {
      ms: Date.now() - started,
      model: result.profile.provenance.producedBy,
      mock: result.profile.provenance.producedBy === 'mock',
      droppedEvidenceRefs: result.droppedEvidenceRefs,
    };
    return apiSuccess(result, meta);
  });
}
