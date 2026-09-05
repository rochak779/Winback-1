import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserId } from './session';

describe('getUserId', () => {
  it('returns the user id when a session exists', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    } as never);
    expect(await getUserId()).toBe('user-1');
  });

  it('returns null when there is no session', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as never);
    expect(await getUserId()).toBeNull();
  });
});
