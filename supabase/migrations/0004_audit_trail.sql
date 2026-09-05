-- 0004_audit_trail.sql
--
-- Phase 6.3 — Audit trail. `runs` is a lightweight anchor row (the pipeline's
-- actual output stays client-side/localStorage — Phase 6.2 saved sessions is
-- not in scope); `run_audit` is the append-only log. Both are owned solely by
-- the creating user — the pipeline has no org/company concept yet, so this
-- does not attempt to piggyback on the orgs/companies tables from
-- 0001_auth_foundation.sql.

create table runs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table runs enable row level security;

create policy "runs: owner all" on runs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table run_audit (
  id text primary key,
  run_id text not null references runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null check (actor in ('system', 'model', 'analyst')),
  action text not null check (action in (
    'stage_started', 'stage_completed', 'stage_failed', 'statement_generated',
    'evidence_dropped', 'analyst_accepted', 'analyst_dismissed', 'analyst_edited',
    'memo_status_changed', 'session_created', 'session_viewed', 'session_deleted'
  )),
  stage text check (stage in ('extract', 'benchmark', 'portfolio', 'decision', 'memo')),
  statement_id text,
  statement_text text,
  evidence jsonb not null default '[]'::jsonb,
  provenance jsonb,
  before text,
  after text,
  note text
);

alter table run_audit enable row level security;

-- Append-only: SELECT + INSERT policies only. No UPDATE/DELETE policy exists,
-- so those operations are denied by default under RLS — this is the "policy,
-- not storage guarantee" append-only property erd.md Part 9.2 calls for.
create policy "run_audit: owner read" on run_audit for select
  using (user_id = auth.uid());

create policy "run_audit: owner insert" on run_audit for insert
  with check (user_id = auth.uid());

-- Entries sort lexicographically by time via `id` alone (erd.md §9.2), but an
-- index still speeds "give me this run's entries newest first."
create index run_audit_run_id_id_idx on run_audit (run_id, id desc);
