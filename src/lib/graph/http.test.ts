import { describe, expect, it, vi } from 'vitest';
import { SEED_DOCS, SEED_SESSIONS } from '@/data/seed-sessions';
import { createGraphHandler, type GraphSource } from './http';
import { GET } from '@/app/api/graph/route';

function fixture() {
  let userId: string | null = 'alice';
  const sessions = SEED_SESSIONS.map((session) => ({ ...session, userId: 'alice' }));
  const source: GraphSource = {
    getUserId: async () => userId,
    getSession: async (id) => sessions.find((session) => session.id === id) ?? null,
    listSessions: vi.fn(async () => sessions), docs: SEED_DOCS,
  };
  return { source, sessions, setUser: (id: string | null) => { userId = id; } };
}
const request = (query: string) => new Request(`http://localhost/api/graph?${query}`);

describe('graph route', () => {
  it('validates queries and requires sign-in', async () => {
    const { source, setUser } = fixture();
    const handler = createGraphHandler(source);
    for (const query of ['scope=wrong', 'scope=session', 'scope=all&scope=session', 'scope=all&unexpected=1']) {
      expect((await handler(request(query))).status).toBe(400);
    }
    setUser(null);
    expect((await handler(request('scope=all'))).status).toBe(401);
  });
  it('returns the same 404 for foreign and missing sessions', async () => {
    const { source, sessions, setUser } = fixture();
    const handler = createGraphHandler(source);
    setUser('bob');
    const foreign = await handler(request(`scope=session&sessionId=${sessions[0]!.id}`));
    const missing = await handler(request('scope=session&sessionId=missing'));
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
  });
  it('isolates cache by user, expires at 60 seconds, and never caches in shared HTTP caches', async () => {
    const { source, setUser } = fixture();
    let now = 100;
    const handler = createGraphHandler(source, () => now);
    const first = await handler(request('scope=all'));
    expect(first.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await first.json()).data.stats.sessionCount).toBe(2);
    await handler(request('scope=all'));
    expect(source.listSessions).toHaveBeenCalledTimes(1);
    setUser('bob');
    const other = await handler(request('scope=all'));
    expect((await other.json()).data.stats.sessionCount).toBe(0);
    setUser('alice');
    now += 60_000;
    await handler(request('scope=all'));
    expect(source.listSessions).toHaveBeenCalledTimes(3);
  });
  it('caps all scope at the ten latest owned sessions', async () => {
    const { source, sessions } = fixture();
    source.listSessions = vi.fn(async () => Array.from({ length: 12 }, (_, i) => ({
      ...sessions[0]!, id: `session-${i}`, updatedAt: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
    })));
    const body = await (await createGraphHandler(source)(request('scope=all'))).json();
    expect(body.data.stats.sessionCount).toBe(10);
    expect(body.data.sessionIds).not.toContain('session-0');
    expect(body.data.sessionIds).not.toContain('session-1');
    expect(source.listSessions).toHaveBeenCalledWith('alice', 10);
  });
  it('returns only the selected session and envelopes provider failures', async () => {
    const { source, sessions } = fixture();
    const handler = createGraphHandler(source);
    const body = await (await handler(request(`scope=session&sessionId=${sessions[1]!.id}`))).json();
    expect(body.data.sessionIds).toEqual([sessions[1]!.id]);
    source.getSession = async () => { throw new Error('test source failure'); };
    const response = await handler(request('scope=session&sessionId=broken'));
    expect(response.status).toBe(500);
    expect((await response.json()).error.message).not.toContain('test source failure');
  });
  it('makes preview explicit and fails closed for unconnected saved sessions', async () => {
    expect((await GET(request('scope=all'))).status).toBe(503);
    const preview = await (await GET(request('scope=all&demo=1'))).json();
    expect(preview.ok).toBe(true);
    expect(preview.meta).toMatchObject({ model: 'none', mock: true });
    expect(preview.data.stats.sessionCount).toBe(2);
  });
});
