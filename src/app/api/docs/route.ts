// ============================================================================
// GET /api/docs — erd.md Part 2 §5.1
//
// No LLM. Returns the target's four documents from src/data/target.
// ============================================================================

import { TARGET_DOCS } from '@/data/target';
import { apiSuccess, withRoute } from '@/lib/pipeline/http';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const revalidate = 3600;

export async function GET() {
  return withRoute('GET /api/docs', async () =>
    apiSuccess({ docs: TARGET_DOCS }, { ms: 0, model: 'none', mock: false }),
  );
}
