-- Migration: orgs_llm_assist_enabled
-- Phase:     E5.3 Pay-Code Mapping — Phase 1 (data layer)
-- Task:      T1.6 — Per-org LLM-assist opt-out toggle
-- Spec ref:  pay-code-mapping.md §8 OQ-MAP-5 (LOCKED — default-on with opt-out)
-- Plan ref:  pay-code-mapping-impl-plan.md §2.6
-- AC ref:    AC-MAP-16
--
-- Per operator's 2026-06-01 OQ-MAP-5 lock: LLM-assisted column/value mapping
-- defaults ON for every org, with a per-org opt-out toggle on the org settings
-- page. When `ANTHROPIC_API_KEY` is unset the wizard fails soft regardless of
-- this column's value (server-side check happens before the column is read).
--
-- Forward-only; no down migration.

ALTER TABLE public.organisations
  ADD COLUMN llm_assist_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organisations.llm_assist_enabled IS
  'E5.3 OQ-MAP-5 (LOCKED 2026-06-01) — per-org opt-out for LLM-assisted '
  'column/value auto-detection. Default ON. When false, the mapping wizard '
  'runs deterministic-pass-only and surfaces a "LLM assistance disabled by '
  'org admin" notice. Admin surface lands in Phase 4 of E5.3.';
