create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table org_members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table orgs enable row level security;
alter table org_members enable row level security;
alter table invites enable row level security;
alter table companies enable row level security;

create function is_org_member(p_org_id uuid) returns boolean
  language sql security definer stable as $$
  select exists (
    select 1 from org_members where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create function is_org_admin(p_org_id uuid) returns boolean
  language sql security definer stable as $$
  select exists (
    select 1 from org_members where org_id = p_org_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create policy "profiles: own row" on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

create policy "orgs: members read" on orgs for select
  using (is_org_member(id));
create policy "orgs: admins write" on orgs for update
  using (is_org_admin(id));
create policy "orgs: authenticated insert" on orgs for insert
  with check (auth.uid() is not null);

create policy "org_members: members read" on org_members for select
  using (is_org_member(org_id));
create policy "org_members: admins write" on org_members for insert
  with check (is_org_admin(org_id) or not exists (select 1 from org_members where org_id = org_members.org_id));

create policy "invites: admins read" on invites for select
  using (is_org_admin(org_id));
create policy "invites: admins write" on invites for insert
  with check (is_org_admin(org_id));
create policy "invites: admins update" on invites for update
  using (is_org_admin(org_id));

create policy "companies: members read" on companies for select
  using (is_org_member(org_id));
create policy "companies: admins write" on companies for insert
  with check (is_org_admin(org_id));

create function get_invite_preview(p_token uuid)
returns table (org_name text, email text, role text, status text)
language sql security definer stable as $$
  select orgs.name, invites.email, invites.role, invites.status
  from invites join orgs on orgs.id = invites.org_id
  where invites.id = p_token and invites.expires_at > now();
$$;

create function accept_invite(p_token uuid)
returns table (org_id uuid)
language plpgsql security definer as $$
declare v_org_id uuid; v_role text;
begin
  select invites.org_id, invites.role into v_org_id, v_role
  from invites
  where invites.id = p_token and invites.status = 'pending' and invites.expires_at > now();

  if v_org_id is null then
    raise exception 'invalid_or_expired_invite';
  end if;

  insert into org_members (org_id, user_id, role) values (v_org_id, auth.uid(), v_role)
    on conflict (org_id, user_id) do nothing;
  update invites set status = 'accepted' where id = p_token;

  return query select v_org_id;
end;
$$;
