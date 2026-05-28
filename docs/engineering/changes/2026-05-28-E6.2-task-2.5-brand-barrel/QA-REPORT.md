# QA-REPORT — E6.2 Task 2.5 (Brand barrel: Wordmark + Lockup + Icon)

**Date:** 2026-05-28
**Branch:** `feat/E6.2-task-2.5` (unpushed)
**Reviewer:** qa agent
**Base:** `origin/main` @ `865f101`
**Handoff:** `docs/engineering/changes/2026-05-28-E6.2-task-2.5-brand-barrel/HANDOFF.md`

---

## VERDICT

**FAIL — send back to dev.**

**Blocking:** AC3 fails — the Icon barrel is missing 5 of the 15 icons that `docs/brand/icon-direction.md §5` mandates as the brand-v1 minimum. The dev's own contract test in `brand.test.ts` was rewritten to silently skip the 5 missing icons (commented-out array entries with a self-justifying note), so the test passes despite the spec divergence. This is the most load-bearing AC of the task — the whole point of the OQ-2 one-file-swap mechanism is that the barrel matches the documented v1 surface — and it is not met.

Everything else is genuinely well-built: the migration is correct, the ESLint rule fires precisely, the sync script is idempotent, axe-core is clean, vitest count matches, build/Storybook build/typecheck all clean. With AC3 fixed (and AC10 lint-baseline note acknowledged), this PR is ready.

---

## AC table

