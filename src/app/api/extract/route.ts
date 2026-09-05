// ============================================================================
// POST /api/extract — erd.md Part 2 §5.2, Part 5 §5.4
// ============================================================================

import { TARGET_DOCS } from '@/data/target';
import { ExtractRequestSchema, ExtractResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { runExtraction } from '@/lib/pipeline/extraction';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute('POST /api/extract', async () => {
    const started = Date.now();
    const parsed = await parseBody(req, ExtractRequestSchema);
    if (!parsed.ok) return parsed.response;

    const { docIds } = parsed.data;
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

    const meta: ApiMeta = {
      ms: Date.now() - started,
      model: result.profile.provenance.producedBy,
      mock: result.profile.provenance.producedBy === 'mock',
      droppedEvidenceRefs: result.droppedEvidenceRefs,
    };
    return apiSuccess(result, meta);
  });
}
