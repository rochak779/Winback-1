// ============================================================================
// GET /api/runs/[id]/audit/export — erd.md Part 9.5
// ============================================================================

import { createAuditExportHandler } from '@/lib/audit/read';
import { buildAuditSource } from '@/lib/audit/supabase-source';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await buildAuditSource();
  return createAuditExportHandler(source)(req, id);
}
