# E6 Plan + Tasks — Adversarial Grilling Report

**Date:** 2026-05-27
**Reviewer:** product-manager agent (pm-grill-with-docs)
**Inputs grilled:**
- `.specify/features/006-ui-design-system/impl-plan.md` (untracked, dev agent draft)
- `.specify/features/006-ui-design-system/tasks.md` (untracked, 45 tasks across 6 sub-epics)

**Reference docs:**
- `.specify/features/006-ui-design-system/spec.md` v0.4 (operator-approved 2026-05-27)
- `.specify/features/006-ui-design-system/dev-findings.md`
- `docs/product/epic-status.md` (E6 marked v0.4 APPROVED)
- `docs/product/epics.md`
- `docs/launch/LAUNCH-GUARD.md` (gate closed by elimination 2026-05-27)
- `.claude/rules/global-engineering.md`, `.claude/rules/agent-routing.md`

---

## VERDICT

**APPROVE WITH FIXES.**

The plan honours the spec broadly — every §8 AC has at least one traceable task and every resolved OQ is treated as a constraint rather than re-litigated. **But the plan has one structural sequencing fault that, if left as written, will block the Phase 5a deliverable behind an unrelated epic, and three MEDIUM gaps around CSP/security guards, cross-epic interface definition, and effort sizing on the design phase.**

---

## Headline finding

**Task 5.5 couples the public-calc PDF endpoint to "existing Supabase session middleware from E5.1", but spec §5.3 (resolved OQ-6) mandates the public-calc PDF CTA is unconditional and unauthenticated. The PDF endpoint cannot inherit auth or it breaks the public-calc download path.**

This is recoverable with a one-line plan amendment, but it is load-bearing — it determines whether Phase 5a ships in this E6 cycle or trails E5.1's merge to `main`.

---

## Findings by severity

| Severity | Count |
|---|---|
| HIGH | 1 |
| MEDIUM | 6 |
| LOW | 5 |
| **Total** | **12** |

---

## Findings table

