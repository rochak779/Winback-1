//
// Handler-factory pattern mirrors src/lib/graph/http.ts's createGraphHandler:
// business logic against an injected `AuditSource`, so both handlers are
// fully unit-testable without a live database. The two real route files
// (Task 14) wire a Supabase-backed AuditSource in.

import { NextResponse } from 'next/server';
import type { AuditAction, AuditEntry } from '@/lib/contracts/types';

export interface RunRow {
  id: string;
  userId: string;
}

export interface AuditListOptions {
  limit: number;
  cursor: string | null;
  action: AuditAction | null;
}

export interface AuditSource {
  getUserId(): Promise<string | null>;
  getRun(id: string): Promise<RunRow | null>;
  listAuditEntries(runId: string, opts: AuditListOptions): Promise<AuditEntry[]>;
}

/** Shared ownership check — same 404-for-foreign-and-missing rule as the graph route. */
async function loadOwnedRun(source: AuditSource, runId: string): Promise<{ userId: string } | NextResponse> {
  const userId = await source.getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 });
  const run = await source.getRun(runId);
  if (!run || run.userId !== userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Run not found' } },
      { status: 404 },
    );
  }
  return { userId };
}

/**
 * A failed database read must never render as "clean, empty history" — the
 * one screen whose entire value proposition is being a trustworthy record.
 * `getRun`/`listAuditEntries` throw on a real DB error (as opposed to a
 * genuinely-missing row, which is the normal 404 case handled above), so
 * both handlers below funnel unexpected throws here instead of letting them
 * propagate unhandled or silently returning partial/empty data.
 */
function internalErrorResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : 'Unknown error';
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL', message: `Failed to load audit data: ${message}` } },
    { status: 500 },
  );
}

const VALID_ACTIONS: readonly AuditAction[] = [
  'stage_started', 'stage_completed', 'stage_failed', 'statement_generated', 'evidence_dropped',
  'analyst_accepted', 'analyst_dismissed', 'analyst_edited', 'memo_status_changed',
  'session_created', 'session_viewed', 'session_deleted',
];

export function createAuditListHandler(source: AuditSource) {
  return async function handler(req: Request, runId: string): Promise<NextResponse> {
    try {
      const owned = await loadOwnedRun(source, runId);
      if (owned instanceof NextResponse) return owned;

      const url = new URL(req.url);
      const limitParam = Number(url.searchParams.get('limit') ?? '100');
      const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100;
      const cursor = url.searchParams.get('cursor');
      const actionParam = url.searchParams.get('action');
      if (actionParam && !VALID_ACTIONS.includes(actionParam as AuditAction)) {
        return NextResponse.json({ ok: false, error: { code: 'BAD_REQUEST', message: `Unknown action: ${actionParam}` } }, { status: 400 });
      }

      const entries = await source.listAuditEntries(runId, { limit, cursor, action: (actionParam as AuditAction) ?? null });
      const nextCursor = entries.length === limit ? (entries.at(-1)?.id ?? null) : null;

      return NextResponse.json({
        ok: true,
        data: { entries, nextCursor },
        meta: { ms: 0, model: 'none', mock: false },
      });
    } catch (err) {
      return internalErrorResponse(err);
    }
  };
}

export function createAuditExportHandler(source: AuditSource) {
  return async function handler(req: Request, runId: string): Promise<NextResponse> {
    try {
      const owned = await loadOwnedRun(source, runId);
      if (owned instanceof NextResponse) return owned;
      void req;

      const entries = await source.listAuditEntries(runId, { limit: 10_000, cursor: null, action: null });
      return NextResponse.json(
        { runId, exportedAt: new Date().toISOString(), entries },
        { headers: { 'Content-Disposition': `attachment; filename="${runId}-audit.json"` } },
      );
    } catch (err) {
      return internalErrorResponse(err);
    }
  };
}
