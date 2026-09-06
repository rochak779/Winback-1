import { describe, expect, it, vi } from 'vitest';
import { recordAudit, newAuditId, type AuditSupabaseLike } from './record';

function fixture() {
  const upsertCalls: unknown[] = [];
  const insertCalls: unknown[] = [];
  const supabase: AuditSupabaseLike = {
    from: (table: string) => ({
      upsert: vi.fn(async (row: unknown) => {
        upsertCalls.push({ table, row });
        return { error: null };
      }),
      insert: vi.fn(async (rows: unknown) => {
        insertCalls.push({ table, rows });
        return { error: null };
      }),
    }),
  };
  return { supabase, upsertCalls, insertCalls };
}

describe('newAuditId', () => {
  it('is a monotonically-sortable base36-time-prefixed id', () => {
    const a = newAuditId();
    const b = newAuditId();
    expect(a).toMatch(/^[0-9a-z]+-[A-Za-z0-9_-]{6}$/);
    expect(a <= b).toBe(true);
  });
});

describe('recordAudit', () => {
  it('upserts the run row once, then inserts one row per entry', async () => {
    const { supabase, upsertCalls, insertCalls } = fixture();
    await recordAudit(supabase, [
      { runId: 'run-1', userId: 'user-1', actor: 'system', action: 'stage_started', stage: 'extract' },
      { runId: 'run-1', userId: 'user-1', actor: 'model', action: 'statement_generated', stage: 'extract', statementId: 'run-1:extract:profile' },
    ]);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toMatchObject({ table: 'runs', row: { id: 'run-1', user_id: 'user-1' } });
    expect(insertCalls).toHaveLength(1);
    const rows = (insertCalls[0] as { rows: Record<string, unknown>[] }).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ run_id: 'run-1', user_id: 'user-1', actor: 'system', action: 'stage_started', stage: 'extract' });
    expect(rows[1]).toMatchObject({ statement_id: 'run-1:extract:profile' });
  });

  it('is a no-op for an empty array', async () => {
    const { supabase, upsertCalls, insertCalls } = fixture();
    await recordAudit(supabase, []);
    expect(upsertCalls).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
  });

  it('never throws when the upsert or insert errors', async () => {
    const supabase: AuditSupabaseLike = {
      from: () => ({
        upsert: vi.fn(async () => ({ error: { message: 'boom' } })),
        insert: vi.fn(async () => ({ error: { message: 'boom' } })),
      }),
    };
    await expect(
      recordAudit(supabase, { runId: 'run-1', userId: 'user-1', actor: 'system', action: 'stage_started', stage: 'extract' }),
    ).resolves.toBeUndefined();
  });

  it('never throws when the client itself throws', async () => {
    const supabase: AuditSupabaseLike = {
      from: () => {
        throw new Error('network down');
      },
    };
    await expect(
      recordAudit(supabase, { runId: 'run-1', userId: 'user-1', actor: 'system', action: 'stage_started', stage: 'extract' }),
    ).resolves.toBeUndefined();
  });
});
