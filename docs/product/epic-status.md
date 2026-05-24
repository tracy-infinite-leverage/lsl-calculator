# LSL Calculator · Epic Status · Last updated: 2026-05-24 · Phase in flight: Phase 3 (QA passed with notes — 1 P1 + 4 lower-priority findings) · E1 Phases 1+2 shipped

## Pipeline stages

| Stage | Gate question |
|-------|---------------|
| 1 · Specified | Is there a written spec with acceptance criteria? |
| 2 · In flight | Is active development underway? |
| 3 · Feature-complete | Does it meet every acceptance criterion? |
| 4 · Tested | Have all tests passed? |
| 5 · Shipped | Is it deployed and measurably impacting users? |

Status glyphs: 🔄 in flight · ✅ done · ⏳ partially done · ☐ planned · 🛑 paused

## At a glance

| Epic | Status | % done (est) | Pipeline | Open bugs | Closed bugs | Notes |
|------|--------|--------------|----------|-----------|-------------|-------|
| E1 · NSW Calculator | 🔄 in flight | 60% | ●●●●○ | 1 P1 + 4 lower | 0 | Phases 1+2+3 feature-complete on `001-nsw-calculator` (engine + single-mode UI + PDF export + PDF extraction via Anthropic Opus 4.7). 316 unit tests + 21 Playwright e2e green. Phase 3 QA PASSES WITH NOTES — see `docs/engineering/changes/2026-05-23-phase-3-pdf-extraction/QA-REPORT.md` for Q-01 (P1 dialog a11y), Q-02..Q-06 (P2/P3). Task 3.9 calibration deferred to Phase 6 launch gate (valid). Phase 7 added (post-launch logins, email+password only). |
| E2 · All-State Coverage | ☐ planned | 0% | ○○○○○ | 0 | 0 | Blocked on E1 proving the rules-engine pattern on NSW. |
| E3 · Audit Upload and Variance Report | ☐ planned | 0% | ○○○○○ | 0 | 0 | Moved ahead of API integrations on PM direction (2026-05-21). CSV-only ingest. |
| E4 · Payroll System Integrations | ☐ planned | 0% | ○○○○○ | 0 | 0 | Vendor priority TBD. Depends on E2 having ≥2-3 states encoded. |

## Drilldown

### E1 · NSW Calculator
- **Phase**: Phase 3 QA-passed with notes 2026-05-24 — Phases 1+2 shipped 2026-05-23, Phase 3 cleared by QA with 1 P1 (dialog a11y) + 4 lower-priority findings
- **Pipeline**: ●●●●○ (Stage 3 · Feature-complete — Phases 1+2+3 done; Stage 4 · Tested — Phase 3 QA pass with notes 2026-05-24, Q-01 P1 to fix before customer traffic)
- **Branch**: `001-nsw-calculator` (pushed to origin)
- **Spec**: `.specify/features/001-nsw-calculator/spec.md` v0.5.0 (PM-signed-off 2026-05-21)
- **Test cases**: `.specify/features/001-nsw-calculator/test-cases.md` v1.1 (PM-signed-off 2026-05-21, 60 cases, all 8 TBDs resolved)
- **Plan + tasks**: `.specify/features/001-nsw-calculator/{impl-plan,tasks}.md` (82 tasks across 7 phases — Phase 7 added 2026-05-23 for opt-in logins, post-launch follow-on)
- **Dev findings**: `.specify/features/001-nsw-calculator/dev-findings.md` (22 findings + 1 carried OQ — 0 HIGH, 11 MEDIUM, 11 LOW)
- **Scope (v0.5.0)**:
  - Two modes: single employee (form) + bulk upload (CSV or PDF) of any payroll report
  - Gross-only inputs; no pay-component decomposition; no bonus high-income threshold test in v1
  - No hours-per-week or hourly-rate inputs; weekly gross is the load-bearing input
  - F8 Cat B = Cat C math (greater of 12mo / 5yr weekly avg); Cat A unchanged
  - NSW only; cross-jurisdiction detection blocks per-employee until governing state nominated
  - `as_at` mode reports accrued value; UI labels "accrued, not currently payable" when payout conditions aren't met
- **PM sign-offs (2026-05-21)**: PM-A mobile = responsive best-effort; PM-B bulk trigger = `as_at` default; OQ-B LLM = Anthropic Claude API no-retention; all 8 Phase-0 TBDs resolved.
- **Pre-flight blockers** (still open from product.md §14):
  - APA portal hosting + auth model (working default: standalone + deep-link)
- **Next action**: Developer fixes Q-01 (preview-dialog label / Select a11y in `editable-preview-table.tsx`) and Q-02 (add dialog axe coverage to `a11y.spec.ts`) before merge to main. Q-03 / Q-04 / Q-05 / Q-06 go to the launch-gate punch list. QA verdict: PASSES WITH NOTES — full report at `docs/engineering/changes/2026-05-23-phase-3-pdf-extraction/QA-REPORT.md`. AC3, AC26, AC27, AC28 functionally pass in browser; 316 vitest + 21 Playwright green on the branch tip. Task 3.9 calibration deferred to Phase 6 — valid (informational gate, CSV fallback present).
- **Phase 7 scope (added 2026-05-23)**: opt-in user accounts with email + password (no magic links, no SSO, no OAuth). Adds `profiles` + `saved_calculations` Supabase tables with RLS, signup/login/reset flows, "my calculations" history view, and an account-deletion path. Triggers a privacy-notice revision (S1 changes from "no server-side employee data" to "permitted for authenticated users only").

### E2 · All-State Coverage
- **Phase**: Phase 1
- **Blocked on**: E1 reaching Stage 5 (Shipped) or at least Stage 4 (Tested) on NSW
- **Next action**: hold until E1 ships, then specify per-state work packages in priority order

### E3 · Audit Upload and Variance Report
- **Phase**: Phase 1
- **Pre-flight blockers**: audit data acquisition path (see Open Decisions in product.md)
- **Next action**: hold until E1 NSW rules engine is stable, then specify CSV import + replay + variance report

### E4 · Payroll System Integrations
- **Phase**: Phase 2
- **Pre-flight blockers**: first payroll-vendor selection; OAuth/API access agreements with vendor
- **Next action**: hold until E2 has at least 2-3 states encoded and E3 audit-replay is in production

## Obsolete / won't fix

_None yet._
