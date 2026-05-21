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
| E1 · NSW Calculator | 🔄 in flight | 10% | ●○○○○ | 0 | 0 | Spec v0.3.0 written on branch `001-nsw-calculator`. Awaiting PM sign-off on PM-1 (mobile scope) + PM-2 (LLM vendor). Dev-findings.md routed to developer agent. |
| E2 · All-State Coverage | ☐ planned | 0% | ○○○○○ | 0 | 0 | Blocked on E1 proving the rules-engine pattern on NSW. |
| E3 · Audit Upload and Variance Report | ☐ planned | 0% | ○○○○○ | 0 | 0 | Moved ahead of API integrations on PM direction (2026-05-21). CSV-only ingest. |
| E4 · Payroll System Integrations | ☐ planned | 0% | ○○○○○ | 0 | 0 | Vendor priority TBD. Depends on E2 having ≥2-3 states encoded. |

## Drilldown

### E1 · NSW Calculator
- **Phase**: Phase 1
- **Pipeline**: ●○○○○ (Stage 1 · Specified — partial; awaiting PM sign-off on PM-1 + PM-2)
- **Branch**: `001-nsw-calculator`
- **Spec**: `.specify/features/001-nsw-calculator/spec.md` v0.3.0
- **Dev findings**: `.specify/features/001-nsw-calculator/dev-findings.md` (17 findings — 0 HIGH, 8 MEDIUM, 9 LOW)
- **PM items awaiting sign-off**:
  - **PM-1**: mobile-browser scope (v0.3.0 defaults to "responsive, best-effort")
  - **PM-2**: LLM vendor for PDF extraction (v0.3.0 defaults to Anthropic Claude no-retention tier)
- **Pre-flight blockers** (still open from product.md §14):
  - APA portal hosting + auth model (working default: standalone + deep-link)
  - Quality-gate sign-off process for the gold-standard test suite
- **Next action**: PM resolves PM-1 and PM-2; developer agent invokes `dev-planning` with the spec path to produce `impl-plan.md` and `tasks.md`

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