| ID | Severity | Section / task | Issue | Proposed remediation |
|---|---|---|---|---|
| **G-1** | **HIGH** | impl-plan §1.3 + tasks Task 5.5 | API endpoint "inherits the existing Supabase session middleware from E5.1" — but spec §5.3 mandates the public-calc PDF CTA is **unconditional and unauthenticated** (OQ-6). The single-employee + bulk-summary download CTA on `/` is served to anonymous users. If `/api/reports/:family` requires a Supabase session, the public CTA returns 401 and OQ-6 is silently broken. Additionally, E5.1 has not merged to `main` — coupling to it makes Phase 5a (which the plan claims is independent of E5) blocked behind an unmerged branch. | Split `/api/reports/:family` into two posture branches: **public families** (`single-employee`, `bulk-summary`) — no auth, no tenant data; **authenticated families** (`liability`, `reconciliation`) — Supabase session required and inherited from E5.1. Add an explicit task documenting the posture split. Add a guard test asserting `POST /api/reports/single-employee` returns 200 without an auth header. |
| G-2 | MEDIUM | tasks Task 3.3 + impl-plan §1.1 architectural decision 4 | TenantContext "hydrates from a server-rendered session cookie" — but the cookie shape is owned by E5.1 (auth slice). E5.1 has not merged. The plan does not specify the cookie's claim shape, signing model, or the TypeScript interface E6.3 will read against. Cross-epic interface contract is implicit. Task 3.3 will hit a "what does the cookie look like?" wall on day one. | Add a sub-task (or amend Task 3.3) defining the `SessionCookieClaims` TypeScript interface as a contract artifact under `lib/auth/session-claims.ts` — fields `activeTenantId`, `homeTenantId`, `membershipCount`, plus the claim-issuer expectation. Both E5.1 and E6.3 read against this contract. Stub it now so E6.3 can build against the type even if E5.1's implementation is still in flight. |
| G-3 | MEDIUM | impl-plan §5.7 / tasks (missing) | Spec §5.7 mandates "MUST NOT introduce any dependency that breaks the existing CSP or violates LAUNCH-GUARD posture." Three new dependencies land in Phase 0/2 (`@react-pdf/renderer`, `@storybook/*`, `@axe-core/playwright`) plus self-hosted fonts. None of the phase gates explicitly verifies the production CSP still permits the resulting bundle, and no task audits the runtime network panel for unexpected third-party requests (the spec specifically calls out the no-third-party-font-CDN guard at §5.1). | Add a guard task to Phase 2 ("Task 2.10 — CSP + network-panel audit") that (a) runs `npm run build` and inspects the resulting `_next/static/*` chunks for any embedded third-party URL, (b) loads `/` and `/app/*` in a fresh browser with DevTools open and asserts no third-party network request appears, (c) confirms the production CSP header (currently default Next.js) still passes a build smoke test. Run on every PR touching `tailwind.config.ts`, `app/layout.tsx`, or `public/fonts/*`. |
| G-4 | MEDIUM | tasks Task 1.2 (Effort: M) | "Designer agent runs 1–3 wordmark candidates; operator picks." Sized as M (1–3 days). Spec §3 fallback caps the design phase at 14 days. The plan's stated critical-path estimate ("~1 design-week") only fits if Task 1.2 hits the bottom of the M range. **In practice, wordmark approval cycles with a non-technical operator typically run 5–10 business days** (multiple candidates → revisions → operator approval → favicon export). Sizing M may understate Phase 1 by 2–5 days. | Re-size Task 1.2 to **L** (3–5 days) and note that wordmark approval *cycles* (Task 1.2 + 1.3 round-tripping) may consume up to the spec §3 14-day cap. Plan's "~1 design-week" claim should be expressed as a range: **3 days (happy path) to 14 days (fallback active)**. This is a docs fix, not a task addition. |
| G-5 | MEDIUM | tasks Task 4.6 + Task 6.3 | Task 4.6 ships the PDF download CTA in Phase 3b; Task 6.3 wires the actual download in Phase 5a. The plan says the CTA "renders disabled with a 'coming soon' badge OR is hidden behind a feature flag — operator's call at task kickoff" between Phase 3b ship and Phase 5a ship. **This is a soft contradiction with the spec §8.4 AC**: "PDF download CTA visible on single-employee result + bulk-summary screens, **unconditional** (no email capture). (OQ-6)" — visible-but-disabled is not unconditional in the user-outcome sense. If Phase 3b ships before Phase 5a, the public calc carries a dead CTA. | Add explicit sequencing guard: **Phase 3b does not merge to `main` until Phase 5a is merge-ready.** OR: gate the CTA behind `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED=false` until Phase 5a lands. Operator decides which is preferable at Task 4.6 kickoff, but the plan should not silently allow a dead-CTA shipping state. |
| G-6 | MEDIUM | tasks (missing) — Storybook footprint vs LAUNCH-GUARD posture | Storybook 8 adds ~80MB of devDependencies (per PD-3) and the plan accepts this. But there is **no task verifying Storybook does not leak into the production bundle**. If a Storybook addon imports into a story that gets accidentally re-imported by a real component, production bundle bloat happens silently. Spec §8.4 has Lighthouse ≥ 95 (perf-adjacent); a 100KB+ Storybook regression could push Lighthouse perf score below the brand-credibility threshold even if a11y stays clean. | Add bundle-budget assertion to Phase 2 or Phase 3b gate: `next build` + check `.next/analyze` output for any `@storybook/*` import in client-side bundle. Cheap: one `grep` + size threshold per route. |
| G-7 | MEDIUM | impl-plan §1.5 testing strategy | Spec SC-7 mandates "2214/2214 LSL suite + 92 Playwright tests across 4 browsers stay green on every PR." Plan's testing strategy table mentions this in row 1 + 2 but **does not include a CI guard task** that fails any E6 PR if either suite is touched-as-modified (vs just-green). A regression in `tests/` that happens to pass would still drift the contract. | Add Task 2.9-bis (or fold into Task 2.9): "Verify `git diff main -- tests/` is empty on every E6 PR" as a hard CI rule. Tests are off-limits for modification per spec §5.3; the guard makes that contract enforceable rather than honour-based. |
| G-8 | LOW | tasks Task 3.5 (the flagged judgement call) | Task 3.5 defaults to **skipping** the confirm dialog when acting on the user's home org. Spec §5.2 only mandates the dialog for non-home-tenant context — silent on home-org case. The default is defensible (confirm-on-every-action is hostile UX), and the AC explicitly tests both branches. **No spec violation, no weakening of SC-4** (zero mis-tenant incidents) — mis-tenant *only* happens off home org, so home-org skip is inside the safety envelope. Flag it for operator awareness, not for change. | None required. Operator should confirm this default at Task 3.5 kickoff and record the decision inline in the task; if any pilot user reports a near-miss in home-org context, the default flips. |
| G-9 | LOW | tasks Task 1.5 | Iconography direction document AC includes "hard deadline noted: custom icon set replaces Lucide **by the time E5.6 ships**" — but E5.6 is **not yet scoped** (per epic-status.md). The deadline is real, but there is no upstream task that surfaces it into E5.6's planning when E5.6 is eventually written. | When E5.6 spec is written (post-E5.5), the PM agent should add an explicit dependency line: "E5.6 ship blocked until custom icon set replaces Lucide (per E6 OQ-2 deadline)." This is a future-tense flag, not a current-cycle action. |
| G-10 | LOW | tasks Task 2.2 | Self-hosted fonts AC: "Lighthouse FCP / CLS metrics unchanged or improved vs baseline." There is **no baseline number captured** in the plan or spec. Without a recorded baseline, "unchanged or improved" is unfalsifiable. | Add a precursor sub-step in Task 2.2: "Record current Lighthouse FCP / CLS on `/` before touching fonts; pin numbers in `docs/qa/e6-baseline-metrics.md`. Post-change numbers must be within ±5% or strictly better." |
| G-11 | LOW | tasks Task 5.1 spike (PD-1 fallback) | Plan §PD-1 says: "If citation block rich text fails under react-pdf, fall back to server-side Puppeteer on Vercel's edge runtime with a documented cold-start mitigation." This is good. But **Puppeteer on Vercel edge is not a supported pattern** — Puppeteer requires a Node runtime + chromium-aws-lambda or similar. The fallback as written is technically misstated. | Amend PD-1: "fall back to server-side Puppeteer on Vercel **Node runtime** (not edge) with `chromium-aws-lambda` bundle, accepting the 200MB+ payload and ~1–2s cold-start tax." Decision still defers to Task 5.1 spike result; this is a wording fix only. |
| G-12 | LOW | tasks (missing) — Brand asset storage path | impl-plan §1.1 architectural decision 5: "Brand assets live in `docs/brand/`. Wordmark SVGs ship in-repo (under `docs/brand/wordmark/`) and are imported by `public/brand/` at build time, or copied directly. Decision in Task 1.4." Task 1.4 AC says "Build-time copy step (or symlink) documented in `docs/brand/wordmark/README.md`." **A symlink committed to a Next.js + Vercel build pipeline is fragile** (Vercel build container, OS-level differences). | Recommend Task 1.4 explicitly chooses **build-time copy via a `scripts/sync-brand-assets.{ts,sh}` invoked in `prebuild`**. One-line in `package.json`. Symlink option introduces a class of "works locally, breaks on Vercel" defects with no upside. Pre-commit to the safer default. |

