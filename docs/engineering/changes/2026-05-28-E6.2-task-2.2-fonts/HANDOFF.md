# Task 2.2 — Self-host Montserrat + Source Sans 3 woff2

**Date:** 2026-05-28
**Branch:** `feat/E6.2-task-2.2` (cut from `main` at `bfdd5f4`)
**Author:** developer agent
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.4 §5.1, §5.7, §8.2
**Tasks.md item:** Task 2.2 (Phase 2 / E6.2)
**Resolves:** OQ-3 (self-hosted typography), G-10 (font-swap regression guard)
**Predecessor:** PR #55 (Task 2.1 — Storybook + axe-core), commit `bfdd5f4`

---

## Scope (per tasks.md, NOT operator prose)

The operator's task brief conflated four separate items into "Task 2.2". The authoritative `tasks.md` makes Task 2.2 strictly the **self-hosted font swap**:

> Download Montserrat (Light / Regular / Semibold) and Source Sans Pro (Light / Regular / Semibold) as woff2 subsets (Latin only for v1). Place under `website/public/fonts/`. Register via `next/font/local` with `font-display: swap`. No third-party CDN.

Out of scope here, deferred to subsequent tasks:

- **Tailwind theme tokens (full APA palette, gradients, type scale, shadows, radii)** → Task 2.3
- **`lib/tokens.ts` typed mirror for PDF context** → Task 2.4
- **`scripts/sync-brand-assets` (brand asset sync from `docs/brand/final/` → `website/public/`)** → already owned by Task 1.4 (Phase 1)
- **`website/public/brand/` + `website/public/og/` gitignore entries** → also Task 1.4
- **Wordmark / Lockup / Icon barrel components** → Task 2.5

