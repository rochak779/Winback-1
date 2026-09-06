// ============================================================================
// src/app/deal/[id]/audit/page.tsx — erd.md Part 9.6
//
// Deliberately NOT under DealGate (see the (pipeline) route group in
// src/app/deal/[id]/(pipeline)/) — this reads straight from the server via
// GET /api/runs/[id]/audit, which is ownership-checked independently of any
// client-side Run object. Works after sign-out/sign-in on any browser, for
// any run this user owns.
// ============================================================================

import { AuditTimeline } from '@/components/audit/audit-timeline';

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Audit trail</h1>
        <p className="text-sm text-muted-foreground">
          A complete, exportable record of what was generated, from what sources, by what model and prompt version, and
          what the analyst did about it. Not tamper-proof and not a compliance-grade log — see the README for the exact
          claim this makes.
        </p>
      </div>
      <AuditTimeline runId={id} />
    </div>
  );
}
