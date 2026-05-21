# LSL Calculator · Epic Status · Last updated: 2026-05-21 · Phase in flight: Phase 1 · E1 Spec written

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
| E1 · NSW Calculator | 🔄 in flight | 25% | ●●○○○ | 0 | 0 | Spec v0.4.1 PM-signed-off. impl-plan + tasks (68 tasks/6 phases) + test-cases.md draft (60 cases, 8 TBDs) on branch `001-nsw-calculator`. Awaiting PM sign-off on test-cases.md to unlock Phase 1. |
| E2 · All-State Coverage | ☐ planned | 0% | ○○○○○ | 0 | 0 | Blocked on E1 proving the rules-engine pattern on NSW. |
| E3 · Audit Upload and Variance Report | ☐ planned | 0% | ○○○○○ | 0 | 0 | Moved ahead of API integrations on PM direction (2026-05-21). CSV-only ingest. |
| E4 · Payroll System Integrations | ☐ planned | 0% | ○○○○○ | 0 | 0 | Vendor priority TBD. Depends on E2 having ≥2-3 states encoded. |

## Drilldown

### E1 · NSW Calculator
- **Phase**: Phase 1
- **Pipeline**: ●●○○○ (Stage 1 · Specified — complete; Stage 2 · In flight — dev-planning underway)
- **Branch**: `001-nsw-calculator`
- **Spec**: `.specify/features/001-nsw-calculator/spec.md` v0.4.1 (PM-signed-off)
- **Dev findings**: `.specify/features/001-nsw-calculator/dev-findings.md` (22 findings + 1 carried OQ — 0 HIGH, 11 MEDIUM, 11 LOW)
- **Scope (v0.4.1)**:
  - Two modes: single employee (form) + bulk upload (CSV or PDF) of any payroll report
  - Gross-only inputs; no pay-component decomposition; no bonus high-income threshold test in v1
  - NSW only; cross-jurisdiction detection blocks per-employee until governing state nominated
- **PM sign-offs (2026-05-21)**: PM-A mobile = responsive best-effort; PM-B bulk trigger = `as_at` default; OQ-B LLM = Anthropic Claude API no-retention.
- **Pre-flight blockers** (still open from product.md §14):
  - APA portal hosting + auth model (working default: standalone + deep-link)
  - Quality-gate sign-off process for the gold-standard test suite (PM signs `test-cases.md` before rules-engine dev starts)
- **Next action**: developer agent invokes `dev-planning` against `spec.md v0.4.1` to produce `impl-plan.md` and `tasks.md`. After that, PM signs off `test-cases.md` and rules-engine work starts.

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
