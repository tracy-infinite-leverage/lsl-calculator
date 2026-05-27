# Dev Layer Findings — 006-ui-design-system

**Generated:** 2026-05-27
**Source:** speckit-analyze v0.3 split through pm-analyze-split
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.4
**Phase 0 resolved:** 2026-05-27

These findings were routed to the developer agent. They are NOT surfaced to the operator.

All three findings are resolved as part of E6 Phase 0 (pre-planning decisions). No HIGH findings exist; the three MEDIUM/LOW findings below are closed below so Phase 1+ work proceeds without re-litigation.

---

## Findings table — STATUS UPDATED 2026-05-27

| ID | Issue | Section | Severity | Status | Resolution |
|----|-------|---------|----------|--------|------------|
| D-A07 | **PDF generation library selection.** §5.7 says "MUST keep PDF generation server-side or fully client-side without leaking tenant/PII data." Specific lib choice not specified. Candidates: server-side Puppeteer/Playwright (Chromium-based, large memory footprint), `@react-pdf/renderer` (React tree → PDF, no Chromium, deterministic), `pdfkit` (low-level Node), `wkhtmltopdf` (deprecated upstream). | §5.7 / §8.5 | MEDIUM | **resolved: `@react-pdf/renderer`** | See PD-1 below. Dependency `@react-pdf/renderer@^4.5.1` already present in `website/package.json` + lockfile (pre-installed during an earlier exploration; no new install required in Phase 0). Phase 4 Task 5.1 spike validates the citation-block rich-text path before Phase 5 commits. |
| D-A15 | **Lighthouse accessibility tooling.** §8.4 names Lighthouse with target ≥ 95. Lighthouse is fine but axe-core is the stronger a11y engine and is already implied in §8.2 acceptance criteria. | §8.4 | LOW | **resolved: axe-core (CI gate) + Lighthouse (Phase 3b observability)** | See PD-2 below. axe-core already wired into Playwright via `website/e2e/a11y.spec.ts` (hard gate, already running on PR). Lighthouse CI script lands at Task 4.7 (Phase 3b — Public calc re-skin) — explicitly deferred from Phase 0 because it is a per-route observability check that depends on the re-skinned `/` surface being in place. |
| D-A16 | **Storybook or equivalent for component library.** §8.2 says "Storybook or equivalent". Decision deferred to dev. | §8.2 | LOW | **resolved: Storybook 8, installed at Task 2.1 kickoff** | See PD-3 below. Decision is "yes Storybook 8, no Chromatic". Installation explicitly deferred from Phase 0 to Task 2.1 kickoff — there are no stories to author until E6.2 components exist, and a config-only install with empty stories is bloat that adds ~80MB of devDependencies + ~30s CI time for zero current value. |

---

## Phase 0 decisions — full rationale

### PD-1 — `@react-pdf/renderer` (resolves D-A07)

**Pick:** `@react-pdf/renderer` for all v1 PDF report templates (E6.5 + E6.6).

**Rationale:** Deterministic, pixel-stable output across runs and Vercel cold/warm invocations. No headless Chromium dependency (no 200MB+ serverless payload, no cold-start tax that scales with concurrency). React tree → PDF means report templates compose like any other React component, share design tokens via `lib/tokens.ts` (Task 2.4), and unit-test via the existing Vitest harness. No external service — PII / tenant data never leaves the Vercel function, honouring spec §5.7 + LAUNCH-GUARD posture. Trade-off accepted: CSS subset is restricted (flexbox + react-pdf primitives only — no grid, no arbitrary HTML); templates author against react-pdf primitives, not HTML/CSS. The citation-block rich-text path is the load-bearing risk; Phase 4 Task 5.1 spike validates it before Phase 5 commits. If the spike fails, fallback is server-side Puppeteer on the Vercel Node runtime (accepting the ~200MB payload + 1–2s cold-start tax) — revisit at Task 5.1 review gate.

**Dependency state:** `@react-pdf/renderer@^4.5.1` is already pinned in `website/package.json` line 22 and resolved in `website/package-lock.json`. **No Phase 0 install required.** Confirmed pre-existing — likely added during earlier exploration on a sibling branch. Lockfile is the source of truth; do not re-bump in Phase 0.

### PD-2 — axe-core (hard CI gate) + Lighthouse (Phase 3b observability) (resolves D-A15)

**Pick:** axe-core is the hard CI merge gate from E6.2 onward; Lighthouse is a non-blocking per-PR observability metric on `/` only, landing at Task 4.7 (Phase 3b).

