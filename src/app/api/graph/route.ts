import { HISTORICAL_OWNER, SEED_DOCS, SEED_SESSIONS } from '@/data/seed-sessions';
import { createGraphHandler, graphUnavailable } from '@/lib/graph/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

const historicalGraph = createGraphHandler({
  getUserId: async () => HISTORICAL_OWNER,
  getSession: async (id) => SEED_SESSIONS.find((session) => session.id === id) ?? null,
  listSessions: async (_userId, limit) => SEED_SESSIONS.slice(0, limit),
  docs: SEED_DOCS,
  historical: true,
});

export async function GET(req: Request) {
  // No auth/session modules exist in this checkout. Do not invent an authenticated
  // user or expose private sessions. Phase 6.1/6.2 can supply GraphSource unchanged.
  if (new URL(req.url).searchParams.get('demo') !== '1') return graphUnavailable();
  return historicalGraph(req);
}