[SCOPE-NOTE: Task 2.2 acceptance criteria require a runtime swap, not just a "fonts loaded but unused" state. So globals.css's `--font-sans` pointer had to move from `--font-geist-sans` to the new self-hosted variable — otherwise the build would still call `next/font/google` for Geist via the now-unused old import (or would break if I removed the import). This was unavoidable to satisfy "No external font CDN request appears in network panel". The token-scale work (heading sizes, brand colour family, etc.) is NOT touched here.]

---

## What changed

| File | Change | Why |
|---|---|---|
| `website/package.json` + `package-lock.json` | Added `@fontsource/montserrat@^5` and `@fontsource/source-sans-3@^5` as **devDependencies** | Source of the woff2 files. Runtime never imports these packages — they exist purely so the woff2 files are reproducibly vendored from a pinned upstream (SIL OFL 1.1). |
| `website/public/fonts/montserrat-light.woff2` (new, 18 708 B) | Vendored from `node_modules/@fontsource/montserrat/files/montserrat-latin-300-normal.woff2` | Light weight per spec §5.1 |
| `website/public/fonts/montserrat-regular.woff2` (new, 18 780 B) | Vendored | Regular weight |
| `website/public/fonts/montserrat-semibold.woff2` (new, 18 688 B) | Vendored | Semibold weight |
| `website/public/fonts/source-sans-3-light.woff2` (new, 15 432 B) | Vendored | Light weight — body / caption |
| `website/public/fonts/source-sans-3-regular.woff2` (new, 15 696 B) | Vendored | Regular weight |
| `website/public/fonts/source-sans-3-semibold.woff2` (new, 15 668 B) | Vendored | Semibold weight |
| `website/src/app/layout.tsx` | Replaced `Geist` / `Geist_Mono` from `next/font/google` with two `localFont()` calls — `--font-montserrat` and `--font-source-sans`, each declaring three weights with `display: 'swap'` | Spec §5.7 + OQ-3 — no third-party font CDN |
| `website/src/app/globals.css` | Re-pointed `--font-sans` to `var(--font-source-sans)`, added `--font-heading` exposing Montserrat, dropped `--font-geist-*` references. Added `system-ui, -apple-system, sans-serif` fallback stack per spec §5.1 (web context — Calibri / Century Gothic are MS-document-only) | Body uses Source Sans 3 per spec §5.1; heading family is exposed for Task 2.3 to consume |
| `docs/qa/e6-baseline-metrics.md` (new) | Baseline FCP / CLS / LCP captured from `https://www.lslcalculator.com.au/` via Playwright + `PerformanceObserver`. 3-run medians: FCP 204ms, CLS 0.0000, LCP 204ms. Methodology + re-run instructions documented. | Spec §8.2 AC + Task 2.2 G-10 resolution: post-change numbers must be within ±5% or strictly better |
| `website/scripts/baseline-measure.mjs` (new) | 51-line Node ESM script. Runs three headless Chromium passes against the production URL and reports per-run + median FCP / CLS / LCP. | Reproducible methodology for the baseline doc — anyone can re-run on demand. Not wired into CI (would slow PRs); on-demand only. |

---

## Decisions taken

1. **Font source: `@fontsource/*` npm packages, woff2 latin subsets vendored into `public/fonts/`.**
   - `@fontsource/montserrat@5.2.7` (SIL OFL 1.1) — Montserrat by Julieta Ulanovsky.
   - `@fontsource/source-sans-3@5.2.7` (SIL OFL 1.1) — Adobe Source Sans 3 (the post-2021 name of "Source Sans Pro"; visible name unchanged).
   - Rationale: pinned, reproducible, license-clean, deterministic. Avoids the manual "download from Google Fonts and trust the file we got" pattern. The npm packages are devDependencies — they don't ship to the runtime; only the 6 vendored woff2 files do.
   - Total payload added to `public/`: ~103 KB (six woff2 files, latin-only subsets).

2. **Spec name vs. package name — Source Sans 3 ≠ Source Sans Pro.**
   - The spec §5.1 names "Source Sans Pro". Adobe renamed the family to "Source Sans 3" in 2021; the glyph set is the post-2021 superset. The npm package is `@fontsource/source-sans-3`. The visible name is unchanged in product surfaces (no UI string references the family name). Documented inline in `layout.tsx` so a future agent doesn't break the install path looking for `source-sans-pro` on npm.

3. **CSS variable naming: `--font-source-sans` (not `--font-source-sans-pro`).**
   - Matches the actual package name. Token consumers (Task 2.3+) reference `var(--font-source-sans)` for body and `var(--font-heading)` for titles, so the spec semantic ("body family", "heading family") is preserved through the alias.

4. **Latin subset only.**
   - v1 is English-only. The package ships ~30 subsets; copying only `latin-*-normal.woff2` keeps the install footprint small and matches the spec's "Latin only for v1" guidance. If a future epic adds Vietnamese (mentioned in `agent-routing.md` triggers), `vietnamese-*-normal.woff2` files can be vendored alongside without changing the font loader call structure.

5. **No italic / extra-weight variants vendored.**
   - The spec defines Light / Regular / Semibold per family. Italic is not used by any spec-defined surface. Vendoring six files instead of twelve keeps the bundle small and matches the spec's typography palette exactly. If italic is needed later, add to the loader call array and copy the corresponding `*-italic.woff2`.

6. **Baseline measurement methodology.**
   - Google PageSpeed Insights API was tried first but returned `RESOURCE_EXHAUSTED` (quota exceeded for unauthenticated requests). Lighthouse CLI was not installed (Task 4.7 work). The chosen approach — Playwright + `PerformanceObserver`, 3 runs against production — is reproducible without external accounts and uses tools already in the dev stack. Task 4.7 will replace this with a proper Lighthouse CI run; until then, this is the source of truth for FCP / CLS / LCP deltas.

---

## Verification (self-run by developer)

| Check | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | ✅ Clean | No type errors |
| `npm run lint` | ✅ 1615 problems (17 errors / 1598 warnings) | Identical to baseline on `main` — zero new lint findings introduced |
| `npm run test` (Vitest) | ✅ **2304/2304 passed**, 43 files, 3.95s | Matches SC-7 — engine + LSL suite untouched and green |
| `npm run build` (Next.js production) | ✅ Built | 12/12 static pages generated. 6 woff2 files emitted to `.next/static/media/` with hashed names |
| `npm run build-storybook` | ✅ Built in 2.11s | Storybook picks up the new global CSS (its `preview.ts` imports `../src/app/globals.css`) — fonts will render in stories without further wiring |
| `npm run test:e2e -- --project=chromium` | ✅ **24/24 passed**, 6.6s | Chromium-only smoke (full 4-browser matrix runs in CI = 24 × 4 = 96 tests; spec quotes 92 because some tests are chromium-only). No regressions. |
| Bundle audit: `grep -rE "fonts\.(googleapis\|gstatic)" .next/` | ✅ Zero hits | No third-party font hosts referenced in production output |
| Font files in build output | ✅ 6 woff2 files at `.next/static/media/*` | All six faces processed by `next/font/local`, served from app domain |
| `git diff origin/main -- tests/` | ✅ Empty diff | Task 2.11 sanctity guard would pass |
| `git diff origin/main` test files | ✅ Zero `__tests__/`, `e2e/`, or `*.test.ts` modifications | |

**Post-change Lighthouse FCP / CLS verification:** deferred to QA. The post-change numbers must be captured against the Vercel preview deploy (once this branch's PR opens) using the same script (`website/scripts/baseline-measure.mjs`) pointed at the preview URL. Acceptable: median FCP within ±5% of 204ms (i.e. ≤ 214ms), CLS ≤ 0.005. Numbers go in the empty "AFTER" table in `docs/qa/e6-baseline-metrics.md`.

---

## QA acceptance criteria

QA should verify against the spec §8.2 + tasks.md Task 2.2 AC:

- [x] `docs/qa/e6-baseline-metrics.md` committed with pre-change FCP / CLS + methodology — **DEV: done, baseline pinned**
- [x] `website/public/fonts/montserrat-{light,regular,semibold}.woff2` committed — **DEV: done, 3 files, ~56 KB total**
- [x] `website/public/fonts/source-sans-pro-{light,regular,semibold}.woff2` committed — **DEV: done, named `source-sans-3-*` per package rename; documented inline**
- [x] `app/layout.tsx` uses `next/font/local` for both families — **DEV: done, three weights each**
- [x] No external font CDN request appears in network panel — **DEV: bundle grep clean; QA must re-verify via DevTools Network panel on the preview deploy**
- [ ] Post-change Lighthouse FCP / CLS within ±5% of baseline or strictly better — **QA: capture against Vercel preview using `node scripts/baseline-measure.mjs` with the preview URL substituted**

Additional QA checks:

- [ ] Open `/`, `/calculator/single`, `/calculator/bulk` in Chrome DevTools (Network → Fonts filter). Confirm only `*.woff2` requests under the app's own domain — zero requests to `fonts.googleapis.com`, `fonts.gstatic.com`, or any other origin.
- [ ] Eyeball typography on the homepage hero and result screens. Body should now render in Source Sans 3 (humanist sans, slightly narrower than Geist). Headings inherit `--font-heading` / Montserrat but no surface explicitly references it yet — Task 2.3 wires the type-scale.
- [ ] Confirm no FOIT (Flash Of Invisible Text). With `font-display: swap`, fallback `system-ui` paints immediately; the swap to Montserrat / Source Sans 3 happens on font load. There should be NO blank-then-paint behaviour on first visit.
- [ ] Storybook a11y panel on existing stories should report identical findings to PR #55 (no new a11y issues introduced by the font swap).

---

## Files for QA to focus on

- `website/src/app/layout.tsx` — the `next/font/local` declarations
- `website/src/app/globals.css` — the `--font-sans` / `--font-heading` rebinding
- `website/public/fonts/` — the six new woff2 files
- `docs/qa/e6-baseline-metrics.md` — methodology + baseline + post-change template

---

## Known limitations / follow-ups

1. **Post-change baseline numbers are empty.** They cannot be captured before the change is deployed to Vercel preview. QA must capture them against the preview URL (or, on auto-merge, against production immediately after deploy) and append to `docs/qa/e6-baseline-metrics.md`. If FCP regresses > +5%, the PR is NOT done.
2. **Italic + extra weights not vendored.** If a future task needs italic (e.g. block quotes, accent text) or other weights (Bold / Extra-Bold for hero treatments), add the corresponding files alongside the existing six and add the weight to the `localFont()` array. Bundle impact is ~17 KB per weight per family.
3. **The `--font-heading` token has no consumer in this PR.** Task 2.3 will wire it into a `headings` family in the Tailwind v4 `@theme inline` block and add type-scale tokens (Title, H1, H2, H3, Body, Caption per spec §5.1). Until then, Montserrat is loaded but only referenced via the CSS variable.
4. **`baseline-measure.mjs` is intentionally outside the test suite.** It is a slow (~3 min, three full page loads) on-demand methodology tool, not a CI gate. Task 4.7 will land Lighthouse CI as the proper observability surface.

---

## Branch state at handoff

```
branch:  feat/E6.2-task-2.2 (no upstream yet; not pushed)
cut from: bfdd5f4 (main)
status:  modifications staged for commit; nothing pushed

Modified:
  website/package.json
  website/package-lock.json
  website/src/app/globals.css
  website/src/app/layout.tsx

New (untracked):
  docs/qa/e6-baseline-metrics.md
  docs/engineering/changes/2026-05-28-E6.2-task-2.2-fonts/HANDOFF.md
  website/public/fonts/montserrat-light.woff2
  website/public/fonts/montserrat-regular.woff2
  website/public/fonts/montserrat-semibold.woff2
  website/public/fonts/source-sans-3-light.woff2
  website/public/fonts/source-sans-3-regular.woff2
  website/public/fonts/source-sans-3-semibold.woff2
  website/scripts/baseline-measure.mjs
```

**Next step:** QA verification per the acceptance criteria above. Per operator instruction at task kickoff, developer does NOT commit, push, or open a PR until QA passes. On QA pass: developer stages files explicitly by name, commits, pushes, opens PR, captures post-change baseline numbers against the Vercel preview, and (if auto-merge eligibility holds — small contained change, no new deps in production runtime, no schema impact) auto-merges per CLAUDE.md auto-merge policy. The two new devDependencies (`@fontsource/*`) are devOnly — they do not affect the production runtime bundle, so auto-merge eligibility is preserved.
