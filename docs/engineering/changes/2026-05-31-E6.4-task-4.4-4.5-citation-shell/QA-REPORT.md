# QA Report — PR #99 — E6.4 Tasks 4.4 + 4.5

**PR:** https://github.com/tracy-infinite-leverage/lsl-calculator/pull/99
**Branch:** `feat/E6.4-public-reskin` @ `662dc60`
**Worktree:** `/Users/tracyangwin/code-projects/lsl-e6-4`
**Reviewer:** QA agent
**Date:** 2026-05-31
**Verdict:** **PASS — approve for merge**

---

## Scope under review

| Task | What it ships | Files |
|---|---|---|
| 4.4 | Byte-for-byte snapshot test for `CitationBlock` markup | `website/src/components/lsl/citation-block.test.ts` (NEW, +136) |
| 4.5 | Header `Wordmark` (Candidate B, 160 CSS px, decorative + sr-only) | `website/src/components/shell/header.tsx` (+30 / −4) |
| 4.5 | Footer `Lockup` (stacked, wordmarkWidth=160) + "calculated, not advice" disclosure | `website/src/components/shell/footer.tsx` (+34 / −16) |
| 4.1 / 4.2 / 4.3 | Claim verification only — "already on brand tokens at branch cut" | n/a (no code change) |

Diff total: +200 / −20 across 3 files. PR scope is clean; no unrelated changes.

---

## Acceptance criteria — pass / fail

### Task 4.4 — Citation block byte-for-byte snapshot

| AC | Status | Evidence |
|---|---|---|
| Cat A/B/C result semantics + citation block content unchanged byte-for-byte | **PASS** | Snapshot test renders 5 scenarios via `react-dom/server`. All 5 pass on `662dc60`. |
| Snapshot covers the three Citation shapes the engine emits | **PASS** | Bare-minimum (section+rule), maximum-shape (section+rule+pdfPage+note), multi-citation source-ordered, dedup, empty array. All branches of `citation-block.tsx` exercised. |
| Snapshot test would catch a regression (not trivially permissive) | **PASS — VERIFIED VIA PERTURB-AND-REVERT** | Changed `font-semibold` → `font-bold` on the `c.section` `<p>` in `citation-block.tsx` line 37; 4 of 5 snapshots failed (the 5th is the empty-array case that never renders that element). Reverted via `git checkout -- …`; tree confirmed clean (`git status --short` empty); test re-run shows 5/5 green. |
| Snapshot lives outside protected paths (`website/e2e`, `website/src/lib/lsl/engine`, `website/src/lib/lsl/states`, `website/src/__tests__`) | **PASS** | Path is `website/src/components/lsl/citation-block.test.ts` — explicitly outside all four protected directories. CI `test-sanctity` guard reports SUCCESS. |
| 2214/2214 LSL suite green | **PASS** | All 8 state suites + engine suite SUCCESS on CI (`State suite · {nsw,vic,qld,wa,sa,act,engine}` + `Cross-state regression`). |
| 92 Playwright tests green | **PASS** | `Playwright (chromium · webkit · firefox · mobile-chrome)` SUCCESS. |

**Tightness assessment:** The snapshot is **tight enough to catch regression**. It pins:
- Element tag and order (`<ol>`, `<li>`, `<div>`, `<p>`)
- Every class name (`border-l-2 border-primary/40 pl-3 text-xs leading-relaxed`, `font-semibold text-foreground`, `text-muted-foreground font-mono text-[11px]`, italic note style)
- ARIA attributes (`aria-label="Legislative citations"`, BookOpen `aria-hidden="true"`)
- Inline plain text (`· LSL-training PDF p.{n}`)
- Source-order rendering and dedup-key composition (section + rule + pdfPage + note)
- Empty-array → empty-string contract

A change to *any* of those facets fails at PR time. Confirmed empirically.

### Task 4.5 — Header Wordmark + Footer Lockup + disclosure

| AC | Status | Evidence |
|---|---|---|
| Wordmark visible in `/` header | **PASS** | `header.tsx:35` renders `<Wordmark width={160} decorative />` inside the home `<Link>`. Asset `/brand/wordmark.svg` synced via `prebuild`. |
| APA Lockup visible in `/` footer | **PASS** | `footer.tsx:26` renders `<Lockup orientation="stacked" wordmarkWidth={160} />`. The `Lockup` component composes the Wordmark + "by Australian Payroll Association" tagline (per `Lockup.tsx`). |
| Footer disclosure includes "calculated, not advice" | **PASS** | `footer.tsx:38`: "*…Calculated, not advice — verify on the source statute for edge cases.*" Substring match satisfies the AC. |
| Playwright header contract preserved | **PASS** | `<span class="sr-only">LSL Calculator</span>` is a sibling of the decorative `Wordmark` inside the `<Link>`. `e2e/vic-mode.spec.ts:95` uses `toContainText('LSL Calculator')`, which reads `textContent` (includes `sr-only`). Playwright CI matrix is green. |
| Tab / focus order sensible | **PASS** | Header focus order: brand link → Single → Bulk (left-to-right). Footer focus order: Privacy link (only interactive element below the Lockup). No focus traps; no `tabIndex` overrides introduced. |
| Wordmark marked `decorative` to avoid duplicate screen-reader announcement | **PASS** | `Wordmark.tsx:119-120` sets `alt=""` and `aria-hidden` when `decorative` is true; the parent `<Link aria-label="LSL Calculator — home">` carries the accessible name. |