---

## Tasks that should be ADDED

1. **Task 2.10 — CSP + bundle audit** (per G-3, G-6). Phase 2 acceptance gate addition.
2. **Task 2.11 — Test-folder diff guard** (per G-7). Tiny CI rule, lands with Phase 2.
3. **Task 5.5-bis — Public vs authenticated endpoint posture** (per G-1). Documents the auth split inside Phase 4 / Phase 5a.
4. **Task 3.3-bis — `SessionCookieClaims` contract type** (per G-2). Lands before Task 3.3 implementation.

These are 4 new tasks; revised total is **49 tasks**, not 45.

## Tasks that should be RE-SIZED

| Task | Current | Recommended | Reason |
|---|---|---|---|
| 1.2 | M | **L** | Wordmark approval cycles typically run longer than M (G-4) |
| 3.7 | M | **L** | Six empty states + Storybook stories + integration into six `/app/*` routes is more than 3 days. Plan understates. |
| 5.5 | M | **L** | API endpoint + posture split + 4 family dispatch + audit-log integration crosses M ceiling |

## Tasks that should be REMOVED

None.

## Spec amendments needed

**None.** The spec holds. Every grilling finding is plan-layer or task-layer — the spec's MUSTs, ACs, and resolved OQs are internally consistent.

The one borderline case is G-1 — the spec is silent on the auth posture of `/api/reports/:family`. It mandates the public CTA is unauthenticated (§5.3) and that PII never leaves the function (§5.7) but does not explicitly say "the endpoint serving the public family is unauthenticated." This is a plan-fills-the-gap moment, not a spec hole — the plan should resolve it inside Task 5.5. If the operator later wants explicit spec coverage, a tiny amendment to §5.4 "MUST split families by auth posture: public families served without authentication; authenticated families served behind Supabase session" would be the right shape. Not required for v0.4 to ship.

