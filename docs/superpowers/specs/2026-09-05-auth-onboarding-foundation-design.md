# Auth & Onboarding Foundation — Design

Status: approved
Date: 2026-09-05
Sub-project 1 of 5 in the broader "landing page + signup/signin/team management" initiative:
1. **Auth & Onboarding Foundation** (this doc)
2. Team & permissions management refinements (invite acceptance UX polish, admin role management screen)
3. Landing page
4. Multi-company document tracking (real upload → extraction pipeline wiring)

Sub-projects 2–4 are out of scope here and will get their own design docs.

## Context

The app (WinBack) currently has zero auth: no landing page, no signup/signin/forgot-password,
no user/org/team/permission concept anywhere in the data model, and every route (including all
`/api/*` pipeline routes) is open. `firebase` / `firebase-admin` are installed as unused
dependencies. The product also assumes exactly one hardcoded target company
(`src/data/target`) — real multi-company document tracking is deferred to a later sub-project.

## Decisions locked in during brainstorming

- **Supabase** for both auth and DB (Postgres), standardized as the only backing store going
  forward. Drop `firebase` / `firebase-admin` — nothing depends on them yet.
- Auth method: **email + password only** (no OAuth for now).
- **Gate the existing app now** — every existing route/screen requires a signed-in user, not just
  the new auth pages.
- Invite delivery: **copyable link only**, no real email sending.
- Permission model: **two roles, org-wide** — `admin` (edit) and `member` (view). No per-resource
  granularity.
- Multi-company scope: **stub only**. A `companies` table exists so the onboarding wizard's
  "upload documents" step has something to attach files to, but wiring those documents into the
  real extraction pipeline is explicitly deferred to sub-project 4.
- UI is **intentionally basic** (plain shadcn forms, no custom visual design) — a designer pass
  happens later and would only be thrown away if built now.

## Architecture

- `@supabase/supabase-js` + `@supabase/ssr` for session handling via cookies, compatible with
  Next.js middleware.
- `middleware.ts` at the repo root protects every route except: `/sign-in`, `/sign-up`,
  `/forgot-password`, `/reset-password`, `/invite/[token]`. (The root `/` — currently the Plan
  screen — becomes a protected route too; it is *not* being turned into the public landing page in
  this sub-project.)
- `getUserId()` becomes the single auth-check surface, used both in `middleware.ts` (cookie
  presence only, per the ERD's existing pattern since Supabase server clients can run in
  middleware) and inside route handlers.

## Data model (new Supabase tables)

`auth.users` is Supabase-managed and not modeled here.

```sql
profiles     (id uuid references auth.users, full_name text, created_at timestamptz)
orgs         (id uuid, name text, created_at timestamptz)
org_members  (org_id uuid, user_id uuid, role text check (role in ('admin','member')),
              created_at timestamptz, primary key (org_id, user_id))
invites      (id uuid, org_id uuid, email text, role text check (role in ('admin','member')),
              invited_by uuid, status text check (status in ('pending','accepted','revoked')),
              created_at timestamptz, expires_at timestamptz)
companies    (id uuid, org_id uuid, name text, created_at timestamptz)
```

Row-level security on every table: a user may read/write rows only where they have an
`org_members` row for that `org_id`. `admin` role is required for writes to `orgs`, `invites`,
and `companies`; `member` role is read-only on all of them. This RLS layer is the actual
enforcement of "admin = edit, member = view" — UI controls are hidden for members as a UX nicety,
not as the security boundary.

## Auth flows

- **Sign up** (`/sign-up`): email + password via Supabase Auth → inserts `profiles` row → redirect
  into the onboarding wizard.
- **Sign in** (`/sign-in`): email + password.
- **Forgot password** (`/forgot-password` → email link → `/reset-password`): Supabase's built-in
  password-reset flow.
- **Invite accept** (`/invite/[token]`): validates the invite (exists, `pending`, not expired). If
  the visitor isn't signed in, prompts sign-up/sign-in first, then inserts the `org_members` row
  with the invited role and marks the invite `accepted`.

## Onboarding wizard

Four steps, each skippable except company details (an org is required before anything else makes
sense):

1. **Your details** — full name (email/password already captured at sign-up).
2. **Company details** — org name → creates `orgs` row, creator becomes `admin` via `org_members`.
3. **Invite teammates** — repeatable email + role rows → creates `invites` rows, surfaces each as a
   copyable `/invite/[token]` link. Skippable.
4. **Upload documents** — name one or more companies to track → creates `companies` rows, basic
   file upload to Supabase Storage against each. No extraction wiring. Skippable.

Wizard completion redirects to `/` (the existing Plan screen, today's closest thing to a
dashboard).

## Route guards

Every existing route and API handler gets a `getUserId()` guard:
`/`, `/deal/[id]/*`, `/graph`, `/api/docs`, `/api/extract`, `/api/benchmark`, `/api/portfolio`,
`/api/crosscheck`, `/api/memo`, `/api/graph`. Unauthenticated requests are redirected
(pages) or receive a 401 (API routes) — no change to the pipeline logic itself.

## Explicitly out of scope for this sub-project

- Real document → extraction pipeline wiring per company (sub-project 4)
- Per-resource granular permissions
- Real invite emails
- Landing page
- Any visual design polish beyond plain functional shadcn forms

## Testing

- Unit tests for invite-token validation and role-check helpers (pure TypeScript, no Supabase
  network calls).
- Manual verification of each flow end-to-end (sign up → onboarding → sign out → sign in → invite
  accept → forgot password), consistent with the ERD's "testing proportionate to time" principle.
- No RLS policy test harness for now — reviewed by inspection against the flows above.
