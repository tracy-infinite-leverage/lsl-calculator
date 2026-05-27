-- Migration: harden_phase4_functions
-- Phase: E5.1 Auth — Phase 4 (database schema, post-advisor hardening)
-- Task: 4.4 follow-up — resolve Supabase security advisor WARNs surfaced after
--        the initial Phase 4 apply on 2026-05-27.
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/auth.md §9
-- Forward-only; no down migration.
--
-- Advisor findings addressed:
--   • 0011 function_search_path_mutable on public.tg_set_updated_at
--   • 0028 anon_security_definer_function_executable on public.handle_new_user
--   • 0029 authenticated_security_definer_function_executable on public.handle_new_user
--
-- The remaining INFO-level finding (`rls_enabled_no_policy` on
-- `auth_audit_log`) is intentional — that table is service-role-only and
-- carries no policies for `anon` / `authenticated` by design (spec §9.4).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Pin search_path on tg_set_updated_at.
--    The function body only touches NEW.updated_at (trigger-context) and so
--    needs no schema-qualified references; an empty search_path is safe and
--    defends against any future body changes assuming a writable schema.
-- ───────────────────────────────────────────────────────────────────────────
alter function public.tg_set_updated_at() set search_path = '';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Revoke direct RPC access to handle_new_user.
--    The function exists to run as an AFTER INSERT trigger on auth.users
--    (`SECURITY DEFINER`). It should NOT be reachable as a public RPC, where
--    `NEW` is undefined and any direct call would fail in confusing ways — or
--    succeed in ways we haven't audited.
--
--    Postgres grants EXECUTE to PUBLIC by default on function creation, so we
--    must revoke from PUBLIC (not just from anon/authenticated specifically —
--    they inherit via PUBLIC). The trigger path keeps working because
--    SECURITY DEFINER triggers execute as the function owner, not the caller.
-- ───────────────────────────────────────────────────────────────────────────
revoke execute on function public.handle_new_user() from public, anon, authenticated;
