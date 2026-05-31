-- Migration: employee_masterfile_storage_bucket
-- Phase: E5.2 Employee Masterfile — Phase 1 (database schema)
-- Task: 1.6 — Source-CSV preservation bucket + RLS policies
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §5
--            ("MUST preserve the original CSV file ... for audit purposes")
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §0 DEV-EMP-4, §3.1 Migration 6
-- AC ref:    AC-EMP-7 (PII strip — source CSV needed as the canonical pre-strip artefact)
-- Forward-only; no down migration.
--
-- Bucket name:     employee-masterfile-uploads (DEV-EMP-4 default)
-- Path convention: {org_id}/{YYYYMMDD}/{import_id}.csv (service-layer enforced)
-- Privacy:         private (public=false); RLS on storage.objects gates access
-- File-size limit: 50 MB (52428800 bytes) — covers ≤ 5k-employee customer files
-- MIME allowlist:  text/csv, application/vnd.ms-excel, text/plain
--
-- RLS pattern (mirrors the employees / employee_history pattern from Migrations 2 + 3):
-- - SELECT: any org_member of the row's org may read their org's uploads
-- - INSERT: only admin / payroll_user roles may upload (gated by storage.foldername(name)[1] = org_id)
-- - UPDATE / DELETE: not exposed to clients; retention job runs via SECURITY DEFINER context
--
-- FINDING-1.md applies: roles are 'admin' / 'payroll_user' / 'read_only' (no 'owner').

-- ───────────────────────────────────────────────────────────────────────────
-- Bucket
-- ───────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-masterfile-uploads',
  'employee-masterfile-uploads',
  false,
  52428800,                            -- 50 MB cap
  array['text/csv', 'application/vnd.ms-excel', 'text/plain']
)
on conflict (id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- RLS policies on storage.objects (RLS is already enabled by the Supabase platform).
-- Path convention is {org_id}/YYYYMMDD/{import_id}.csv — the first folder
-- segment is parsed via storage.foldername(name)[1] and matched against the
-- caller's org membership.
-- ───────────────────────────────────────────────────────────────────────────

-- SELECT: members read their own org's uploads
create policy "members read own org masterfile uploads"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'employee-masterfile-uploads'
    and (storage.foldername(name))[1]::uuid in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

-- INSERT: only admin/payroll_user may upload, and only to their org's folder
create policy "admin/payroll upload masterfile to own org"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'employee-masterfile-uploads'
    and (storage.foldername(name))[1]::uuid in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

-- No UPDATE / DELETE client policy — retention removal runs server-side via the
-- service-role key (or future retention job), not via the authenticated client.
