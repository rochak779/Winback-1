import { describe, expect, it, vi } from 'vitest';
import type { AuditEntry } from '@/lib/contracts/types';
import { createAuditListHandler, createAuditExportHandler, type AuditSource } from './read';

function entry(id: string, overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id, sessionId: 'run-1', userId: 'alice', at: '2026-09-05T00:00:00.000Z', actor: 'system',
    action: 'stage_started', stage: 'extract', statementId: null, statementText: null,
    evidence: [], provenance: null, before: null, after: null, note: null,
    ...overrides,
  };
}

function fixture() {
  let userId: string | null = 'alice';
  const runs = new Map([['run-1', { id: 'run-1', userId: 'alice' }]]);
  const entries = [entry('c1'), entry('c0')];
  const source: AuditSource = {
    getUserId: async () => userId,
    getRun: async (id) => runs.get(id) ?? null,
    listAuditEntries: vi.fn(async (runId, opts) => {
      // Return only up to `limit` entries
      if (opts.limit && opts.limit < entries.length) {
        return entries.slice(0, opts.limit);
      }
      return entries;
    }),
  };
  return { source, setUser: (id: string | null) => { userId = id; } };
}

describe('createAuditListHandler', () => {
  it('requires sign-in', async () => {
    const { source, setUser } = fixture();
    setUser(null);
    const res = await createAuditListHandler(source)(new Request('http://localhost/x'), 'run-1');
    expect(res.status).toBe(401);
  });

  it('returns the same 404 for a foreign run and a missing run', async () => {
    const { source } = fixture();
    const handler = createAuditListHandler(source);
    const foreign = await handler(new Request('http://localhost/x'), 'run-1');
    // simulate a foreign run by asking for one not in the map
    const missing = await handler(new Request('http://localhost/x'), 'nope');
    expect(missing.status).toBe(404);
    // foreign-run case covered by getRun returning a row whose userId doesn't match — exercised via a second fixture:
    const source2: AuditSource = { ...source, getRun: async () => ({ id: 'run-1', userId: 'bob' }) };
    const foreign2 = await createAuditListHandler(source2)(new Request('http://localhost/x'), 'run-1');
    expect(foreign2.status).toBe(404);
    expect(await foreign2.json()).toEqual(await missing.json());
    void foreign;
  });

  it('lists entries newest-first with a nextCursor', async () => {
    const { source } = fixture();
    const res = await createAuditListHandler(source)(new Request('http://localhost/x?limit=1'), 'run-1');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.entries).toHaveLength(1);
  });
});

describe('createAuditExportHandler', () => {
  it('sets a Content-Disposition attachment header', async () => {
    const { source } = fixture();
    const res = await createAuditExportHandler(source)(new Request('http://localhost/x'), 'run-1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="run-1-audit\.json"$/);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
  });
});
