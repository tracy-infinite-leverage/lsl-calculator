# LSL Calculator · Epic Status · Last updated: 2026-05-24 · E1 NSW SHIPPED (Phases 1+2+3 live on lsl-calculator.vercel.app) · E2 Phase 1 foundation merged (PR #8 at `56ae5fd`) · E2 Phase 3 T3.0 VIC test-cases drafted (awaiting PM sign-off)

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
| E2 · All-State Coverage | 🔄 in flight | 25% | ●●○○○ | 0 | 0 | Spec v0.3.0 + impl-plan + tasks committed (10 phases, 76 tasks). **Phase 1 foundation MERGED** (PR #8 at `56ae5fd`). **Phase 3 T3.0 VIC test-cases drafted** at `docs/qa/test-cases-vic.md` (61 cases, 13 TBDs flagged — awaiting PM sign-off to unblock T3.1+). Next action: PM sign off VIC test-cases OR resolve TBD-VIC-01/08/12 first, then start T3.1 (VIC rule-set scaffold). |
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
- **Phase**: **Phase 1 Foundation in PR #8** on `e2-phase-1-foundation` — gate to E1 cleared 2026-05-24 when NSW shipped
- **Pipeline**: ●●○○○ (Stage 1 Specified done; Stage 2 In flight — Phase 1 foundation feature-complete in PR #8, QA PASSED with notes)
- **Spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.0 (all 6 OQs resolved 2026-05-23 across two clarification rounds)
- **Plan + tasks**: `.specify/features/002-all-state-coverage/{impl-plan,tasks}.md` (10 phases, 76 tasks, 35-52 dev-days)
- **Dev findings**: `.specify/features/002-all-state-coverage/dev-findings.md` (0 HIGH, 6 MEDIUM, 5 LOW — DEV-E2-M1, M3, M4, M6, L1, L4 closed in PR #8; M2, M5, L2, L3 deferred to per-state phases)
- **Resolved decisions (v0.3.0)**:
  - **RES-1 (priority order)**: VIC → QLD → WA → SA → ACT → TAS → NT (population-weighted, VIC first on divergence-risk).
  - **RES-2 (epic structure)**: One bundled epic on the roadmap; per-state test gate inside — each state must pass its own gold-standard suite at 100% before being marked done within E2.
  - **RES-3 (legislation monitoring)**: Manual, **owner is Tracy personally for all 8 jurisdictions**, **quarterly cadence (1 Mar / 1 Jun / 1 Sep / 1 Dec)** + on-trigger override on gazetted amendments. No automated watch.
  - **RES-4 (mixed-state bulk timing)**: Mixed-state CSV accepted from v1 (day one). Per-row `state` column is **mandatory**. Row-level validation surfaces unrecognised/empty states as errors; valid rows in the same batch still process.
  - **RES-5 (cross-jurisdictional advisory heuristic)**: F13 manual nomination remains MUST in v1; F25 heuristic advisory removed from v1 scope and deferred to v2.
  - **RES-6 (sign-off authority)**: PM-only sign-off per state. **No APA-engaged payroll specialist co-signer.** Per-state launch gate (AC4b) = PM signoff on `test-cases.md` + automated suite 100% green in CI on merge commit.
- **Phase 1 status**: MERGED to `main` at `56ae5fd` (PR #8). NSW gold-standard 153/153 byte-identical. State-selector component built behind `NEXT_PUBLIC_STATE_SELECTOR_ENABLED` (not rendered on any page yet — wired in during Phase 3). cash_out trigger scaffold added. CI matrix workflow scaffolded. QA verdict: PASSES WITH NOTES.
- **Phase 3 T3.0 status**: VIC test-cases document drafted at `docs/qa/test-cases-vic.md` on branch `pm/vic-test-cases`. 61 test cases (53 single-mode + 3 bulk-mode + 5 transitional + edge cases) covering VIC LSL Act 2018 sections 6–17, 22–23, 34, 57 + 1992 Act provisions preserved via s.57. 13 TBDs flagged for PM decision — TBD-VIC-01 (dual-regime interpretation), TBD-VIC-08 (LWOP cumulative-vs-per-period 52-wk cap), and TBD-VIC-12 (spec citation correction s.67 → s.34) are Severity 1 and MUST be resolved before T3.2.
- **Pre-flight blockers**: **None.** T3.0 in PM review; T3.1+ gated on PM sign-off of `test-cases-vic.md`.
- **Next action**: PM resolves Severity-1 TBDs and signs `docs/qa/test-cases-vic.md`, then T3.1 (VIC rule-set scaffold) unblocks. Phase 2 (mixed-state bulk CSV foundation) can run in parallel with VIC work per impl-plan §Effort summary.

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
