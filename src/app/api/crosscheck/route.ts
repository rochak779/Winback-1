// ============================================================================
// POST /api/crosscheck — erd.md Part 2 §5.5, Part 5 §5.7
// ============================================================================

import { TARGET_DOCS } from '@/data/target';
import { CrosscheckRequestSchema, CrosscheckResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { runDecision } from '@/lib/pipeline/decision';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/crosscheck', 'llm', async () => {
    const started = Date.now();
    const parsed = await parseBody(req, CrosscheckRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { docIds, profile } = parsed.data;
    const unknownId = docIds.find((id) => !TARGET_DOCS.some((d) => d.id === id));
    if (unknownId) return apiError('BAD_REQUEST', `Unknown docId: ${unknownId}`);

    let result;
    try {
      result = await runDecision(docIds, profile, TARGET_DOCS);
    } catch (err) {
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

    const meta: ApiMeta = { ms: Date.now() - started, model, mock: model === 'mock' };
    return apiSuccess(result, meta);
  });
}
