# QA Report — PR #11 — E2 VIC user-facing + product rename to "LSL Calculator"

**Date:** 2026-05-25
**Branch:** `e2-vic-user-facing-rename`
**HEAD:** `f7ae642` — "feat(E2): VIC user-facing + product rename — single-cutover"
**Reviewer:** QA agent
**Verdict:** **PASSES WITH NOTES** — safe to merge after P1 follow-up below or with explicit operator acknowledgement.

---

## 1. Branch state

- **At start:** `e2-vic-user-facing-rename`, HEAD `f7ae642`, working tree had one local uncommitted edit on `website/src/app/page.tsx` (operator copy tweak — `"Calculate for many"` → `"Calculate for multiple employees"`) and an untracked `website/.claude/` (preview-server launch config). Not introduced by QA.
- **At end:** Same branch, HEAD unchanged, working tree unchanged. No commits, no push.

---

## 2. NSW byte-identical — CRITICAL gate

**Verdict: PASS.** Five independent pieces of evidence:

1. **517/517 unit tests pass** in 1.70s. 24 test files. Includes the entire NSW suite.
2. **`dispatch.test.ts` "byte-identical to calculateNSW for an NSW-only employee" passes** — this is the load-bearing assertion that swapping `calculateNSW` → `dispatch.calculate` did not change a single byte of the NSW result for an NSW-only employee.
3. **NSW gold-standard 153/153 passes** in 476ms — every NSW fixture (TC-NSW-001 through TC-NSW-053).
4. **TC-NSW-024 Playwright E2E produces $9,880.04** in both dev and production-build modes — this runs through the new dispatcher path (`single-mode-form.tsx` calls `calculate` from `@/lib/lsl/dispatch`, not `calculateNSW`).
5. **All 13 dispatcher tests pass** including the NSW + VIC happy-path, governing-jurisdiction routing, and the cash-out failure path.

Dispatcher swap independently verified by grep — zero remaining direct `calculateNSW` / `calculateNSWSafe` calls outside tests, NSW engine internals, and the `engine/index.ts` barrel re-export.

---

## 3. Rename completeness — user-facing audit

**Verdict: PASS on the product-name rename, with P1/P2 stale-copy issues found inside the calculator UI.**

### Product name "NSW LSL Calculator" / "NSW Long Service Leave Calculator"

`grep -rin "NSW LSL Calculator\|NSW Long Service Leave Calculator" website/src/` returns **zero matches**. Confirmed in-browser on `/`, `/calculator/single`, `/calculator/bulk`, `/privacy`:

| Surface | Title | Header brand | Old-brand string in HTML |
|---|---|---|---|
| `/` | `LSL Calculator` | `LSL Calculator` | absent |
| `/calculator/single` | `LSL Calculator` | `LSL Calculator` | absent |
| `/calculator/bulk` | `Bulk LSL calculator` | `LSL Calculator` | absent |
| `/privacy` | `Privacy notice \| LSL Calculator` | `LSL Calculator` | absent |

OG metadata correctly renders as `og:title = "LSL Calculator"`. Description mentions "NSW and VIC available" which is accurate.

Layout / header / footer / privacy / bulk page / unblock modal / result panel default copy — all clean.

### Stale NSW-only copy still leaking to users

These are NOT product-name leaks but are NSW-specific copy/citations that VIC users will now see in the calculator UI:

| # | Location | Stale string | Reachability for VIC user | Severity |
|---|---|---|---|---|
| **A** | `website/src/app/(calculator)/calculator/bulk/_components/identity-form-dialog.tsx:161` | State dropdown item: `{s !== 'NSW' && ' (E2 — not yet computable)'}` — shows "**VIC (E2 — not yet computable)**" | **HIGH** — every bulk-mode user clicking the per-row identity editor sees VIC labelled as not-yet-shipped, contradicting the rest of the UI which now offers VIC as shipped. | **P1** |
| **B** | `website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx:304` | Gross-pay hint: `"The 'ordinary pay' gross figure per NSW LSA s.3(2). v1 does not decompose components — provide the gross."` | **HIGH** — visible to every single-mode user (NSW and VIC). VIC users see an NSW citation under the gross-pay field. The VIC e2e Playwright test (`vic-mode.spec.ts:69`) explicitly works around this by scoping its NSW negative-assertion to the citation list — i.e. the dev knew about this string and chose not to clean it. | **P2** |
| **C** | `website/src/components/lsl/classifier-confirm-modal.tsx:26-28` | Category A / B / C descriptions all cite `NSW LSA s.4(5)(b)/(c)/(d)` and describe NSW's 2-tier averaging (current-vs-5yr, 12mo-vs-5yr). | **MEDIUM** — only fires when classifier flags ambiguous, but applies to ALL employees including VIC. A VIC casual will be shown NSW categories + NSW citations + the wrong averaging methodology (VIC uses 3-tier 52/260/whole-period, not 12mo/5yr). | **P2** |
| **D** | `website/src/app/(calculator)/calculator/single/_components/types.ts:110` | `STATE_OPTIONS` checkbox list label: `'Transfer of business (s.4(6))'` — that's NSW LSA s.4(6); VIC's transfer-of-business is s.11(3). | **LOW** — service-event dropdown label. VIC user adding a transfer-of-business event sees the NSW citation. | **P3** |

