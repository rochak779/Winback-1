import { describe, expect, it, vi } from 'vitest';
import { acceptInvite, createInvite, getInvitePreview } from './invites';

describe('createInvite', () => {
  it('inserts a pending invite and returns its id as the token', async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'invite-1' }, error: null }) }) }));
    const supabase = { from: () => ({ insert }), rpc: vi.fn() } as never;
    const result = await createInvite(
      supabase,
      { orgId: 'org-1', email: 'a@b.com', role: 'member' },
      'user-1',
    );
    expect(result).toEqual({ token: 'invite-1' });
    expect(insert).toHaveBeenCalledWith({ org_id: 'org-1', email: 'a@b.com', role: 'member', invited_by: 'user-1' });
  });
});

describe('getInvitePreview', () => {
  it('returns null when the RPC finds nothing', async () => {
    const supabase = { from: vi.fn(), rpc: vi.fn(async () => ({ data: [], error: null })) } as never;
    expect(await getInvitePreview(supabase, 'bad-token')).toBeNull();
  });

  it('returns the preview when found', async () => {
    const row = { org_name: 'Acme', email: 'a@b.com', role: 'member', status: 'pending' };
    const supabase = { from: vi.fn(), rpc: vi.fn(async () => ({ data: [row], error: null })) } as never;
    expect(await getInvitePreview(supabase, 'invite-1')).toEqual({
      orgName: 'Acme', email: 'a@b.com', role: 'member', status: 'pending',
    });
  });
});

describe('acceptInvite', () => {
  it('returns the org id on success', async () => {
    const supabase = { from: vi.fn(), rpc: vi.fn(async () => ({ data: [{ org_id: 'org-1' }], error: null })) } as never;
    expect(await acceptInvite(supabase, 'invite-1')).toEqual({ orgId: 'org-1' });
  });

  it('returns an error when the RPC throws', async () => {
    const supabase = { from: vi.fn(), rpc: vi.fn(async () => ({ data: null, error: { message: 'invalid_or_expired_invite' } })) } as never;
    expect(await acceptInvite(supabase, 'invite-1')).toEqual({ error: 'invalid_or_expired_invite' });
  });
});
