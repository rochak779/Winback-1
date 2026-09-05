export interface InvitesSupabaseLike {
  from(table: string): { insert: (...args: unknown[]) => unknown };
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface CreateInviteInput {
  orgId: string;
  email: string;
  role: 'admin' | 'member';
}

export interface InvitePreview {
  orgName: string;
  email: string;
  role: 'admin' | 'member';
  status: string;
}

export async function createInvite(
  supabase: InvitesSupabaseLike,
  input: CreateInviteInput,
  invitedBy: string,
): Promise<{ token: string }> {
  const insert = supabase.from('invites').insert({
    org_id: input.orgId,
    email: input.email,
    role: input.role,
    invited_by: invitedBy,
  }) as never as { select: () => { single: () => Promise<{ data: { id: string } | null; error: unknown }> } };
  const { data, error } = await insert.select().single();
  if (error || !data) throw new Error('Failed to create invite');
  return { token: data.id };
}

export async function getInvitePreview(supabase: InvitesSupabaseLike, token: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('get_invite_preview', { p_token: token });
  if (error) return null;
  const rows = data as Array<{ org_name: string; email: string; role: 'admin' | 'member'; status: string }>;
  const row = rows[0];
  if (!row) return null;
  return { orgName: row.org_name, email: row.email, role: row.role, status: row.status };
}

export async function acceptInvite(
  supabase: InvitesSupabaseLike,
  token: string,
): Promise<{ orgId: string } | { error: string }> {
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
  if (error) return { error: error.message };
  const rows = data as Array<{ org_id: string }>;
  const row = rows[0];
  if (!row) return { error: 'invalid_or_expired_invite' };
  return { orgId: row.org_id };
}
