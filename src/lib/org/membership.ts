export interface SupabaseLike {
  from(table: string): { select: (...args: unknown[]) => unknown; insert: (...args: unknown[]) => unknown };
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface OrgMembership {
  orgId: string;
  orgName: string;
  role: 'admin' | 'member';
}

interface OrgMemberRow {
  org_id: string;
  role: 'admin' | 'member';
  orgs: { name: string };
}

export async function getUserOrgs(supabase: SupabaseLike, userId: string): Promise<OrgMembership[]> {
  const { data, error } = await (supabase
    .from('org_members')
    .select('org_id, role, orgs(name)') as never as {
      eq: (col: string, val: string) => Promise<{ data: OrgMemberRow[] | null; error: unknown }>;
    }).eq('user_id', userId);
  if (error || !data) return [];
  return data.map((row) => ({ orgId: row.org_id, orgName: row.orgs.name, role: row.role }));
}

export async function createOrgForUser(
  supabase: SupabaseLike,
  userId: string,
  name: string,
): Promise<{ orgId: string }> {
  // Org + first admin membership are created atomically by the `create_org`
  // SECURITY DEFINER RPC (supabase/migrations/0002_fix_rls_and_atomicity.sql).
  // `userId` is not passed: the RPC uses auth.uid() so the caller cannot spoof it.
  void userId;
  const { data, error } = await supabase.rpc('create_org', { p_name: name });
  if (error || !data) throw new Error('Failed to create org');
  return { orgId: data as string };
}
