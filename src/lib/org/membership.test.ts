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
          eq: () => ({
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
  it('inserts the org then an admin membership row', async () => {
    const insertedOrg = { insert: vi.fn(() => ({ select: () => ({ single: () => ({ data: { id: 'org-2' }, error: null }) }) })) };
    const insertedMember = { insert: vi.fn(() => ({ data: null, error: null })) };
    const supabase = fakeSupabase({
      from: (table: string) => (table === 'orgs' ? insertedOrg : insertedMember),
    });
    const result = await createOrgForUser(supabase, 'user-1', 'Acme');
    expect(result).toEqual({ orgId: 'org-2' });
    expect(insertedMember.insert).toHaveBeenCalledWith({ org_id: 'org-2', user_id: 'user-1', role: 'admin' });
  });
});