---

## Cross-cutting checks (spec ↔ plan ↔ epic-status fidelity)

| Check | Result |
|---|---|
| All 6 §8 ACs have at least one traceable task | ✅ PASS — every AC bullet maps to a task |
| All 12 resolved OQs treated as constraints | ✅ PASS — OQ-2 / OQ-3 / OQ-4 / OQ-5 / OQ-6 / OQ-8 / OQ-9 / OQ-10 / OQ-11 / OQ-12 / OQ-13 all referenced in task ACs; OQ-1 + OQ-7 baked into structure |
| Critical-path claim (Phase 1 + Phase 2 to unblock E5.2) | ✅ PASS — math is right; the claim of ~14 tasks is **15** by my count (T1.1–T1.5 + T2.1–T2.9 + T2.10 + T2.11 if added) but the spirit holds |
| §3 14-day fallback wired in | ⚠️ PARTIAL — referenced in Task 1.3 AC and impl-plan Phase 1, but no calendar/timer artifact tracks the 14-day countdown. Add a note in `docs/product/epic-status.md` E6 section: "Phase 1 kickoff date = TBD; 14-day fallback trigger = kickoff + 14 days." |
| E6.2 hard-gate to E5.2 honoured | ✅ PASS — impl-plan §3 dependency table + tasks.md critical-path diagram both call this out |
| Engine + test sanctity (SC-7) | ⚠️ PARTIAL — see G-7. Plan acknowledges the constraint but has no CI guard task enforcing test-folder immutability |
| LAUNCH-GUARD posture preserved | ✅ PASS — no `ANTHROPIC_API_KEY` reintroduction; no third-party font CDN; no external service for PDF; self-hosted assets only |
| Plan claims 45 tasks across 6 sub-epics | ⚠️ Numbers check out (5 + 9 + 10 + 8 + 7 + 4 + 2 = 45) but should rise to 49 with G-1, G-2, G-3, G-7 task additions |
| Designer-resource OQ-13 honoured | ✅ PASS — Task 1.2 assigned to in-team designer agent; Phase 1 explicitly marked "NOT an engineering phase"; developer agent does not write code in Phase 1 |
| epics.md ↔ epic-status.md ↔ spec consistency | ✅ PASS — all three describe the same 6 sub-epic structure, same gates, same OQ resolutions |

---

## Sign-off recommendation to operator

**Recommendation: Fix-then-commit. Send back to dev agent for a focused plan amendment (NOT a full re-plan).**

The plan is structurally sound. The HIGH finding (G-1) is a real defect but fixable with a 4–6 line amendment to Task 5.5 and a new Task 5.5-bis. The MEDIUM findings are guard tasks that strengthen the plan rather than reshape it. Total amendment scope: ~4 new tasks, 3 re-sized tasks, ~10 lines of plan text.

**Specifically:**

1. **Send the report back to the developer agent** with instruction: "Apply findings G-1, G-2, G-3, G-7 as task additions; G-4, G-5, G-11, G-12 as task edits; G-10 as a baseline-metrics precursor to Task 2.2. Re-size Tasks 1.2, 3.7, 5.5 to L."
2. **Do not start implementation** (do not branch from `main`, do not invoke `/speckit-implement`) until the amended plan is back.
3. **After the amendment lands**, the operator can do a quick second-pass grill (or self-review) and then commit `impl-plan.md` + `tasks.md` to the feature branch alongside the spec.
4. **No spec amendment needed.** v0.4 stands.

**Time cost of fix:** developer agent — under an hour. Risk if shipped as-is: G-1 surfaces as a 401 on the public PDF CTA in production, which is exactly the kind of regression spec §5.3 / OQ-6 exists to prevent.

**Honest summary:** this is solid first-pass dev work that traces the spec carefully and treats OQ resolutions as binding. The one structural fault is the auth-coupling-to-an-unmerged-epic, which is a sequencing slip rather than a thinking error. Fix it, ship it.

---

*End of grill report. No commit; no PR; no file modifications to spec / plan / tasks. Operator next action: route report back to developer agent or self-amend.*