**Rationale:** axe-core is the stronger a11y engine (catches more WCAG 2.2 issues, fewer false positives, deterministic across CI shards) and is already implied by §8.2 acceptance criteria. Lighthouse stays for the brand-credibility score reporting required in §8.4 AC but does NOT gate merges (it is noisy on flaky CPU runs in shared CI). Phase 0 does NOT add Lighthouse to CI — that is the explicit Phase 3b Task 4.7 deliverable. Adding it now would either (a) gate merges before there is anything to score against the re-skinned `/`, or (b) introduce a non-blocking workflow with no consumer — both are bloat.

**Current state (already operational, predates Phase 0):**
- `@axe-core/playwright@^4.11.3` is pinned in `website/package.json` line 41 + resolved in lockfile.
- `website/e2e/a11y.spec.ts` runs WCAG 2.2 AA scans against `/`, `/calculator/single`, `/calculator/bulk`, `/privacy`, and the bulk-mode preview state. Any serious/critical violation fails CI.
- The `playwright` job in `.github/workflows/ci.yml` runs the full E2E suite (including a11y.spec.ts) across chromium / webkit / firefox / mobile-chrome on every PR.
- This satisfies the PD-2 "hard CI gate" deliverable in full. **No Phase 0 CI workflow change needed.**

**Deferred to Phase 3b Task 4.7:** Lighthouse CI script for `/` (accessibility score ≥ 95, non-blocking, posted as PR comment). Rationale for deferral above — there is nothing to score until Phase 3b lands the re-skin.

### PD-3 — Storybook 8, install deferred to Task 2.1 kickoff (resolves D-A16)

**Pick:** Storybook 8 (no Chromatic) is the canonical component workbench from E6.2 onward. Cost guardrail: Chromatic visual-regression service is NOT adopted in v1.

**Rationale:** Industry-standard for shadcn-based component libraries; integrates cleanly with Next.js + Tailwind via the official framework preset; built-in a11y add-on (`@storybook/addon-a11y`) runs axe-core per story so component-level violations are caught before E2E. Operator + future designer-agent can review every variant in isolation without needing a route in the app. Trade-off accepted: ~80MB of devDependencies + ~30s of local CI time per build. Fallback if operator vetoes at Task 2.1 kickoff: ship a `/dev/components` Next.js route gated by `NEXT_PUBLIC_DEV_COMPONENTS_ENABLED` (no new deps, no a11y add-on); zero plan change required.

**Phase 0 deferral rationale (honest scope call):** Task 2.1 is the explicit owner of the `.storybook/main.ts` + `preview.ts` scaffold AND the `npm install @storybook/...` step AND the first axe-core add-on wire. Phase 0 cannot meaningfully half-do Task 2.1 — installing the dependency without the config produces a non-bootable Storybook; scaffolding the config without the dependency produces an unreferenced directory. Both are worse than just doing Task 2.1 cleanly at Phase 2 kickoff. The Phase 0 deliverable here is the **decision** (Storybook 8, no Chromatic, official Next.js preset), which is now committed in this file and in `impl-plan.md` §Phase 0. Operator can override at Task 2.1 kickoff with no plan churn.

[PHASE-0-NOTE: Task 2.1 (Storybook setup) is small enough — labelled S in tasks.md — that splitting it across Phase 0 + Phase 2 saves no time and risks half-state. Defer cleanly; document the pick; ship the install + scaffold together at Phase 2 kickoff.]

---

## What dev-feature-plan should do with these — DONE in Phase 0

- **D-A07**: ✅ resolved. `@react-pdf/renderer` confirmed in lockfile. Phase 4 Task 5.1 spike will validate the citation block + multi-page footer split before Phase 5.
- **D-A15**: ✅ resolved. axe-core hard gate operational (Playwright `a11y.spec.ts` + CI `playwright` job). Lighthouse explicitly deferred to Phase 3b Task 4.7.
- **D-A16**: ✅ resolved. Storybook 8 picked; install deferred to Task 2.1 (Phase 2 kickoff). Fallback path documented if operator vetoes.

## Cross-spec dependencies

- E6 ships in parallel with E5.1 (currently on `feat/E5.1-auth-slice`). E5.1 explicitly does NOT consume E6 design tokens. No merge conflict expected in the token layer, but watch for shadcn version drift between branches.
- E6.2 token layer is the hard gate to E5.2 implementation kickoff. If E6.2 slips, E5.2 must wait.
- The fallback in spec §3 (APA primary wordmark placeholder if E6.1 blocks > 14 days) removes the wordmark from the E5.2 critical path, but does NOT remove the token layer as a gate.

---

*End of dev findings. Consumed by `dev-feature-plan` Phase 0 — closed 2026-05-27.*