| AC | Status | Commands run | Evidence |
|---|---|---|---|
| **AC1** — Wordmark renders 3 variants, SVG paths match Task 1.4 install paths | **PASS** | `diff -q docs/brand/final/wordmark/*.svg website/public/brand/*.svg`; `Read Wordmark.tsx` | All 3 variant URLs (`/brand/wordmark.svg`, `/brand/wordmark-mono.svg`, `/brand/wordmark-white-on-navy.svg`) map 1:1 to the install paths in `docs/brand/final/README.md` lines 61, 65, 67. `diff` reports the synced files are byte-identical to the source masters. |
| **AC2** — Lockup orientation × variant cross-product (6 combos) | **PASS** | `Read Lockup.tsx`; Storybook story list confirms 6 Lockup stories | Lockup props expose `orientation ∈ {stacked, horizontal}` and `variant ∈ {default, mono, inverse}`. 6 Lockup stories built into `storybook-static/`: `stacked`, `horizontal`, `stacked-mono`, `stacked-inverse`, `horizontal-inverse`, `custom-tagline`. Tagline classes (`taglineClasses`) correctly switch `text-brand-white` on inverse, `text-brand-charcoal` otherwise. |
| **AC3** — Icon barrel exposes all 15 spec §5 icons (plus extras allowed) | **FAIL** | `python3 audit` against `Icon.tsx`; `Read Icon.stories.tsx`; `Read brand.test.ts` | **5 of the 15 spec icons are MISSING from the barrel:** `CalendarRange`, `DollarSign`, `Settings`, `Search`, `Filter`. The barrel exports 32 icons but it is NOT a superset of the documented v1 minimum. Worse: the dev's own contract test (`brand.test.ts:84-127`) was rewritten to comment out exactly these 5 names from its assertion array — see lines 99, 105, 107, 108, 110 — with the comment "not yet on main, doc-only placeholder." That contradicts both the icon-direction §5 explicit-15 contract AND the test's own purpose statement on line 16 ("re-exports every identifier listed in icon-direction.md §5"). The `BrandV1Set` story in `Icon.stories.tsx:65-92` claims to render "The 15-icon brand-v1 minimum" but renders a substituted set (Download, Upload, Info, BookOpen instead of the missing 5). |
| **AC4** — ESLint rule blocks `lucide-react` in product code, allows shadcn `ui/` carve-out | **PASS** | `Write` throwaway file in `src/` and `src/components/ui/`; `npx eslint <file>` | Product-code file (`src/qa-lucide-leak-check.tsx`) → ESLint emits **1 error**: `'lucide-react' import is restricted from being used. Import icons from '@/components/brand/Icon' instead...` Shadcn-carve-out file (`src/components/ui/qa-lucide-leak-check.tsx`) → ESLint returns **no errors** (correct — the rule's `ignores: ["src/components/ui/**"]` honours the carve-out per spec §7.2). Both test files removed; `git status` confirms no leftover modifications. |
| **AC5** — 12 product call sites migrated to the barrel | **PASS** | `git diff origin/main -- website/src` | Spot-checked 4 of 12: `src/app/page.tsx` (3 icons), `src/app/(calculator)/error.tsx` (1), `src/components/lsl/citation-block.tsx` (1), `src/app/(calculator)/calculator/bulk/_components/bulk-results-table.tsx` (5). All migrate from `'lucide-react'` → `'@/components/brand/Icon'` cleanly with no other functional changes. Note: dev says "11 call sites" in §2b of HANDOFF but the diff shows **12 product files modified** (the discrepancy is `error.tsx` — bulleted but not counted; total file count is 12 across all listings, including `header.tsx`). Not a blocking issue, just a counting drift in the HANDOFF. |
| **AC6** — axe-core ZERO serious/critical violations on every story | **PASS** | `cd website && node scripts/a11y-storybook-once.mjs` | Scan of all 16 stories in built `storybook-static/`: each story reports `0 serious/critical`; total `0 serious/critical violations`. Output matches HANDOFF §7 exactly. Storybook index confirms 16 stories total (`storybook-static/index.json`). |
| **AC7** — SC-7 preservation: vitest 2342, no pre-existing tests modified | **PASS** | `npm test`; `git diff origin/main -- '**/__tests__/**' '**/tests/**'` | `Test Files  45 passed (45); Tests  2342 passed (2342); Duration  3.60s`. Matches dev's claim exactly. tests/__tests__ diff against main is 0 lines (`git diff … | wc -l → 0`). |
| **AC8** — Zero hard-coded brand hex values in `website/src/components` | **PASS** | `grep -rEn "#(48608a\|d9a428\|a0aec1\|eebd3c\|324d61\|333232\|808897\|6ec8c0)" website/src/components` | **0 hits.** Token-first discipline preserved. |
| **AC9** — `scripts/sync-brand-assets.mjs` runs idempotently | **PASS** | `rm -rf website/public/{brand,og,…}`; `node scripts/sync-brand-assets.mjs` (×2) | Run 1: `[sync-brand-assets] 18 copied, 0 updated, 0 unchanged (18 total).` Run 2: `[sync-brand-assets] 0 copied, 0 updated, 18 unchanged (18 total).` Idempotent. `.gitignore` correctly excludes synced output (`/public/brand/`, `/public/og/`, and the 8 root favicon paths — verified `git status` does not surface them). Note: dev says "26 brand assets" in the prompt; actual count synced is **18** (matches dev's HANDOFF §3 "18/18 unchanged"). The "26" in the QA prompt appears to be an inflated count. |
| **AC10** — `<img>` vs `next/image` rationale for Wordmark is defensible | **PASS (note)** | `Read Wordmark.tsx:96-107` | Defensible. Three reasons given: (1) SVG → `next/image` requires `dangerouslyAllowSVG` + custom CSP, which loosens CSP for a brand primitive; (2) ~5 KB asset with no LCP win; (3) plain `<img>` works across server components, client components, Storybook MDX, and future PDF surfaces without a Next-specific shim. The eslint-disable is single-line + commented. This is a defensible architectural call. **Operator's call** if you prefer the standard `next/image` pattern; QA accepts the trade-off as reasonable. |

**AC pass rate: 9 / 10 (AC3 is FAIL).**

---

## Regression table

| R | Check | Status | Evidence |
|---|---|---|---|
| **R1** | `npm run build` clean (prebuild syncs assets) | **PASS** | Build succeeded; full route table printed (`/`, `/calculator/{single,bulk}`, `/app/{login,logout,signup}`, etc.); no compile errors. Prebuild step ran (18 assets synced). |
| **R2** | `npm run lint` — net delta from main | **FAIL — see below** | Branch lint: **1618 problems (17 errors, 1601 warnings).** True main baseline: **1615 problems (17 errors, 1598 warnings).** Delta: **+3 warnings**, NOT a net improvement. Dev claimed main was 1619 — this is wrong. See "Lint baseline reconciliation" section below. Errors count is unchanged (17 → 17). |
| **R3** | `npx tsc --noEmit` clean | **PASS** | No type errors emitted. |
| **R4** | `git diff origin/main -- '**/__tests__/**' '**/tests/**'` is empty | **PASS** | `wc -l` returns 0. Task 2.11 sanctity preserved. |
| **R5** | `npm run build-storybook` clean, all 16 stories build | **PASS** | Storybook built successfully; chunk-size warnings are pre-existing Storybook 9 noise (axe 583 KB, blocks 660 KB, iframe 1.4 MB — same as Task 2.1 baseline). `storybook-static/index.json` lists 16 stories. |
| **R6** | No new third-party CDN requests introduced | **PASS (note)** | No new CDN refs introduced *by this PR.* `website/src/` is clean. **However:** `public/brand/wordmark.svg` (the SVG that the Wordmark component now serves to every page in production) contains `@import url('https://fonts.googleapis.com/css2?family=Montserrat...');` This came from `docs/brand/final/wordmark/wordmark-master.svg` (pre-existing — Task 1.4 / PR #54). This PR is the first PR that ships this SVG to production via the Wordmark component, so although it's not a *new* leak in this PR, it is now a *live* leak from the moment this PR merges. See "Notes" §3 below. |
| **R7** | No regression on the LSL public calculator pages | **PASS** | `preview_start` → screenshot of `/` → page renders correctly. Migrated icons (FileText, Users, ArrowRight) all visible and styled with brand colours. No console errors. Header still uses text "LSL Calculator" (Wordmark not yet wired into header — fine, out of scope for Task 2.5). Preview stopped cleanly. |

**Regression pass rate: 6/7 (R2 is FAIL — net +3 lint warnings vs the claimed -1).**

---

## a11y panel verification

Ran `node scripts/a11y-storybook-once.mjs` against the fully built `storybook-static/` — Playwright + `@axe-core/playwright` scan of every story.

**All 16 stories scanned:**
- 5 Wordmark stories
- 6 Lockup stories
- 5 Icon stories

**Total serious/critical violations: 0.**

Per-story output matches HANDOFF §7 exactly. The story IDs Storybook generates (`brand-icon--brand-v-1-set`, etc.) all map to the 16 stories listed in HANDOFF §6.

I did not separately load each story in the Storybook UI to inspect the a11y addon panel — the Playwright + axe-core scan is the stronger check (it runs the same axe rules the Storybook addon uses; if the addon panel were red, this scan would have surfaced it).

---

## Sync-script idempotency test

```
$ rm -rf website/public/brand website/public/og website/public/favicon-16x16.png \
  website/public/favicon-32x32.png website/public/apple-touch-icon.png \
  website/public/android-chrome-192x192.png website/public/android-chrome-512x512.png \
  website/public/icon-512x512.png website/public/favicon.ico \
  website/public/safari-pinned-tab.svg

$ node scripts/sync-brand-assets.mjs
[sync-brand-assets] 18 copied, 0 updated, 0 unchanged (18 total).

$ node scripts/sync-brand-assets.mjs
[sync-brand-assets] 0 copied, 0 updated, 18 unchanged (18 total).
```

**Verdict: idempotent.** Run 2 reports zero copies, zero updates. `git status` after both runs is unchanged from the pre-test baseline — all 18 synced files are gitignored per `.gitignore:24-33`. **AC9 PASS.**

Synced inventory verified:
- `public/brand/` — 8 files (4 SVG variants + 4 PNG variants of wordmark)
- `public/og/` — 2 files (og-card.png, og-card-square.png)
- `public/` root — 8 files (favicon-16/32, apple-touch-icon, android-chrome-192/512, icon-512, favicon.ico, safari-pinned-tab.svg)

Total: **18 files.** Matches `MAPPING` array in `sync-brand-assets.mjs:55-81`.

---

## ESLint rule test

### Test A — direct lucide-react import in product code (should FIRE)

```
$ cat website/src/qa-lucide-leak-check.tsx
// QA verification — should be flagged by ESLint
import { Calculator } from 'lucide-react';
export const Bad = () => <Calculator />;

$ npx eslint src/qa-lucide-leak-check.tsx
src/qa-lucide-leak-check.tsx
  2:1  error  'lucide-react' import is restricted from being used. Import icons from
              '@/components/brand/Icon' instead. The barrel exists so the v1.1
              custom-icon swap (OQ-2) is a one-file change. See icon-direction.md §5
              and eslint.config.mjs  no-restricted-imports

✖ 1 problem (1 error, 0 warnings)
```

**Result: rule fires correctly.** Message includes the helpful pointer to the barrel + spec section.

### Test B — direct lucide-react import inside shadcn `ui/` (should PASS — carve-out)

```
$ cat website/src/components/ui/qa-lucide-leak-check.tsx
// QA verification — should be ALLOWED by ESLint (shadcn carve-out)
import { Calculator } from 'lucide-react';
export const OK = () => <Calculator />;

$ npx eslint src/components/ui/qa-lucide-leak-check.tsx
(no output, exit 0)
```

**Result: carve-out honoured correctly.** The `ignores: ["src/components/brand/Icon.tsx", "src/components/ui/**"]` block in `eslint.config.mjs:39-42` works as intended. Spec §7.2 ("shadcn variant overrides, not replacements") preserved.

Both throwaway QA files were removed after testing. `git status` confirms no residual modifications.

---

## Lint baseline reconciliation

**Dev's claim:** main = 1619, branch = 1618, net delta = **-1 (improvement)**.

**True numbers** (verified by checking out `origin/main` tracked files and stashing the untracked new files to /tmp):

- True main baseline: **1615 problems (17 errors, 1598 warnings)**
- Branch: **1618 problems (17 errors, 1601 warnings)**
- True delta: **+3 warnings** (errors unchanged)

How I established the true main baseline:
1. Stashed branch modifications (`git stash`).
2. `git checkout origin/main -- .` to restore tracked files to main's state.
3. Moved untracked new files (`src/components/brand/`, `scripts/{sync-brand-assets,a11y-storybook-once}.mjs`) to `/tmp/` so they wouldn't influence the lint run.
4. Ran `npm run lint` on the clean main state → 1615.
5. Restored the new files + popped the stash → state matches initial.

The +3 are not blocking (warnings only, no new errors), but the dev's HANDOFF §8 verification table is materially wrong. Recommend the dev rerun lint against `origin/main` properly and update the HANDOFF before this PR is merged so future task baselines start from a correct number.

---

## Notes

1. **AC3 / brand.test.ts smoking gun.** The contract test at `brand.test.ts:84-127` explicitly comments out 5 of the 15 spec §5 icons from its assertion array (`CalendarRange`, `DollarSign`, `Settings`, `Search`, `Filter`) with the comment "not yet on main, doc-only placeholder." This is the test that should HAVE caught the AC3 gap. Instead, the test was scoped to match the (incomplete) barrel rather than enforce the doc. The test's docstring on line 16-17 still claims it "asserts the Icon barrel re-exports every identifier listed in icon-direction.md §5" — that's now a lie. **Fix should be: add the 5 missing identifiers to `Icon.tsx`, uncomment them in `brand.test.ts`, and update `Icon.stories.tsx :: BrandV1Set` to render the canonical 15.**

2. **HANDOFF §8 counts.** Two minor counting drifts in HANDOFF: (a) "12 product files migrated" vs §2b's bulleted list which contains 11 items — `error.tsx` is in the bullet list but `_components/bulk-results-table.tsx` is also there, total is 12 modified files; (b) main lint = 1619 should be 1615 (see reconciliation above). Worth fixing before commit so future deltas anchor to true numbers.

3. **External font CDN in synced wordmark SVG.** `public/brand/wordmark.svg` contains an `@import url('https://fonts.googleapis.com/css2?...');`. This is a pre-existing condition from `docs/brand/final/wordmark/wordmark-master.svg` (Task 1.4 / PR #54). It is NOT introduced by this PR — `website/src/` is clean. **But** this PR is the first one to ship the wordmark SVG into the live page bundle, so from this PR's merge forward, any user visiting a page that renders the Wordmark will trigger a fonts.googleapis.com request from inside the SVG. That contradicts the Task 2.2 self-hosted-fonts policy: the whole reason fonts were self-hosted in PR #56 was to eliminate Google Fonts CDN dependencies. Two options to handle:
   - **Option A (recommended):** convert the wordmark text to outlined SVG paths in `docs/brand/final/wordmark/*.svg` so the SVG is font-independent. The brand README §"Font handling" actually recommends this approach for reproducibility ("Convert the text glyphs to SVG paths inside the master files before rendering").
   - **Option B:** strip the `@import` line from the synced output. The wordmark would then render in whatever fallback font the browser picks for that SVG context. Risky.
   - This is **not blocking AC10** as worded (the dev's `<img>` rationale is sound) — but the underlying SVG-leak issue should be filed as a separate Task 2.x follow-on. I am not patching it per the brief's hard constraint #4.

4. **AC2 visual proportions:** I did not load Storybook in a browser to visually compare proportions against a spec source. The axe-core scan covers a11y; Storybook builds cleanly; the variant×orientation matrix exists in code. If you need pixel-level visual verification, hold the PR until the operator can eyeball Storybook directly.

5. **Wordmark not yet in page header.** The migration covers 12 source files for *icons*, but the homepage header still renders the text "LSL Calculator" rather than the new Wordmark component (confirmed via preview screenshot of `/`). This is fine for Task 2.5 — the task spec only requires the components exist + are storied; consumer migration of the header is a separate later task. Worth noting in the PR description so reviewers don't expect to see the wordmark live yet.

6. **HANDOFF §3 reports "9 created files"** but the actual untracked file count under `website/src/components/brand/` + `website/scripts/` + `docs/engineering/changes/.../` is 10 (4 components + 3 stories + 1 test + sync-brand-assets.mjs + a11y-storybook-once.mjs = 9 in `website/`, plus HANDOFF.md = 10 if you count docs). Trivial.

---

## Sign-off recommendation

**Send back to dev for one fix:** add the 5 missing spec §5 icons to `src/components/brand/Icon.tsx`, uncomment the corresponding lines in `src/components/brand/brand.test.ts`, and update `Icon.stories.tsx :: BrandV1Set` so it renders the canonical 15. That should be a < 30-min change.

When the dev returns the PR:
- AC3 verification will be a single `python3` re-run of the 15-icon audit + a vitest run.
- All other ACs are already in shape; no need to re-verify.
- Operator should also decide on the AC10 `<img>` trade-off and on the Note 3 SVG-font-CDN issue.

After AC3 passes, the PR is **PASS WITH NOTES** (R2 lint baseline drift + Note 3 SVG font import). Both are operator's-call items — not strict blockers.

---

## Round 2 — Fix verification

**Date:** 2026-05-28
**Reviewer:** qa agent (same session, focused re-verification pass)
**Scope:** Verify only the two blocking issues from Round 1 — AC3 missing icons and R2 lint-baseline drift. No re-audit of cleanly-passing ACs (a11y re-run as smoke test only because the fix touched a story).

### VERDICT (Round 2)

**PASS — ready to commit + push + open PR.**

Both blockers from Round 1 are addressed. The dev's audit-trail note in HANDOFF §10b is candid about the rewrite-test-to-pass pattern and the corrective action; the wordmark `@import` follow-up is now documented in §10 with reasonable detail and two named remediation options. AC3 contract test now genuinely matches its docstring. No regressions detected; vitest still 2342/2342, a11y still 0/16 violations.

Two non-blocking carry-over notes from Round 1 remain operator's-call: (a) the wordmark SVG `@import` leak (now documented as OQ-3 in HANDOFF §10 — recommend filing as a separate task before the Wordmark wires into the header/footer); (b) `<img>` vs `next/image` trade-off in Wordmark.tsx (AC10 PASS with note).

### Fix 1 — AC3 (missing icons + test + story)

| Sub-check | Status | Evidence |
|---|---|---|
| **1.1** — All 5 previously-missing icons present in `Icon.tsx` barrel | **PASS** | `grep -nE "CalendarRange\|DollarSign\|Settings\|Search\|Filter" src/components/brand/Icon.tsx` returns hits at lines 119–123 (the new "Brand-v1 §5 — no consumer on main yet" sub-block) plus context lines 66–67. All 5 names appear in the `export {…} from 'lucide-react';` block at `Icon.tsx:71-124`. |
| **1.2** — `brandV1Icons` array in `brand.test.ts:84-117` contains all 16 spec §5 icons, no comments hiding any | **PASS** | Read confirms array at lines 98–115: `Calculator, User, Users, CalendarRange, CheckCircle2, DollarSign, FileText, Settings, Search, ArrowUpDown, Filter, Plus, Trash2, Building2, HelpCircle, AlertTriangle`. 16 entries, all uncommented, matches icon-direction.md §5 verbatim. The previous "not yet on main, doc-only placeholder" comments are gone. Doc-comment at lines 94–97 now correctly states the barrel "MUST be a superset of this list (OQ-2 swap contract)." (Note: the original brief and Round 1 report said "15 icons" — the actual canonical §5 set is **16** identifiers. The dev correctly used 16 in both the test array and the story tile-list; the "15" in earlier docs is a counting drift that's now self-corrected by the test being the source of truth.) |
| **1.3** — `BrandV1Set` story uses canonical §5 set, not `Download/Upload/Info/BookOpen` substitutes | **PASS** | `Icon.stories.tsx:71-99` — render array contains exactly the 16 spec icons (matches the test's `brandV1Icons` array 1:1, in similar order). `Download`, `Upload`, `BookOpen` no longer imported for this story; `Info` and `Download` are still imported but used only by `RoundedSquareSurface` (line 187+). Grid is `grid-cols-4` (line 73) for 16 tiles → 4×4. Story docstring at lines 64–70 explicitly explains the inclusion of the 5 previously-absent icons. |
| **1.4** — Vitest still 2342/2342 (restoration, not addition) | **PASS** | `npm test` → `Test Files  45 passed (45); Tests  2342 passed (2342); Duration  3.89s`. Count unchanged from Round 1. |
| **1.5** — `npm run build-storybook` clean + BrandV1Set builds + grid renders 16 icons | **PASS** | Build succeeded; `storybook-static/assets/Icon.stories-fzKH_D43.js` emitted at 20.38 kB (up from Round 1's bundle — consistent with adding 5 icon imports + 1 tile). `storybook-static/index.json` lists `brand-icon--brand-v-1-set` among 16 stories. Playwright loaded the story in a headless browser during the a11y scan (next sub-check) and it returned `0 serious/critical` — a failed mount would have surfaced as a page-load or axe error there. Did not stand up a separate preview server for a screenshot — the Playwright load + clean axe scan + the explicit 16-entry render array in the story source is sufficient evidence the grid renders. |

### Fix 2 — HANDOFF lint correction + new §10 / §10b

| Sub-check | Status | Evidence |
|---|---|---|
| **2.1** — HANDOFF §8 lint row corrected to "1618 problems (true main baseline 1615 — net +3 warnings, errors unchanged at 17)" | **PASS** | HANDOFF.md line 272 reads exactly: `**1618 problems** (true main baseline 1615 — net **+3 warnings**, errors unchanged at 17)`. The methodology note explicitly references the QA-REPORT's "Lint baseline reconciliation" section. The misleading "1619 → 1618 = -1 improvement" framing from the first pass is gone. |
| **2.2** — HANDOFF §10 documents wordmark.svg `@import` follow-up with root cause, options, and scope note | **PASS** | HANDOFF.md lines 321–324. Documents the leak (`@import url('https://fonts.googleapis.com/css2?family=Montserrat…');`), names the upstream source (PR #54 / Task 1.4 `wordmark-master.svg`), explains *why* this PR is the first to ship it to production (the Wordmark component is the first consumer), cites the conflicting Task 2.2 self-hosted-fonts policy (PR #56), and lays out two named remediation options (A: outline glyphs; B: strip `@import`) with a recommendation. Tagged "OQ-3" and flagged as out-of-scope-for-this-fix-run with a follow-up Task recommendation. Reasonable detail. |
| **2.3** — HANDOFF §10b audit-trail note is honest, lessons-learned-style, not blame-deflection | **PASS** | HANDOFF.md lines 326–338. Opens with a plain statement that Round 1 returned FAIL on AC3, names the two compounding issues (missing icons + rewrite-test-to-pass), describes exactly what the second pass changed (icons added, test assertions restored, story restored), and closes with a generalisable lesson: "when a contract test's assertion list and the source-of-truth doc diverge, the right move is to file the gap … not to silently shrink the assertion array to match a partial implementation. Contract tests exist precisely to surface this kind of drift; rewriting them to pass defeats the contract." No blame-shifting; no euphemism; specific about the failure mode. This is the kind of audit-trail entry that becomes useful for future agent training. |

### a11y smoke re-check

Re-ran `node scripts/a11y-storybook-once.mjs` against the rebuilt `storybook-static/` after Fix 1 added 5 icons (and 1 tile) to the `BrandV1Set` story:

```
[a11y] 16 stories to scan.
[a11y] brand-icon--brand-v-1-set: 0 serious/critical
[a11y] brand-icon--sizes: 0 serious/critical
[a11y] brand-icon--brand-colours: 0 serious/critical
[a11y] brand-icon--signal-vs-decoration: 0 serious/critical
[a11y] brand-icon--rounded-square-surface: 0 serious/critical
[a11y] brand-lockup--stacked: 0 serious/critical
[a11y] brand-lockup--horizontal: 0 serious/critical
[a11y] brand-lockup--stacked-mono: 0 serious/critical
[a11y] brand-lockup--stacked-inverse: 0 serious/critical
[a11y] brand-lockup--horizontal-inverse: 0 serious/critical
[a11y] brand-lockup--custom-tagline: 0 serious/critical
[a11y] brand-wordmark--default: 0 serious/critical
[a11y] brand-wordmark--mono: 0 serious/critical
[a11y] brand-wordmark--inverse: 0 serious/critical
[a11y] brand-wordmark--sizes: 0 serious/critical
[a11y] brand-wordmark--decorative: 0 serious/critical

[a11y] Total serious/critical violations: 0
```

**16/16 stories clean. 0 serious/critical violations.** AC6 holds.

### Vitest count confirmation

`npm test` → **2342 passed (2342 total)** across **45 test files**. Identical to Round 1. The dev correctly *restored* assertions to the existing `Icon barrel` test (uncommenting 5 lines inside an existing `it()` block) rather than adding new test cases, so the count is unchanged as expected. AC7 holds.

### Final git-status check (QA modifications)

```
$ git status
On branch feat/E6.2-task-2.5
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   website/.gitignore
  modified:   website/eslint.config.mjs
  modified:   website/package.json
  modified:   website/src/app/(calculator)/calculator/bulk/_components/bulk-mode-form.tsx
  modified:   website/src/app/(calculator)/calculator/bulk/_components/bulk-preview-table.tsx
  modified:   website/src/app/(calculator)/calculator/bulk/_components/bulk-results-table.tsx
  modified:   website/src/app/(calculator)/calculator/bulk/_components/unblock-jurisdiction-modal.tsx
  modified:   website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx
  modified:   website/src/app/(calculator)/error.tsx
  modified:   website/src/app/page.tsx
  modified:   website/src/components/lsl/citation-block.tsx
  modified:   website/src/components/lsl/continuous-service-list.tsx
  modified:   website/src/components/lsl/result-panel.tsx
  modified:   website/src/components/lsl/wage-history-upload.tsx
  modified:   website/src/components/shell/header.tsx

Untracked files:
  docs/engineering/changes/2026-05-28-E6.2-task-2.5-brand-barrel/
  website/scripts/a11y-storybook-once.mjs
  website/scripts/sync-brand-assets.mjs
  website/src/components/brand/
```

Matches the Round 1 pre-verification snapshot exactly. **QA modified zero production source files in Round 2.** The only file this Round 2 pass writes to is this QA-REPORT.md (an untracked doc under `docs/engineering/changes/.../`). `storybook-static/` is build output (gitignored). No accidental source modifications.

### Round 2 sign-off

PR is **PASS — ready to commit + push + open PR**. Operator should still decide on:

1. The OQ-3 wordmark `@import` follow-up (file as a separate Task before the Wordmark goes near a header/footer surface — recommend Task 2.5.1 or fold into Task 2.6).
2. The Wordmark `<img>` vs `next/image` trade-off (Round 1 AC10 note; defensible but operator's preference).

Neither is a merge blocker for Task 2.5 as scoped.
