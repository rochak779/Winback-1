export interface SupabaseLike {
  from(table: string): { select: (...args: any[]) => any; insert: (...args: any[]) => any };
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
    .select('org_id, role, orgs(name)') as any as {
      eq: (col: string, val: string) => { data: OrgMemberRow[] | null; error: unknown };
    }).eq('user_id', userId);
  if (error || !data) return [];
  return data.map((row) => ({ orgId: row.org_id, orgName: row.orgs.name, role: row.role }));
}

export async function createOrgForUser(
  supabase: SupabaseLike,
  userId: string,
  name: string,
): Promise<{ orgId: string }> {
  const orgInsert = supabase.from('orgs').insert({ name }) as any as {
    select: () => { single: () => { data: { id: string } | null; error: unknown } };
  };
  const { data: org, error: orgError } = orgInsert.select().single();
  if (orgError || !org) throw new Error('Failed to create org');

  const memberInsert = supabase.from('org_members').insert({ org_id: org.id, user_id: userId, role: 'admin' }) as any as {
    data: unknown;
    error: unknown;
  };
  if (memberInsert.error) throw new Error('Failed to create admin membership');

  return { orgId: org.id };
}