### Tasks 4.1 / 4.2 / 4.3 — "already on brand tokens" claim audit

Verified via import inspection (no code change in this PR; just confirming dev's assertion that the AC is already met by `main`):

| Task | Component(s) | Brand-token imports observed |
|---|---|---|
| 4.1 — State selector | `website/src/components/lsl/state-selector.tsx` | `@/components/ui/select`, `@/components/ui/button`, `@/components/ui/label` |
| 4.2 — Single-employee form | `website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx` | `@/components/ui/{card,input,label,button,checkbox,select,radio-group,alert}` + `@/components/brand/Icon` |
| 4.3 — Bulk-upload entry | `website/src/components/lsl/wage-history-upload.tsx` | `@/components/ui/{button,card,input,label,select,alert,badge}` |

**Claim verified.** All three surfaces already consume the E6.2 Phase 2 shadcn-on-brand-tokens primitives and the brand `Icon` barrel — no Phase 3b code change required to satisfy their `[ ] uses brand tokens` AC. Their Playwright-green AC is covered by the existing 92-test matrix, which is SUCCESS on this PR.

### Spec §8.4 — citation block byte-for-byte unchanged + OQ-10 voice alignment

- **Citation block byte-for-byte unchanged:** YES. Component file (`citation-block.tsx`) is not modified in this PR; the snapshot test pins its current output for the rest of E6.
- **OQ-10 voice match:** Partial — the substring "calculated, not advice" (the load-bearing OQ-10 token) is byte-identical between this footer and the planned PDF MethodologyFooter short version. The full footer line is *richer* than the PDF short version (the web footer also includes a citations-clarification preface), and the OQ-10 canonical short components "state-engine version + APA URL" are not surfaced in the web footer. The PR body slightly overstates "byte-identical to the upcoming E6.5 / E6.6 PDF MethodologyFooter short version" — but the AC ("disclosure line includes 'calculated, not advice'") is satisfied without ambiguity, and divergence between the web footer and the PDF page-2+ short footer is reasonable (web has more room than a page-bottom rule). **Not a blocker.** Filed as a minor doc-clarity note for the dev to address when E6.5 actually lands the PDF MethodologyFooter.

---

## CI status (remote)

All 14 checks SUCCESS at time of QA:

- TypeScript · Vitest · Build
- CSP header smoke test (Task 2.10b)
- State suites: nsw, vic, qld, wa, sa, act, engine
- Cross-state regression (engine-touching PRs)
- Playwright (chromium · webkit · firefox · mobile-chrome)
- Test-sanctity guard (spec §5.3 + SC-7)
- Vercel Preview deployment + Vercel Preview Comments

**Remote CI is NOT pending — it is green.** The PR body's checklist showed CI pending at dispatch time; the CI run completed at `2026-05-31T05:18:33Z` and all jobs returned SUCCESS.

---

## Findings

### P0 / P1 bugs

**None.**

### P2 (nice-to-have, post-merge)

1. **PR body wording slightly overstates the OQ-10 alignment.** The web footer is *richer* than the PDF short-version footer; only the "calculated, not advice" substring is byte-identical, not the entire line. Reword the PR description or the footer.tsx comment when the actual PDF MethodologyFooter lands in E6.5 / E6.6 so the cross-reference doesn't become stale. Not a blocker; the AC ("includes 'calculated, not advice'") is met without ambiguity.

2. **Header has redundant accessible-name signal.** The brand `<Link>` carries `aria-label="LSL Calculator — home"`, which overrides the link's accessible name; the sibling `<span class="sr-only">LSL Calculator</span>` is then ignored by screen readers but still needed to keep the Playwright `toContainText` contract green. Functionally correct, just slightly unusual. A cleaner pattern would be to drop the `aria-label` and let the sr-only text be the accessible name — but that's a refactor better tabled for E6.7 (general a11y polish) than this PR. **Not a blocker.**

### Read-only constraint compliance

- Perturb-and-revert verification used `git checkout -- website/src/components/lsl/citation-block.tsx` to fully restore the working tree.
- Post-verification `git status --short` returns empty.
- No `.ts` / `.tsx` file in the worktree is modified by this QA pass; only this report is being written under `docs/`.
- No files in `website/tests/`, `website/src/lib/lsl/`, `website/e2e/`, or any file outside this PR's diff was modified.

---

## Recommendation

**APPROVE for merge.** All Task 4.4 + 4.5 acceptance criteria pass; the citation snapshot is empirically tight enough to catch regression; the 4.1 / 4.2 / 4.3 "already on brand tokens" claim is verified by import inspection; the Playwright contract is preserved by the sr-only span. CI is fully green.
