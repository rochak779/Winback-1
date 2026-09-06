// src/app/api/audit/event/route.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/session', () => ({ getUserId: vi.fn(async () => 'user-1') }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(async () => ({ from: () => ({
  upsert: async () => ({ error: null }),
  insert: async () => ({ error: null }),
}) })) }));

import { POST } from './route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/audit/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/audit/event', () => {
  it('accepts a valid client action', async () => {
    const res = await POST(request({ runId: 'run-1', action: 'session_viewed' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, data: { recorded: true } });
  });

  it('rejects a server-only action', async () => {
    const res = await POST(request({ runId: 'run-1', action: 'stage_completed' }));
    expect(res.status).toBe(400);
  });

  it('rejects a missing runId', async () => {
    const res = await POST(request({ action: 'session_viewed' }));
    expect(res.status).toBe(400);
  });
});