### "v1 supports NSW only" engine-internal strings — independently assessed

Dev flagged 4 lines in `states/nsw/index.ts`. Independent assessment:

- **Line 25 (function comment)**: not user-facing — dead text, OK.
- **Line 46 (single-state non-NSW)**: only reachable if `governingJurisdiction === 'NSW'` AND `statesOfService === [<non-NSW>]`. The single-mode form auto-syncs these (`single-mode-form.tsx:351-353`), so under normal UI flow this is unreachable. Bulk-mode rows that came pre-flagged with NSW governing + non-NSW state could in theory route here, but the identity-form-dialog defaults `stateCode` to NSW. Effectively dead in practice.
- **Line 59 (multi-state, no governing)**: form validation (`form-to-engine.ts:39-40`) BLOCKS multi-state without governing, so this is unreachable from the single-mode UI. Bulk-mode CSV parser populates governing too. Effectively dead.
- **Line 81 (governing != NSW reaching NSW engine)**: dispatcher routes by governing — if governing is VIC, dispatcher routes to VIC, never reaches NSW's gate. Effectively dead.

Dev's claim that these 4 lines are "dead text" is correct in the current UI flow. **Recommendation: keep them on the follow-up cleanup list** (low priority — they would only fire if engine code is reused programmatically outside the UI, in which case the message is also misleading because VIC is now supported).

---

## 4. State selector — visible/functional verdict

**Verdict: PASS.**

Verified in-browser on `/calculator/single`:

- `<StateSelector>` renders inside the Jurisdiction card with label "Governing jurisdiction".
- Dropdown contents:
  - NSW — enabled
  - VIC — enabled
  - QLD (coming soon) — disabled
  - WA (coming soon) — disabled
  - SA (coming soon) — disabled
  - ACT (coming soon) — disabled
  - TAS (coming soon) — disabled
  - NT (coming soon) — disabled
