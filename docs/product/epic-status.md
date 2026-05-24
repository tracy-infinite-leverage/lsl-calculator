# LSL Calculator · Epic Status · Last updated: 2026-05-24 · E1 NSW Calculator SHIPPED — Phases 1+2+3 live on lsl-calculator.vercel.app (PR #3 merged at 50061f5)

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
| E1 · NSW Calculator | ✅ done | 100% | ●●●●● | 0 | 6 (Q-01..Q-04 fixed in PR #3; Q-05/Q-06 pre-existing single-mode items, separate cleanup ticket) | **SHIPPED 2026-05-24.** Phases 1+2+3 live on https://lsl-calculator.vercel.app (`lsl.austpayroll.com.au` pending DNS). PR #3 squash-merged at `50061f5`. Architectural fix removed server-side pdfjs (issue #5) in favour of Anthropic document content block. 319 unit tests + 92 Playwright across 4 browsers. Phase 7 (opt-in logins) deferred post-launch. |
| E2 · All-State Coverage | 🔄 in flight | 12% | ●○○○○ | 0 | 0 | Spec v0.3.0 + impl-plan + tasks committed on `002-all-state-coverage`. 10 phases, 76 tasks, 35-52 dev-days. Operator-override prepared E2 while E1 was at Phase 3; E1 now shipped so the override risk is resolved. Next action: when ready to start coding, dev runs Phase 1 (StateRuleSet interface, dispatcher, telemetry). VIC first per RES-1; T3.0 (test-cases-vic.md) is the gate before any VIC engine code. |
| E3 · Audit Upload and Variance Report | ☐ planned | 0% | ○○○○○ | 0 | 0 | Moved ahead of API integrations on PM direction (2026-05-21). CSV-only ingest. |
| E4 · Payroll System Integrations | ☐ planned | 0% | ○○○○○ | 0 | 0 | Vendor priority TBD. Depends on E2 having ≥2-3 states encoded. |

## Drilldown

### E1 · NSW Calculator
- **Phase**: **SHIPPED 2026-05-24**. Phases 1+2+3 in production.
- **Pipeline**: ●●●●● (Stage 5 · Shipped — live on lsl-calculator.vercel.app; custom domain `lsl.austpayroll.com.au` pending DNS at Cloudflare)
- **Merge commit**: `50061f5` on `main` (squash of PR #3, which followed up PR #1's earlier Phases 1+2 ship)
- **Issue #5 (P1)**: server-side pdfjs DOMMatrix crash on Vercel — fixed by removing pdfjs server-side entirely and using Anthropic document content block. Architectural improvement, not a band-aid.
- **Branch**: `001-nsw-calculator` (historical, no longer active); `phase-3-pdf-followup` (merged via PR #3)
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
- **Post-launch follow-ups**: (1) Cloudflare DNS for `lsl.austpayroll.com.au` (soft gate, Vercel-issued URL already live); (2) Q-05 + Q-06 pre-existing single-mode browser-only items — separate cleanup ticket; (3) issue #4 (P3 UX) on empty service-event rows blocking Calculate; (4) Phase 7 opt-in logins when there's customer pull for them.
- **Phase 7 scope (added 2026-05-23)**: opt-in user accounts with email + password (no magic links, no SSO, no OAuth). Adds `profiles` + `saved_calculations` Supabase tables with RLS, signup/login/reset flows, "my calculations" history view, and an account-deletion path. Triggers a privacy-notice revision (S1 changes from "no server-side employee data" to "permitted for authenticated users only").

### E2 · All-State Coverage
- **Phase**: Phase 1 (Specified, plan + tasks ready) — **gate to E1 cleared 2026-05-24 when NSW shipped**
- **Branch**: `002-all-state-coverage` (pushed to origin)
- **Spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.0 (all 6 clarifications resolved)
- **Plan + tasks**: `.specify/features/002-all-state-coverage/{impl-plan,tasks}.md` (10 phases, 76 tasks, 35-52 dev-days)
- **Priority order (RES-1)**: VIC → QLD → WA → SA → ACT → TAS → NT
- **Next action**: when operator gives the go-ahead, dev starts Phase 1 (StateRuleSet interface + dispatcher + telemetry). Phase 3 (VIC engine) is the first state-specific work; gated on T3.0 — PM-signed `docs/qa/test-cases-vic.md`.

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
