import { MemoRequestSchema, MemoResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { runMemo } from '@/lib/pipeline/memo';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/memo', 'llm', async (userId) => {
    const started = Date.now();
    const parsed = await parseBody(req, MemoRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { deal, profile, benchmark, portfolio, crosschecks } = parsed.data;

    let result;
    try {
      result = await runMemo(deal, profile, benchmark, portfolio, crosschecks);
    } catch (err) {
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

    const meta: ApiMeta = { ms: Date.now() - started, model, mock: model === 'mock' };
    return apiSuccess(result, meta);
  });
}
