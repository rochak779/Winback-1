// ============================================================================
// GET /api/runs/[id]/audit — erd.md Part 9.5, adapted to Postgres/Supabase
//
// Ownership-checked (404-not-403, same rule as GET /api/graph), paginated,
// newest first, optional ?action= filter.
// ============================================================================

import { createAuditListHandler } from '@/lib/audit/read';
import { buildAuditSource } from '@/lib/audit/supabase-source';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await buildAuditSource();
  return createAuditListHandler(source)(req, id);
}
