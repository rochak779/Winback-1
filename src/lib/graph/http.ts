import { z } from 'zod';
import { NextResponse } from 'next/server';
import { ApiResponseSchema, KnowledgeGraphSchema } from '@/lib/contracts/schemas';
import type { KnowledgeGraph, SourceDoc } from '@/lib/contracts/types';
import { apiError, apiSuccess, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { buildKnowledgeGraph } from './build';
import type { OwnedGraphSession } from './types';

/** Adapter to the existing/future auth and saved-session services, not a new store.
 * listSessions must query by owner and updatedAt descending, with the supplied limit.
 */
export interface GraphSource {
  getUserId(): Promise<string | null>;
  getSession(id: string): Promise<OwnedGraphSession | null>;
  listSessions(userId: string, limit: number): Promise<OwnedGraphSession[]>;
  docs: readonly SourceDoc[];
  historical?: boolean;
}

const QuerySchema = z.object({
  scope: z.enum(['session', 'all']).default('session'),
  sessionId: z.string().trim().min(1).max(200).optional(),
  demo: z.literal('1').optional(),
}).strict().refine((query) => query.scope !== 'session' || Boolean(query.sessionId), {
  message: 'sessionId is required for session scope',
});
export const GraphResponseSchema = ApiResponseSchema(KnowledgeGraphSchema);

export function graphUnavailable() {
  return NextResponse.json({ ok: false, error: {
    code: 'INTERNAL', message: 'Saved-session graph access is unavailable until authentication and saved sessions are connected. Use the labelled historical preview.',
  } }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
}

export function createGraphHandler(source: GraphSource, now = Date.now) {
  const cache = new Map<string, { expiresAt: number; graph: KnowledgeGraph }>();
  return async function GET(req: Request) {
    const response = await withRoute('GET /api/graph', async () => {
      const started = now();
      const params = new URL(req.url).searchParams;
      if ([...params.keys()].some((key) => params.getAll(key).length > 1)) return apiError('BAD_REQUEST', 'Duplicate query parameters');
      const query = QuerySchema.safeParse(Object.fromEntries(params));
      if (!query.success) return apiError('BAD_REQUEST', 'Use scope=session with sessionId, or scope=all');
      const userId = await source.getUserId();
      if (!userId) return NextResponse.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Sign in to view saved graphs' } }, { status: 401 });

      let graph: KnowledgeGraph;
      const cached = cache.get(userId);
      if (query.data.scope === 'all' && cached && cached.expiresAt > now()) graph = cached.graph;
      else {
        let sessions: OwnedGraphSession[];
        if (query.data.scope === 'session') {
          const session = await source.getSession(query.data.sessionId!);
          // Missing and foreign sessions intentionally have identical responses.
          if (!session || session.userId !== userId) return NextResponse.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Session not found' } }, { status: 404 });
          sessions = [session];
        } else {
          sessions = (await source.listSessions(userId, 10))
            .filter((session) => session.userId === userId)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).slice(0, 10);
        }
        graph = buildKnowledgeGraph(sessions, source.docs);
        if (query.data.scope === 'all') {
          for (const [key, value] of cache) if (value.expiresAt <= now()) cache.delete(key);
          if (cache.size >= 100) cache.delete(cache.keys().next().value!);
          cache.set(userId, { expiresAt: now() + 60_000, graph });
        }
      }
      const meta = { ms: now() - started, model: 'none', mock: source.historical ?? false };
      return validateOwnOutput(GraphResponseSchema, { ok: true, data: graph, meta }) ?? apiSuccess(graph, meta);
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  };
}