- Default = NSW (preserves byte-identical UX for users who don't touch the selector).
- All 8 state-of-service checkboxes still present below the selector (cross-jurisdiction detection).

---

## 5. VIC e2e Playwright verdict

**Verdict: PASS — and the test is genuinely load-bearing.**

| Run | Result |
|---|---|
| `npx playwright test` (dev mode) | 26/26 passed in 4.7s, including all 3 vic-mode tests |
| `PLAYWRIGHT_PRODUCTION_BUILD=1 npx playwright test` | 26/26 passed in 8.0s — production bundle gate clean |

`e2e/vic-mode.spec.ts` reads as follows:

- **Test 1 ("VIC 8-year termination produces VIC-cited result")** seeds a VIC-only employee via localStorage (`statesOfService: ['VIC']`, `governingJurisdiction: 'VIC'`), navigates to single-mode, clicks Calculate, and asserts BOTH:
  - Positive: a VIC LSL Act 2018 citation surfaces inside `<ol aria-label="Legislative citations">`.
  - Negative: NO `NSW LSA s.` citation appears in the citation list.
  - This is unambiguous proof the dispatcher routed to the VIC engine and that the form is no longer hardcoded to NSW.
- **Test 2** asserts the hero `<h1>` reads "Australian LSL calculator" — Tracy's operator-edited copy.
- **Test 3** asserts the header brand reads "LSL Calculator" AND does NOT contain "NSW LSL".

The citation-list scoping in test 1 (line 71) is the test author working around stale `"NSW LSA s.3(2)"` copy still present in the gross-pay hint — see finding **B** above.

---

## 6. B1 firing — `vic_cashout_hard_error`

**Verdict: PASS — clean implementation.**

Located in `single-mode-form.tsx` line 121-133:

```ts
try {
  const r = calculate(employee, trigger);
  setResult(r);
  // ── B1: fire VIC cash-out hard-error page event when the engine returns
  // a failed Result with the VIC-specific prohibition code. null payload
  // per spec S2 (no PII). [...]
  if (
    r.status === 'failed' &&
    r.error?.code === 'vic_cashout_prohibited'
  ) {
    trackStateEvent('VIC', 'cashout_hard_error', {});
  }
  ...
```

Independently verified:

- **Fires when**: `r.status === 'failed'` AND `r.error?.code === 'vic_cashout_prohibited'`.
- **Does NOT fire on NSW cash-out**: NSW throws `CashOutNotSupportedError` with code `cash_out_not_supported` (different code) — confirmed at `engine/errors.ts:53`. The dispatcher's `calculateSafe` converts the throw into a failed Result with that code, which does NOT match the B1 condition.
- **Does NOT fire on success paths**: gated on `r.status === 'failed'` first.
- **Payload is `{}`** — wire event becomes `vic_cashout_hard_error` with payload `{ state: 'VIC' }` (state is auto-included by `trackStateEvent`). No employee id, name, wage, or date. Conforms to spec S2 (no PII).
- The cross-test `dispatch.test.ts` confirms the dispatcher returns `{ status: 'failed', error: { code: 'vic_cashout_prohibited' } }` for VIC + cash_out — so the upstream condition is reliably reachable.

---

## 7. Cross-jurisdiction blocker for non-shipped states

**Verdict: PASS.**

- `dispatch.ts:71-88`: when the resolved state has no rule set, returns `{ status: 'blocked_cross_jurisdiction', warnings: [{ code: 'cross_jurisdiction_pending', message: "Calculator does not yet support QLD. Currently supported: NSW, VIC. This employee will be skipped." }] }` — does NOT throw.
- `calculateSafe` (line 94-111) returns the same shape — bulk-mode rows isolated.
- `result-panel.tsx:37-48` renders blocked status as an Alert with title "Cross-jurisdiction: calculation blocked" and the warning message — friendly UX, no stack trace.
- Telemetry: no `trackStateEvent` call fires on `blocked_cross_jurisdiction` from the form (only B1's failed-VIC-cashout branch fires). The unsupported state's payload is therefore not leaked through analytics.
- Unit test confirms: `dispatch.test.ts > blocks unshipped governing state with cross_jurisdiction_pending` and `> blocks unshipped state without throwing` both pass.

---

## 8. PDF report citation derivation

**Verdict: PASS.**

`api/export-pdf/route.tsx:293-312` defines `deriveJurisdictionLine(citations)`:

- Inspects `citation.section` prefixes — `"NSW"` or `"VIC"` — and accumulates the set.
- Returns:
  - NSW only → `"Long Service Leave Act 1955 (NSW)"`
  - VIC only → `"Long Service Leave Act 2018 (VIC)"`
  - Both → `"Long Service Leave Act 1955 (NSW) · Long Service Leave Act 2018 (VIC)"`
  - Empty → `"Long Service Leave Act"` (defensive fallback).
- Live test: POSTed a VIC-cited payload (`section: 'VIC LSL Act 2018 s.6'`) to `/api/export-pdf` — returned 200 OK with `Content-Type: application/pdf`. Endpoint is healthy.
- Citation prefixes verified: NSW engine emits `"NSW LSA s.X"`, VIC engine emits `"VIC LSL Act 2018 s.X"` and `"VIC LSL Act 1992 s.X"`. Both prefix-match correctly.

No payload schema change was needed — derived from existing citation strings.

---

## 9. Browser smoke (Claude Preview)

Already covered above (sections 3 and 4). Summary:

- All four routes load without error.
- HTML `<title>`, `og:title`, header brand all read "LSL Calculator" (or with route-specific prefix).
- Old brand "NSW LSL Calculator" absent from every rendered route.
- StateSelector dropdown enumerates 8 states with NSW/VIC enabled and 6 disabled with "(coming soon)".
- One stale NSW citation visible inline ("NSW LSA s.3(2)" gross-pay hint) — see finding B.

---

## 10. Independent assessment of dev's 3 flagged follow-ups

1. **4 stale "v1 supports NSW only" strings in `states/nsw/index.ts`** — **VERIFIED dead in current UI flow.** Dev's claim is correct (see §3 above). NOT a P1. Worth a small cleanup PR.
2. **Pre-existing Radix uncontrolled→controlled warning** — **VERIFIED pre-existing.** `git show main:.../single-mode-form.tsx` confirms the `value={state.X || undefined}` idiom existed for `employmentType` (line 272) and `terminationReason` (line 485) before this PR. The new StateSelector uses the same idiom — propagates the existing warning shape but does not introduce a new class of bug.
3. **OG meta tags added for first time** — **VERIFIED correct.** `layout.tsx:21-26` adds `openGraph.title = "LSL Calculator"` and a description matching the page description. No conflicts, no duplicate tags.

---

## 11. Bugs found — classified

| ID | Location | Description | Severity |
|---|---|---|---|
| **PR11-P1-01** | `bulk/_components/identity-form-dialog.tsx:161` | State dropdown labels VIC as **"VIC (E2 — not yet computable)"** in the bulk-mode per-row identity editor. Contradicts the rest of the UI (which now ships VIC) and will mislead bulk-mode users. **Stale gating from before VIC engine landed.** | **P1** |
| **PR11-P2-01** | `single/_components/single-mode-form.tsx:304` | Gross-pay hint reads `"per NSW LSA s.3(2)"` — visible to all users including VIC. VIC's ordinary-pay statute is s.15 of the LSL Act 2018, not NSW LSA s.3(2). Dev was aware (vic-mode.spec.ts scopes around it). | **P2** |
| **PR11-P2-02** | `components/lsl/classifier-confirm-modal.tsx:26-28` | Categories A/B/C descriptions cite `NSW LSA s.4(5)(b)/(c)/(d)` AND describe NSW's 2-tier averaging methodology. Modal fires for VIC users when classifier is ambiguous, presenting incorrect citation and methodology for VIC. | **P2** |
| **PR11-P3-01** | `single/_components/types.ts:110` | Service-event dropdown label `'Transfer of business (s.4(6))'` — that's NSW. VIC's section is s.11(3). | **P3** |
| **PR11-P3-02** | `states/nsw/index.ts:25,46,59,81` | Dead-in-UI stale `"v1 supports NSW only"` warning strings. Dev acknowledged. | **P3** |
| **PR11-P3-03** | `bulk/_components/bulk-mode-form.tsx:49-52` | Sample CSV pasted in the UI only uses NSW employees. Could add a VIC example for discoverability. Cosmetic. | **P3** |

No P0 bugs found.

---

## 12. Overall verdict

**PASSES WITH NOTES — safe to merge after PR11-P1-01 follow-up OR with explicit operator acknowledgement that the bulk identity-form-dialog VIC labelling will be patched in a quick follow-up PR.**

The CRITICAL NSW byte-identical gate holds across five independent verification surfaces. The VIC engine is correctly wired into the UI, B1 telemetry fires cleanly with no PII, the cross-jurisdiction blocker shows friendly fallback messaging, and the product rename is complete on every user-facing surface that uses "NSW LSL Calculator" as a brand label.

The PR is held back from a clean PASS by:

- **PR11-P1-01** (high-confidence stale gating in bulk identity editor that contradicts the rest of the UI). Quick to fix — single line change in `identity-form-dialog.tsx`.
- **PR11-P2-01 / PR11-P2-02** (NSW citations leaking into the single-mode form's gross-pay hint and classifier modal for all users including VIC). Not blocking — content/copy follow-ups, not engine-layer issues.

Recommendation: merge PR #11 to ship the VIC engine + rename now (this PR is large and the operator wanted single-cutover), then spawn a small follow-up that addresses PR11-P1-01 immediately and PR11-P2-01 / PR11-P2-02 in the next sprint. If the operator prefers a clean PASS, hold PR #11 until at least PR11-P1-01 is fixed.

---

## Working tree at end of review

Untouched. The QA agent did not modify any source files. Tracy's local uncommitted edit on `website/src/app/page.tsx` (`"Calculate for many"` → `"Calculate for multiple employees"`) is unchanged and is not part of HEAD `f7ae642`.

## Artifact path

This QA report is saved to:

`/Users/tracyangwin/code-projects/lsl-calculator/docs/engineering/changes/2026-05-24-e2-vic-user-facing-rename/QA-REPORT.md`
