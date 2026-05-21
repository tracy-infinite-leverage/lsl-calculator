# LSL Calculator · Epic Status · Last updated: 2026-05-21 · Phase in flight: Phase 1

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
| E1 · One-State Calculator | ☐ planned | 0% | ○○○○○ | 0 | 0 | Awaiting state choice (Open Decisions in product.md). Spec not yet written. |
| E2 · All-State Coverage | ☐ planned | 0% | ○○○○○ | 0 | 0 | Blocked on E1 proving the rules-engine pattern. |
| E3 · Payroll System Integrations | ☐ planned | 0% | ○○○○○ | 0 | 0 | Vendor priority TBD. |
| E4 · Audit Upload and Variance Report | ☐ planned | 0% | ○○○○○ | 0 | 0 | Sequencing vs. E3 flagged in Open Decisions. |

## Drilldown

### E1 · One-State Calculator
- **Phase**: Phase 1
- **Pre-flight blockers**: which state ships first; APA portal hosting + auth model
- **Next action**: PM to resolve state choice and hosting model → run `pm-epic-writing` full workflow (speckit-specify → clarify → analyze → epic) on E1 to produce `.specify/features/001-one-state-calculator/spec.md`

### E2 · All-State Coverage
- **Phase**: Phase 1
- **Blocked on**: E1 reaching Stage 5 (Shipped) or Stage 4 (Tested) for the chosen first state
- **Next action**: hold until E1 ships, then specify per-state work packages

### E3 · Payroll System Integrations
- **Phase**: Phase 2
- **Pre-flight blockers**: first payroll-vendor selection; OAuth/API access agreements with vendor
- **Next action**: hold until E2 has at least 2–3 states encoded

### E4 · Audit Upload and Variance Report
- **Phase**: Phase 2
- **Pre-flight blockers**: open question on whether E4 should ship before E3 — see `product.md` Open Decisions
- **Next action**: revisit sequencing before E3 enters discovery

## Obsolete / won't fix

_None yet._
