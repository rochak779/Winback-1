import { describe, expect, it, vi } from 'vitest';
import { createOrgForUser, getUserOrgs } from './membership';

function fakeSupabase(overrides: Record<string, unknown> = {}) {
  return { from: vi.fn(), rpc: vi.fn(), ...overrides } as never;
}

describe('getUserOrgs', () => {
  it('maps joined rows into OrgMembership objects', async () => {
    const supabase = fakeSupabase({
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [{ org_id: 'org-1', role: 'admin', orgs: { name: 'Acme' } }],
              error: null,
            }),
        }),
      }),
    });
    expect(await getUserOrgs(supabase, 'user-1')).toEqual([
      { orgId: 'org-1', orgName: 'Acme', role: 'admin' },
    ]);
  });
});

describe('createOrgForUser', () => {
  it('creates the org and its first admin membership via the atomic create_org RPC', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: 'org-2', error: null }));
    const supabase = fakeSupabase({ rpc });
    const result = await createOrgForUser(supabase, 'user-1', 'Acme');
    expect(result).toEqual({ orgId: 'org-2' });
    expect(rpc).toHaveBeenCalledWith('create_org', { p_name: 'Acme' });
  });

  it('throws when the RPC returns an error', async () => {
    const supabase = fakeSupabase({
      rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'not_authenticated' } })),
    });
    await expect(createOrgForUser(supabase, 'user-1', 'Acme')).rejects.toThrow('Failed to create org');
  });
});
