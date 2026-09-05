# Auth & Onboarding Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real Supabase-backed auth (sign-up, sign-in, forgot-password), an org/team/role data model, an invite flow, a basic onboarding wizard, and guards on every existing route.

**Architecture:** Supabase Postgres + Supabase Auth via `@supabase/ssr`. Two new domain modules (`org/membership`, `org/invites`) take an injected Supabase client so they're unit-testable without a live database, mirroring the existing `GraphSource` adapter pattern in `src/lib/graph/http.ts`. `middleware.ts` + `getUserId()` gate every route. RLS in Postgres is the real permission boundary; the two-role UI is a convenience layer on top of it.

**Tech Stack:** `@supabase/supabase-js`, `@supabase/ssr`, Next.js 16 App Router, existing shadcn primitives (`button`, `input`, `label`, `card`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-auth-onboarding-foundation-design.md`

## Global Constraints

- Drop `firebase` and `firebase-admin` from `package.json` — nothing in the codebase uses them.
- Auth is email + password only, no OAuth.
- Every existing route (`/`, `/deal/[id]/*`, `/graph`, all `/api/*`) requires a signed-in user.
- Two roles only, org-wide: `admin` (edit) and `member` (view). No per-resource permissions.
- Invite delivery is a copyable link — no email sending.
- The "upload documents" onboarding step creates `companies` rows and stores files in Supabase
  Storage but does **not** wire into the extraction pipeline — that's a later sub-project.
- UI is plain shadcn forms — no custom visual design work.
- `pnpm typecheck && pnpm build` must pass before any commit.

---

## Task 1: Supabase project, schema, and RLS (manual — run in the main session, not a subagent)

This task requires creating a real external account and cannot be delegated to a subagent that
can't interact with you. Run this one directly in conversation with the user, the same way the
ERD's Phase 0.3 Gemini setup was done.

**Files:**
- Create: `supabase/migrations/0001_auth_foundation.sql`
- Modify: `.env.example`

**Interfaces:**
- Produces: the five tables and two RPCs every later task depends on:
  `profiles`, `orgs`, `org_members`, `invites`, `companies` tables;
  `get_invite_preview(p_token uuid)` and `accept_invite(p_token uuid)` RPC functions.

- [ ] **Step 1: Walk the user through creating a Supabase project**

  Tell the user to go to https://supabase.com/dashboard, create a new project, and copy three
  values from Project Settings → API: the Project URL, the `anon` public key, and the
  `service_role` secret key. Stop and wait for these three values.

- [ ] **Step 2: Write the schema migration**

  Create `supabase/migrations/0001_auth_foundation.sql`:

  ```sql
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
  ```

- [ ] **Step 3: Apply the migration**

  Have the user paste the SQL into the Supabase dashboard's SQL editor (Project → SQL Editor) and
  run it, since the Supabase CLI isn't installed in this environment. Confirm the five tables
  appear under Table Editor.

- [ ] **Step 4: Add the env vars**

  Add to `.env.example` (values blank):

  ```
  # Supabase — public by design, not a secret
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=

  # Server-only. Never prefix with NEXT_PUBLIC_.
  SUPABASE_SERVICE_ROLE_KEY=
  ```

  Remove the now-dead `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIRESTORE_DATABASE_ID`,
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID` lines.

  Have the user create `.env.local` (gitignored) with the three real values from Step 1.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/0001_auth_foundation.sql .env.example
  git commit -m "chore: supabase schema, RLS, and invite RPCs"
  ```

---

## Task 2: Supabase client helpers and dependency swap

**Depends on:** Task 1 (env var names only — can start once Step 4 above lands, doesn't need the
live project).

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `createBrowserSupabaseClient(): SupabaseClient` (client components),
  `createServerSupabaseClient(): Promise<SupabaseClient>` (server components / route handlers).

- [ ] **Step 1: Swap dependencies**

  ```bash
  pnpm remove firebase firebase-admin
  pnpm add @supabase/supabase-js @supabase/ssr
  ```

- [ ] **Step 2: Write the browser client**

  Create `src/lib/supabase/client.ts`:

  ```ts
  import { createBrowserClient } from '@supabase/ssr';

  export function createBrowserSupabaseClient() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  ```

- [ ] **Step 3: Write the server client**

  Create `src/lib/supabase/server.ts`:

  ```ts
  import { createServerClient } from '@supabase/ssr';
  import { cookies } from 'next/headers';

  export async function createServerSupabaseClient() {
    const cookieStore = await cookies();
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            } catch {
              // Called from a Server Component render; middleware refreshes the session instead.
            }
          },
        },
      },
    );
  }
  ```

- [ ] **Step 4: Verify the build still passes**

  Run: `pnpm typecheck && pnpm build`
  Expected: PASS (no route uses these yet, so this only proves the new files compile).

- [ ] **Step 5: Commit**

  ```bash
  git add package.json pnpm-lock.yaml src/lib/supabase
  git commit -m "chore: swap firebase deps for supabase client helpers"
  ```

---

## Task 3: `getUserId()` auth helper

**Depends on:** Task 2.

**Files:**
- Create: `src/lib/auth/session.ts`
- Test: `src/lib/auth/session.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient()` from Task 2.
- Produces: `getUserId(): Promise<string | null>` — the server-side auth-check surface for any
  future Server Component or route handler that needs the current user's id (e.g. the
  multi-company sub-project's org-scoped data fetching). Note: `middleware.ts` (Task 4) does
  *not* call this — Edge middleware needs `@supabase/ssr`'s request/response-cookie pattern
  directly, which is a different code path than the `next/headers`-based server client this
  helper wraps. This task's own deliverable is fully exercised by its unit tests below; nothing
  later in *this* plan happens to call it, which is fine — it's a foundational primitive the spec
  calls for, not dead code.

- [ ] **Step 1: Write the failing test**

  Create `src/lib/auth/session.test.ts`:

  ```ts
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
  ```

- [ ] **Step 2: Run it to confirm it fails**

  Run: `pnpm vitest run src/lib/auth/session.test.ts`
  Expected: FAIL — `./session` has no exported member `getUserId`.

- [ ] **Step 3: Implement**

  Create `src/lib/auth/session.ts`:

  ```ts
  import { createServerSupabaseClient } from '@/lib/supabase/server';

  export async function getUserId(): Promise<string | null> {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }
  ```

- [ ] **Step 4: Run it to confirm it passes**

  Run: `pnpm vitest run src/lib/auth/session.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/auth
  git commit -m "feat: getUserId auth helper"
  ```

---

## Task 4: `middleware.ts` route guard

**Depends on:** Task 3.

**Files:**
- Create: `middleware.ts` (repo root, alongside `package.json`)
- Modify: `src/lib/contracts/schemas.ts` (add `'UNAUTHORIZED'` to `ErrorCodeSchema`)
- Modify: `src/lib/pipeline/http.ts:15-28` (`statusForCode` — add the `'UNAUTHORIZED'` case)

**Interfaces:**
- Consumes: `@supabase/ssr`'s `createServerClient` directly (middleware runs on the Edge runtime,
  where `next/headers`'s `cookies()` isn't available the same way — Supabase's documented
  middleware pattern uses `NextRequest`/`NextResponse` cookies instead of Task 2's server client).
- Produces: redirect-to-`/sign-in` for unauthenticated page requests, and a JSON 401 envelope
  (`{ ok: false, error: { code: 'UNAUTHORIZED', ... } }`) for unauthenticated `/api/*` requests —
  matching the existing `ApiError` shape so client-side `zod` parsing in `src/lib/client/api.ts`
  doesn't choke on an HTML error page.

- [ ] **Step 1: Add the `UNAUTHORIZED` error code to the shared contract**

  In `src/lib/contracts/schemas.ts`, change:

  ```ts
  export const ErrorCodeSchema = z.enum([
    'BAD_REQUEST',
    'RATE_LIMITED',
    'LLM_ERROR',
    'LLM_TIMEOUT',
    'CONTRACT_VIOLATION',
    'INTERNAL',
  ]);
  ```

  to:

  ```ts
  export const ErrorCodeSchema = z.enum([
    'BAD_REQUEST',
    'UNAUTHORIZED',
    'RATE_LIMITED',
    'LLM_ERROR',
    'LLM_TIMEOUT',
    'CONTRACT_VIOLATION',
    'INTERNAL',
  ]);
  ```

  In `src/lib/pipeline/http.ts`, add a case to `statusForCode`:

  ```ts
  function statusForCode(code: ErrorCode): number {
    switch (code) {
      case 'BAD_REQUEST':
        return 400;
      case 'UNAUTHORIZED':
        return 401;
      case 'RATE_LIMITED':
  ```

  (leaving the remaining cases unchanged).

- [ ] **Step 2: Run typecheck to confirm the contract change compiles cleanly**

  Run: `pnpm typecheck`
  Expected: PASS — the `switch` in `statusForCode` is exhaustive over `ErrorCode`, so a missed
  case would otherwise be a compile error.

- [ ] **Step 3: Write the middleware**

  Create `middleware.ts`:

  ```ts
  import { createServerClient } from '@supabase/ssr';
  import { NextResponse, type NextRequest } from 'next/server';

  const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password'];

  function isPublic(pathname: string): boolean {
    return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/invite/');
  }

  export async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      },
    );

    const { data } = await supabase.auth.getUser();
    const { pathname } = request.nextUrl;

    if (!data.user && !isPublic(pathname)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } },
          { status: 401 },
        );
      }
      const redirectUrl = new URL('/sign-in', request.url);
      redirectUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  }

  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
  };
  ```

- [ ] **Step 4: Manually verify**

  Run `pnpm dev`, visit `/` with no session — expect a redirect to `/sign-in?next=%2F`. Visit
  `/sign-in` directly — expect it to load (it won't render anything meaningful until Task 8, a
  blank page is fine here). Then `curl -i http://localhost:3000/api/docs` with no session cookie —
  expect a `401` with the `{"ok":false,"error":{"code":"UNAUTHORIZED",...}}` body, not a redirect.

- [ ] **Step 5: Commit**

  ```bash
  git add middleware.ts src/lib/contracts/schemas.ts src/lib/pipeline/http.ts
  git commit -m "feat: middleware route guard with 401 envelope for api routes"
  ```

---

## Task 5: Org/membership domain module

**Depends on:** Task 2.

**Files:**
- Create: `src/lib/org/membership.ts`
- Test: `src/lib/org/membership.test.ts`

**Interfaces:**
- Consumes: any object satisfying the minimal `SupabaseLike` shape defined below (injected, not
  constructed internally — mirrors the `GraphSource` pattern in `src/lib/graph/http.ts:12`).
- Produces:
  - `type OrgMembership = { orgId: string; orgName: string; role: 'admin' | 'member' }`
  - `getUserOrgs(supabase: SupabaseLike, userId: string): Promise<OrgMembership[]>`
  - `createOrgForUser(supabase: SupabaseLike, userId: string, name: string): Promise<{ orgId: string }>`
  Used by: Task 10 (onboarding wizard), Task 12 (route guards may read the active org).

- [ ] **Step 1: Write the failing test**

  Create `src/lib/org/membership.test.ts`:

  ```ts
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
  ```

- [ ] **Step 2: Run it to confirm it fails**

  Run: `pnpm vitest run src/lib/org/membership.test.ts`
  Expected: FAIL — module `./membership` doesn't exist.

- [ ] **Step 3: Implement**

  Create `src/lib/org/membership.ts`:

  ```ts
  export interface SupabaseLike {
    from(table: string): { select: (...args: never[]) => never; insert: (...args: never[]) => never };
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
    const orgInsert = supabase.from('orgs').insert({ name }) as never as {
      select: () => { single: () => { data: { id: string } | null; error: unknown } };
    };
    const { data: org, error: orgError } = orgInsert.select().single();
    if (orgError || !org) throw new Error('Failed to create org');

    const memberInsert = supabase.from('org_members').insert({ org_id: org.id, user_id: userId, role: 'admin' }) as never as {
      data: unknown;
      error: unknown;
    };
    if (memberInsert.error) throw new Error('Failed to create admin membership');

    return { orgId: org.id };
  }
  ```

- [ ] **Step 4: Run it to confirm it passes**

  Run: `pnpm vitest run src/lib/org/membership.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/org/membership.ts src/lib/org/membership.test.ts
  git commit -m "feat: org membership domain module"
  ```

---

## Task 6: Invite domain module

**Depends on:** Task 2 (client shape) and Task 1 (the `get_invite_preview` / `accept_invite` RPCs
it calls by name).

**Files:**
- Create: `src/lib/org/invites.ts`
- Test: `src/lib/org/invites.test.ts`

**Interfaces:**
- Consumes: an injected `SupabaseLike` (same shape family as Task 5, extended with `.rpc()`).
- Produces:
  - `createInvite(supabase, input: { orgId: string; email: string; role: 'admin' | 'member' }, invitedBy: string): Promise<{ token: string }>`
  - `type InvitePreview = { orgName: string; email: string; role: 'admin' | 'member'; status: string }`
  - `getInvitePreview(supabase, token: string): Promise<InvitePreview | null>`
  - `acceptInvite(supabase, token: string): Promise<{ orgId: string } | { error: string }>`
  Used by: Task 10 (onboarding step 3 generates invites), Task 11 (`/invite/[token]` page).

- [ ] **Step 1: Write the failing test**

  Create `src/lib/org/invites.test.ts`:

  ```ts
  import { describe, expect, it, vi } from 'vitest';
  import { acceptInvite, createInvite, getInvitePreview } from './invites';

  describe('createInvite', () => {
    it('inserts a pending invite and returns its id as the token', async () => {
      const insert = vi.fn(() => ({ select: () => ({ single: () => ({ data: { id: 'invite-1' }, error: null }) }) }));
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
  ```

- [ ] **Step 2: Run it to confirm it fails**

  Run: `pnpm vitest run src/lib/org/invites.test.ts`
  Expected: FAIL — module `./invites` doesn't exist.

- [ ] **Step 3: Implement**

  Create `src/lib/org/invites.ts`:

  ```ts
  export interface InvitesSupabaseLike {
    from(table: string): { insert: (...args: never[]) => never };
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
    }) as never as { select: () => { single: () => { data: { id: string } | null; error: unknown } } };
    const { data, error } = insert.select().single();
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
  ```

- [ ] **Step 4: Run it to confirm it passes**

  Run: `pnpm vitest run src/lib/org/invites.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/org/invites.ts src/lib/org/invites.test.ts
  git commit -m "feat: invite domain module"
  ```

---

## Task 7: Sign-up page

**Depends on:** Task 2.

**Files:**
- Create: `src/app/sign-up/page.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient()` from Task 2.
- Produces: a `/sign-up` route. On success, redirects to `/onboarding` (Task 10's route — the page
  exists by the time this is exercised end-to-end, but this task doesn't depend on Task 10 to
  compile or to be reviewed on its own).

- [ ] **Step 1: Write the page**

  Create `src/app/sign-up/page.tsx`:

  ```tsx
  'use client';

  import { useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { createBrowserSupabaseClient } from '@/lib/supabase/client';

  export default function SignUpPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setPending(true);
      setError(null);
      const supabase = createBrowserSupabaseClient();
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      setPending(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      router.push('/onboarding');
    }

    return (
      <div className="mx-auto flex max-w-sm flex-col justify-center py-16">
        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Creating account…' : 'Sign up'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account? <a href="/sign-in" className="underline">Sign in</a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
  ```

- [ ] **Step 2: Manually verify**

  Run `pnpm dev`, visit `/sign-up`, submit a real email/password. Expect Supabase Auth to create
  the user (check the Supabase dashboard's Authentication → Users tab) and the browser to
  redirect to `/onboarding` (blank/404 is fine until Task 10 lands).

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/sign-up
  git commit -m "feat: sign-up page"
  ```

---

## Task 8: Sign-in page

**Depends on:** Task 2.

**Files:**
- Create: `src/app/sign-in/page.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient()` from Task 2.
- Produces: a `/sign-in` route. Reads the `?next=` query param set by `middleware.ts` (Task 4) and
  redirects there on success, defaulting to `/`.

- [ ] **Step 1: Write the page**

  Create `src/app/sign-in/page.tsx`:

  ```tsx
  'use client';

  import { useState } from 'react';
  import { useRouter, useSearchParams } from 'next/navigation';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { createBrowserSupabaseClient } from '@/lib/supabase/client';

  export default function SignInPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setPending(true);
      setError(null);
      const supabase = createBrowserSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setPending(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push(searchParams.get('next') ?? '/');
    }

    return (
      <div className="mx-auto flex max-w-sm flex-col justify-center py-16">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <a href="/forgot-password" className="underline">Forgot password?</a> ·{' '}
                No account? <a href="/sign-up" className="underline">Sign up</a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
  ```

- [ ] **Step 2: Manually verify**

  Sign in with the account created in Task 7. Expect redirect to `/` (or wherever middleware
  bounced you from).

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/sign-in
  git commit -m "feat: sign-in page"
  ```

---

## Task 9: Forgot-password and reset-password pages

**Depends on:** Task 2.

**Files:**
- Create: `src/app/forgot-password/page.tsx`
- Create: `src/app/reset-password/page.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient()` from Task 2.
- Produces: `/forgot-password` (sends the reset email) and `/reset-password` (sets a new password
  from the emailed link's recovery session).

- [ ] **Step 1: Write the forgot-password page**

  Create `src/app/forgot-password/page.tsx`:

  ```tsx
  'use client';

  import { useState } from 'react';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { createBrowserSupabaseClient } from '@/lib/supabase/client';

  export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setError(null);
      const supabase = createBrowserSupabaseClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    }

    if (sent) {
      return (
        <div className="mx-auto max-w-sm py-16 text-center text-sm text-muted-foreground">
          If an account exists for {email}, a reset link has been sent.
        </div>
      );
    }

    return (
      <div className="mx-auto flex max-w-sm flex-col justify-center py-16">
        <Card>
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">Send reset link</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
  ```

- [ ] **Step 2: Write the reset-password page**

  Create `src/app/reset-password/page.tsx`:

  ```tsx
  'use client';

  import { useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { createBrowserSupabaseClient } from '@/lib/supabase/client';

  export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setPending(true);
      setError(null);
      const supabase = createBrowserSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      setPending(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push('/sign-in');
    }

    return (
      <div className="mx-auto flex max-w-sm flex-col justify-center py-16">
        <Card>
          <CardHeader>
            <CardTitle>Set a new password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Saving…' : 'Save new password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
  ```

- [ ] **Step 3: Manually verify**

  Request a reset link for the Task 7 account, click it, land on `/reset-password` with an active
  recovery session (Supabase sets this from the URL fragment automatically), set a new password,
  confirm redirect to `/sign-in`, then sign in with the new password.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/forgot-password src/app/reset-password
  git commit -m "feat: forgot-password and reset-password pages"
  ```

---

## Task 10: Onboarding wizard

**Depends on:** Task 5 (`createOrgForUser`), Task 6 (`createInvite`), Task 2 (Supabase client, for
both the domain calls and the document-upload step's Storage call).

**Files:**
- Create: `src/app/onboarding/page.tsx`

**Interfaces:**
- Consumes: `createOrgForUser` (Task 5), `createInvite` (Task 6), `createBrowserSupabaseClient`
  (Task 2).
- Produces: the `/onboarding` route the sign-up flow (Task 7) redirects to; ends by redirecting to
  `/`.

- [ ] **Step 1: Write the wizard**

  Create `src/app/onboarding/page.tsx`:

  ```tsx
  'use client';

  import { useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import { createBrowserSupabaseClient } from '@/lib/supabase/client';
  import { createOrgForUser } from '@/lib/org/membership';
  import { createInvite } from '@/lib/org/invites';

  type Step = 'details' | 'company' | 'invite' | 'upload';

  interface InviteRow {
    email: string;
    role: 'admin' | 'member';
    link: string;
  }

  export default function OnboardingPage() {
    const router = useRouter();
    const supabase = createBrowserSupabaseClient();

    const [step, setStep] = useState<Step>('details');
    const [fullName, setFullName] = useState('');
    const [orgName, setOrgName] = useState('');
    const [orgId, setOrgId] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
    const [invites, setInvites] = useState<InviteRow[]>([]);
    const [companyName, setCompanyName] = useState('');
    const [error, setError] = useState<string | null>(null);

    async function handleDetails(e: React.FormEvent) {
      e.preventDefault();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName });
      setStep('company');
    }

    async function handleCompany(e: React.FormEvent) {
      e.preventDefault();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      try {
        const { orgId: newOrgId } = await createOrgForUser(supabase, data.user.id, orgName);
        setOrgId(newOrgId);
        setStep('invite');
      } catch {
        setError('Could not create the company. Try again.');
      }
    }

    async function handleAddInvite() {
      if (!orgId || !inviteEmail) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { token } = await createInvite(supabase, { orgId, email: inviteEmail, role: inviteRole }, data.user.id);
      const link = `${window.location.origin}/invite/${token}`;
      setInvites((prev) => [...prev, { email: inviteEmail, role: inviteRole, link }]);
      setInviteEmail('');
    }

    async function handleUpload(e: React.FormEvent) {
      e.preventDefault();
      if (!orgId) return;
      if (companyName.trim()) {
        await supabase.from('companies').insert({ org_id: orgId, name: companyName.trim() });
      }
      router.push('/');
    }

    return (
      <div className="mx-auto max-w-lg py-16">
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 'details' && 'Your details'}
              {step === 'company' && 'Company details'}
              {step === 'invite' && 'Invite teammates'}
              {step === 'upload' && 'Upload documents'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === 'details' && (
              <form className="space-y-4" onSubmit={handleDetails}>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <Button type="submit">Continue</Button>
              </form>
            )}

            {step === 'company' && (
              <form className="space-y-4" onSubmit={handleCompany}>
                <div className="space-y-2">
                  <Label htmlFor="orgName">Company name</Label>
                  <Input id="orgName" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit">Continue</Button>
              </form>
            )}

            {step === 'invite' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'member')}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={handleAddInvite}>Add</Button>
                </div>
                <ul className="space-y-1 text-sm">
                  {invites.map((invite) => (
                    <li key={invite.link} className="flex flex-col gap-1 rounded border p-2">
                      <span>{invite.email} — {invite.role}</span>
                      <code className="break-all text-xs text-muted-foreground">{invite.link}</code>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep('upload')}>Skip</Button>
                  <Button onClick={() => setStep('upload')}>Continue</Button>
                </div>
              </div>
            )}

            {step === 'upload' && (
              <form className="space-y-4" onSubmit={handleUpload}>
                <div className="space-y-2">
                  <Label htmlFor="companyName">A company to track (optional)</Label>
                  <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. a portfolio company name" />
                </div>
                <Button type="submit">Finish</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
  ```

- [ ] **Step 2: Manually verify**

  Sign up as a new user, walk all four steps, confirm in the Supabase dashboard that `orgs`,
  `org_members` (role `admin`), and — if a company name was entered — `companies` rows exist, and
  that any generated invite link's row appears in `invites` with `status = 'pending'`.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/onboarding
  git commit -m "feat: onboarding wizard"
  ```

---

## Task 11: Invite-accept page

**Depends on:** Task 6 (`getInvitePreview`, `acceptInvite`).

**Files:**
- Create: `src/app/invite/[token]/page.tsx`

**Interfaces:**
- Consumes: `getInvitePreview`, `acceptInvite` (Task 6), `createBrowserSupabaseClient` (Task 2).
- Produces: the `/invite/[token]` route generated links from Task 10 point to.

- [ ] **Step 1: Write the page**

  Create `src/app/invite/[token]/page.tsx`:

  ```tsx
  'use client';

  import { use, useEffect, useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { createBrowserSupabaseClient } from '@/lib/supabase/client';
  import { acceptInvite, getInvitePreview, type InvitePreview } from '@/lib/org/invites';

  export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();
    const supabase = createBrowserSupabaseClient();
    const [preview, setPreview] = useState<InvitePreview | null | 'loading'>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      getInvitePreview(supabase, token).then(setPreview);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    async function handleAccept() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      const result = await acceptInvite(supabase, token);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      router.push('/');
    }

    if (preview === 'loading') return null;
    if (preview === null) {
      return <div className="mx-auto max-w-sm py-16 text-center text-sm text-muted-foreground">This invite link is invalid or has expired.</div>;
    }

    return (
      <div className="mx-auto flex max-w-sm flex-col justify-center py-16">
        <Card>
          <CardHeader>
            <CardTitle>Join {preview.orgName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You&apos;ve been invited as {preview.role === 'admin' ? 'an admin' : 'a member'}.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleAccept} disabled={preview.status !== 'pending'}>
              {preview.status === 'pending' ? 'Accept invite' : 'Already accepted'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  ```

- [ ] **Step 2: Manually verify**

  Open an invite link generated in Task 10 in a private/incognito window, sign up as the invited
  teammate, land back on `/invite/[token]`, click "Accept invite," confirm redirect to `/` and a
  new `org_members` row with the invited role.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/invite
  git commit -m "feat: invite-accept page"
  ```

---

## Task 12: README note on the auth setup

**Depends on:** Tasks 1–11 (documents the finished feature).

**Files:**
- Modify: `README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add a section**

  Add a section to `README.md` (near the existing "Run It Yourself" section) documenting: the
  Supabase env vars now required, that `pnpm dev` will redirect to `/sign-in` until an account
  exists, and the sign-up → onboarding → invite flow at a high level. Point at the spec
  (`docs/superpowers/specs/2026-09-05-auth-onboarding-foundation-design.md`) for full detail
  rather than duplicating it.

- [ ] **Step 2: Commit**

  ```bash
  git add README.md
  git commit -m "docs: readme note on supabase auth setup"
  ```
