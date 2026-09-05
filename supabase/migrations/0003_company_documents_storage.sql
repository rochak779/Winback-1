-- 0003_company_documents_storage.sql
--
-- A private Storage bucket for documents uploaded against a tracked company
-- during onboarding. Objects are stored under `{orgId}/{companyId}/{filename}`.
-- RLS mirrors the `companies` table: members can view, only admins can upload.
-- No extraction pipeline wiring — files just land in Storage.

insert into storage.buckets (id, name, public)
values ('company-documents', 'company-documents', false)
on conflict (id) do nothing;

create policy "company-documents: members read"
  on storage.objects for select
  using (
    bucket_id = 'company-documents'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "company-documents: admins upload"
  on storage.objects for insert
  with check (
    bucket_id = 'company-documents'
    and is_org_admin((storage.foldername(name))[1]::uuid)
  );
