# LSL Calculator · Epic Status · Last updated: 2026-05-23 · Phase in flight: Phase 3 · E1 Phases 1+2 shipped · E2 spec v0.3.0 fully clarified

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
| E1 · NSW Calculator | 🔄 in flight | 45% | ●●●○○ | 0 | 0 | Phases 1+2 shipped on `001-nsw-calculator` (engine + single-mode UI + PDF export). 227 unit tests, 3 Playwright E2E, $9,880.04 load-bearing case asserted in browser. Phase 3 next (PDF extraction via Anthropic). Phase 7 added (post-launch logins, email+password only). |
| E2 · All-State Coverage | 🔄 in flight | 12% | ●○○○○ | 0 | 0 | Stage 1 · Specified — drafted in parallel with E1 on operator override (2026-05-23). Spec v0.3.0 — **all 6 OQs resolved**, ready for plan + tasks. No pre-flight blockers remain. Held at Specified until operator triggers `dev-feature-plan`; no development until E1 reaches Stage 4 minimum. |
| E3 · Audit Upload and Variance Report | ☐ planned | 0% | ○○○○○ | 0 | 0 | Moved ahead of API integrations on PM direction (2026-05-21). CSV-only ingest. |
| E4 · Payroll System Integrations | ☐ planned | 0% | ○○○○○ | 0 | 0 | Vendor priority TBD. Depends on E2 having ≥2-3 states encoded. |

## Drilldown

### E1 · NSW Calculator
- **Phase**: Phase 3 (PDF extraction) — Phases 1+2 shipped 2026-05-23
- **Pipeline**: ●●●○○ (Stage 1 · Specified — complete; Stage 2 · In flight — Phases 1+2 done, Phase 3 next)
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
- **Next action**: developer agent starts **Phase 3** (PDF extraction via Anthropic Claude API) per `tasks.md` §3. Phases 1+2 are green (227 vitest + 3 Playwright passing on push `78e0ee7`).
- **Phase 7 scope (added 2026-05-23)**: opt-in user accounts with email + password (no magic links, no SSO, no OAuth). Adds `profiles` + `saved_calculations` Supabase tables with RLS, signup/login/reset flows, "my calculations" history view, and an account-deletion path. Triggers a privacy-notice revision (S1 changes from "no server-side employee data" to "permitted for authenticated users only").

### E2 · All-State Coverage
- **Phase**: Phase 2 (originally) — being specced in Phase 1 on operator override 2026-05-23
- **Pipeline**: ●○○○○ (Stage 1 · Specified — in flight, all clarifications complete)
- **Branch**: `002-all-state-coverage` (created from `main` 2026-05-23)
- **Spec**: `.specify/features/002-all-state-coverage/spec.md` v0.3.0 (**all 6 OQs resolved 2026-05-23**, ready for `dev-feature-plan`)
- **Dev findings**: `.specify/features/002-all-state-coverage/dev-findings.md` (0 HIGH, 6 MEDIUM, 5 LOW — engineering decisions for Phase 0 of plan)
- **Resolved decisions (v0.3.0, 2026-05-23 across two clarification rounds)**:
  - **RES-1 (priority order)**: VIC → QLD → WA → SA → ACT → TAS → NT (population-weighted, VIC first on divergence-risk).
  - **RES-2 (epic structure)**: One bundled epic on the roadmap; per-state test gate inside — each state must pass its own gold-standard suite at 100% before being marked done within E2.
  - **RES-3 (legislation monitoring)**: Manual, **owner is Tracy personally for all 8 jurisdictions**, **quarterly cadence (1 Mar / 1 Jun / 1 Sep / 1 Dec)** + on-trigger override on gazetted amendments. No automated watch.
  - **RES-4 (mixed-state bulk timing)**: Mixed-state CSV accepted from v1 (day one). Per-row `state` column is **mandatory** with non-empty value drawn from currently-encoded states. No single-state-only-per-state interim mode. Row-level validation surfaces unrecognised/empty states as errors; valid rows in the same batch still process.
  - **RES-5 (cross-jurisdictional advisory heuristic)**: Operator delegated to PM. **PM recommendation applied: F13 manual nomination remains MUST in v1; F25 heuristic advisory removed from v1 scope and deferred to v2.** Rationale: 100%-match quality gate vs. legal-judgement test; F14 caveat already mandatory; asymmetric persistent downside of a wrong heuristic in contested matters; v2 escape valve preserved.
  - **RES-6 (sign-off authority)**: PM-only sign-off per state. **No APA-engaged payroll specialist co-signer.** Per-state launch gate (AC4b) = PM signoff on `test-cases.md` + automated suite 100% green in CI on merge commit. No additional human-in-the-loop step.
- **Pre-flight blockers**: **None.** All six v0.1.0 OQs are resolved. The earlier "nominated owner of manual legislation monitoring" hard pre-flight blocker is now cleared (RES-3 names Tracy).
- **Risk acknowledged**: NSW Phase 3–7 work may shift the rules-engine pattern (e.g., interface contract DEV-E2-M1) and force E2 spec re-work. Operator accepted the risk to keep E2 queued in parallel with NSW finishing.
- **Next action (PM)**: spec is feature-complete on the PM layer. Operator can now trigger `dev-feature-plan` against `.specify/features/002-all-state-coverage/spec.md` to generate `impl-plan.md` + `tasks.md`. **Do not hand off to developer for implementation yet** — operator wants E2 specced + planned only; developer remains on NSW Phase 3 until E1 is at Stage 4.
- **Next action (dev) when unblocked**: read `001-nsw-calculator/spec.md` + the shipped NSW rule-set module, then resolve DEV-E2-M1 (engine-rule-set interface) as the first Phase 0 task of `dev-feature-plan` when E2 enters Stage 2. First state to encode per RES-1: **VIC**.

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
