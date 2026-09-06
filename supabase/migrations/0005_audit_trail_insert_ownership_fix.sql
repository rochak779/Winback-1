-- 0005_audit_trail_insert_ownership_fix.sql
--
-- Fix for run_audit insert policy: verify that the run_id being referenced
-- actually belongs to the user, not just that the inserted row's user_id matches.
-- This prevents a user from inserting audit entries against another user's runs.

drop policy "run_audit: owner insert" on run_audit;

create policy "run_audit: owner insert" on run_audit for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from runs r where r.id = run_id and r.user_id = auth.uid())
  );
