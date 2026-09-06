-- 0006_runs_no_delete.sql
--
-- Fix for final whole-branch review of Phase 6.3 (audit trail): the "runs:
-- owner all" policy granted DELETE, and run_audit's FK is ON DELETE CASCADE.
-- Postgres FK cascades bypass RLS, so a user calling PostgREST directly
-- (never exposed by the app UI) could delete their own runs row and
-- silently erase that run's entire audit trail — defeating the append-only
-- guarantee run_audit's own policies are built to provide. Narrowing this
-- to select+insert only closes that path the same way run_audit is already
-- protected.

drop policy "runs: owner all" on runs;

create policy "runs: owner select" on runs for select
  using (user_id = auth.uid());

create policy "runs: owner insert" on runs for insert
  with check (user_id = auth.uid());
