-- 0002_fix_rls_and_atomicity.sql
--
-- Fixes found in the final whole-branch review of the Auth & Onboarding Foundation:
--   1. Org creation is now atomic (org + first admin membership in one transaction)
--      via a SECURITY DEFINER RPC, replacing the broken "bootstrap" clause in the
--      org_members INSERT policy. That clause's subquery shadowed the outer table,
--      so it degenerated to "the whole org_members table is empty" — only the very
--      first user of the deployment could ever onboard, and while the table was
--      empty anyone could self-insert as admin into any org.
--   2. All SECURITY DEFINER functions pin search_path = public (hijack vector).
--   3. accept_invite now checks the invite's email against the accepting user's
--      JWT email, so a forwarded invite link cannot be redeemed by someone else.
--   4. Index on org_members(user_id) for the getUserOrgs lookup.

-- 1. Atomic org creation ------------------------------------------------------

create or replace function create_org(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into orgs (name) values (p_name) returning id into v_org_id;
  insert into org_members (org_id, user_id, role) values (v_org_id, auth.uid(), 'admin');
  return v_org_id;
end;
$$;

drop policy "org_members: admins write" on org_members;
create policy "org_members: admins write" on org_members for insert
  with check (is_org_admin(org_id));

-- 2. Pin search_path on every SECURITY DEFINER function ------------------------

create or replace function is_org_member(p_org_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from org_members where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function is_org_admin(p_org_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from org_members where org_id = p_org_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function get_invite_preview(p_token uuid)
returns table (org_name text, email text, role text, status text)
language sql security definer stable set search_path = public as $$
  select orgs.name, invites.email, invites.role, invites.status
  from invites join orgs on orgs.id = invites.org_id
  where invites.id = p_token and invites.expires_at > now();
$$;

-- 3. accept_invite: bind the invite to the invited email ----------------------
-- If the accepting user's email does not match, zero rows match and v_org_id
-- stays null, so the existing 'invalid_or_expired_invite' path fires.

create or replace function accept_invite(p_token uuid)
returns table (org_id uuid)
language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_role text;
begin
  select invites.org_id, invites.role into v_org_id, v_role
  from invites
  where invites.id = p_token
    and invites.status = 'pending'
    and invites.expires_at > now()
    and lower(invites.email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  if v_org_id is null then
    raise exception 'invalid_or_expired_invite';
  end if;

  insert into org_members (org_id, user_id, role) values (v_org_id, auth.uid(), v_role)
    on conflict (org_id, user_id) do nothing;
  update invites set status = 'accepted' where id = p_token;

  return query select v_org_id;
end;
$$;

-- 4. Index --------------------------------------------------------------------

create index if not exists org_members_user_id_idx on org_members(user_id);
