# QA Report — E6.2 Task 2.2 (Self-hosted Montserrat + Source Sans 3)

**VERDICT: PASS WITH NOTES — operator's call**

(Substantively `PASS` — all 6 ACs and all 6 regression checks land green for the
work in scope. The only "with notes" is AC6: the spec-defined apples-to-apples
post-change FCP/CLS measurement is against the production URL and must be re-run
once the branch is pushed to Vercel preview. That cannot be done from this
worktree before the dev pushes. A local-loopback measurement was taken as a
sanity check and is healthy. See AC6 + Notes below.)

**QA agent:** qa
**Reviewed:** 2026-05-28
**Branch:** `feat/E6.2-task-2.2` (cut from `bfdd5f4` / `main`; nothing pushed)
**Handoff reviewed:** `docs/engineering/changes/2026-05-28-E6.2-task-2.2-fonts/HANDOFF.md`
**Spec authority:** `.specify/features/006-ui-design-system/spec.md` v0.4 §5.1, §5.7, §8.2 + tasks.md Task 2.2

---

## Acceptance criteria

| # | AC | Status | Command(s) | Evidence |
|---|----|--------|------------|----------|
| AC1 | Fonts are self-hosted; no Google Fonts | **PASS** | `ls website/public/fonts/`<br>`grep -rEc "fonts\.(googleapis\|gstatic)" website/src website/public`<br>`npm run build`<br>`grep -rEc "fonts\.(googleapis\|gstatic)" website/.next/static website/.next/server` | 6 woff2 files present (`montserrat-{light,regular,semibold}` + `source-sans-3-{light,regular,semibold}`, total ~103 KB). All `grep -c` counts == 0 across `src/`, `public/`, `.next/static/`, `.next/server/`. Build completes 12/12 static pages with no network fetch. `curl http://localhost:3000/` shows 6 `<link rel="preload" .../_next/static/media/*.woff2>` lines and zero references to `fonts.googleapis.com` or `fonts.gstatic.com`. |
| AC2 | Correct font families wired (Montserrat headings, Source Sans 3 body, weights 300/400/600 each) | **PASS** | Read `website/src/app/layout.tsx`<br>Read `website/src/app/globals.css` | `layout.tsx` declares two `localFont()` blocks. Montserrat → `--font-montserrat` with 3 weights (300/400/600) pointing at the 3 montserrat woff2s. Source Sans 3 → `--font-source-sans` with 3 weights (300/400/600) pointing at the 3 source-sans-3 woff2s. `globals.css` `@theme inline` re-points `--font-sans` → `var(--font-source-sans), system-ui, -apple-system, sans-serif` and adds `--font-heading` → `var(--font-montserrat), system-ui, -apple-system, sans-serif`. `<html>` element applies both `.variable` classes. Spec §5.1 satisfied (modulo the spec/package name drift — see Notes). |
| AC3 | `font-display: swap` on every face | **PASS** | `grep -n "display" website/src/app/layout.tsx` | Both `localFont()` calls include `display: 'swap'` (lines 28, 50). All 6 faces inherit it. |
| AC4 | `@fontsource/*` packages in **devDependencies**, not `dependencies` | **PASS** | `grep -n -E "@fontsource/" website/package.json` | Both `@fontsource/montserrat@^5.2.8` and `@fontsource/source-sans-3@^5.2.9` appear inside the `devDependencies` block (lines 44–45). The `dependencies` block contains no `@fontsource/*` entries. Runtime bundle is unaffected. |
| AC5 | SC-7 preservation — Vitest, Playwright chromium, tsc, lint, build all green | **PASS** | `npx tsc --noEmit` → exit 0<br>`npm run test` → 2304/2304<br>`npm run lint` → 1615 problems (17 errors / 1598 warnings)<br>`npm run test:e2e -- --project=chromium` → 24/24<br>`npm run build` → 12/12<br>`npm run build-storybook` → built 2.05s | All counts match the dev's claims exactly. Lint count of 1615 is the unchanged baseline — zero new findings introduced. Storybook builds clean. |
| AC6 | Post-change FCP / CLS within ±5% of baseline or strictly better | **PASS (local) + DEFERRED-TO-PREVIEW (production)** | Local: `npm run build && npm run start`, then 3-run Playwright measurement against `http://localhost:3000/` (script identical methodology to `website/scripts/baseline-measure.mjs`).<br>Production: not yet possible — branch unpushed | Local-loopback medians: **FCP 44 ms, CLS 0.0000, LCP 44 ms** (runs: FCP `[36, 48, 44]`, CLS `[0,0,0]`, LCP `[36, 48, 44]`). CLS is the critical font-swap risk metric, and it is 0.0000 across all three runs — confirming `next/font/local`'s size-adjust fallback metrics are suppressing layout shift. FCP/LCP being far lower than the 204ms production baseline is expected (loopback has no network latency); the local figures are not directly comparable to the production baseline. The proper apples-to-apples production comparison must be captured against the Vercel preview URL after the dev pushes this branch; AC6 deferred to that step per HANDOFF.md §"Verification" and §"Known limitations" item 1. |

**AC pass rate: 6 / 6** (AC6 is PASS with the production check deferred per the spec's own methodology).

---

## Regression checks

| # | Check | Status | Command(s) | Evidence |
|---|-------|--------|------------|----------|
| R1 | Storybook still boots + Tailwind globals load with the new font variables | **PASS** | `npm run build-storybook` → exit 0<br>(`.storybook/preview.ts` imports `../src/app/globals.css`) | Storybook builds in 2.05 s. `globals.css` is imported by `preview.ts`, so `:root`-scoped `--font-sans` and `--font-heading` tokens are available to every story. No story currently consumes them — that's Task 2.3's surface — but the tokens are present. |
| R2 | `.gitignore` does NOT exclude `website/public/fonts/` | **PASS** | `git check-ignore -v website/public/fonts/montserrat-regular.woff2` | Exit code 1, prints `NOT_IGNORED`. The 6 woff2 files are tracked as source artefacts (correct). |
| R3 | No `<link rel="preconnect">` or `dns-prefetch` for Google fonts hosts in rendered HTML | **PASS** | `curl -s http://localhost:3000/ \| grep -oE '<link[^>]*(preconnect\|dns-prefetch)[^>]*>'` | Zero matches. The only `<link>` elements with font hints are the 6 `rel="preload"` entries pointing at `/_next/static/media/*.woff2` (self-hosted). |
| R4 | `website/scripts/baseline-measure.mjs` is sane (no secrets, no obviously broken patterns) | **PASS** | Read full file (71 lines) | Pure Node ESM script. Imports only `playwright` (already a devDep). Target URL is the public production hostname `https://www.lslcalculator.com.au` — no credentials, tokens, or env-var reads. PerformanceObserver pattern is the textbook Web Vitals capture. `waitUntil: 'networkidle'` + 2.5 s settle is a reasonable cold-paint methodology. Median calculation is correct. No regressions to flag. |
| R5 | `.next/static/media/` output contains the 6 woff2 files | **PASS** | `ls website/.next/static/media/ \| grep '\.woff2$'` | All 6 files present with Next's hashed names:<br>`montserrat_{light,regular,semibold}-s.p.*.woff2`<br>`source_sans_3_{light,regular,semibold}-s.p.*.woff2`<br>(Exact filenames listed in the build-output check above.) |
| R6 | Task 2.11 test-folder sanctity guard — zero changes to `**/__tests__/**`, `**/tests/**`, `*.test.ts`, `*.spec.ts`, `e2e/**` vs `origin/main` | **PASS** | `git diff --name-only origin/main -- 'website/__tests__/**' 'website/tests/**' 'website/**/*.test.ts' 'website/**/*.spec.ts' 'website/e2e/**'` | Empty output. The font swap touches only `layout.tsx`, `globals.css`, `package.json`, and `package-lock.json` (the four modified files). No test files added, removed, modified, renamed, or skipped. The 2304-pass Vitest and 24-pass Playwright runs confirm runtime behaviour is unchanged. |

**Regression pass rate: 6 / 6.**

---

## Lighthouse / FCP delta — full result

### Local-loopback measurement (sanity check, not the spec-defined comparison)

```
URL: http://localhost:3000/   (production build via `npm run start`)
Tool: Playwright + PerformanceObserver (same script as baseline-measure.mjs, URL substituted)
Runs: 3

Run 1: FCP 36 ms, CLS 0.0000, LCP 36 ms
Run 2: FCP 48 ms, CLS 0.0000, LCP 48 ms
Run 3: FCP 44 ms, CLS 0.0000, LCP 44 ms

MEDIANS — FCP 44 ms, CLS 0.0000, LCP 44 ms
```

**Interpretation:** loopback has no network latency, so absolute ms is not
comparable to the production baseline (204 ms). What this measurement does
confirm:

- **CLS is 0.0000 across all three runs** — the critical font-swap risk metric.
  Next.js's auto-generated `size-adjust` fallback metric is correctly
  suppressing layout shift during the font swap.
- The 6 woff2 files are preloaded and served from the app's own domain (HTML
  inspection — see R3 evidence and the `<link rel="preload">` block).
- No FOIT (Flash Of Invisible Text) — `font-display: swap` is honoured on all
  6 faces (AC3).

### Spec-defined comparison (against production / Vercel preview)

**DEFERRED-TO-PREVIEW.** Per the dev's HANDOFF.md and the baseline doc itself
(`docs/qa/e6-baseline-metrics.md` §"Post-change"), the apples-to-apples FCP/CLS
delta must be captured against `https://www.lslcalculator.com.au/` or the
branch's Vercel preview URL using `node scripts/baseline-measure.mjs` (with the
URL substituted to the preview if measuring pre-merge).

**Operator / dev action on push:**

1. Push `feat/E6.2-task-2.2` to origin and open the PR.
2. Wait for Vercel preview deploy.
3. Edit `URL` in `website/scripts/baseline-measure.mjs` to the preview URL
   (temporarily) and run `node scripts/baseline-measure.mjs`.
4. Append the run numbers + medians + Δ vs baseline + verdict to the "AFTER"
   table in `docs/qa/e6-baseline-metrics.md` (commit alongside the PR).
5. Verdict rule (per the baseline doc): PASS if median FCP ≤ 214 ms (≤ +5%) and
   CLS ≤ 0.0050; otherwise FAIL — investigate before merging.
6. Revert the URL change in `baseline-measure.mjs` before the final commit, so
   it remains pointing at the production hostname for the next baseline run.

---

## Notes (non-blocking)

1. **Spec/package name drift — "Source Sans Pro" → "Source Sans 3".** Spec §5.1
   names "Source Sans Pro"; Adobe renamed the family to "Source Sans 3" in 2021.
   The dev's choice (CSS variable `--font-source-sans`, file prefix
   `source-sans-3-*`, devDep `@fontsource/source-sans-3`) is correct and
   documented inline in `layout.tsx` comments. No surface-level UI string
   references the family name, so end-user visible behaviour is unchanged. The
   spec itself should be updated at the next revision to use the modern family
   name; outside the scope of this PR.

2. **2 new devDependencies (`@fontsource/montserrat`, `@fontsource/source-sans-3`).**
   These are SIL OFL 1.1 packages, pinned to `^5.x`. They exist only as the
   reproducible source of the vendored woff2 files; the runtime never imports
   them. Production bundle is unaffected. Standard `npm audit` should be re-run
   on the branch (out of scope for this QA pass — typically a CI check). If any
   transitive vulns surface, they affect dev-time tooling only.

3. **`--font-heading` token has no consumer in this PR.** Task 2.3 will wire it
   into the Tailwind v4 `@theme inline` block alongside the type-scale tokens.
   Until then, Montserrat is loaded (all 3 weights, ~56 KB) but only referenced
   via the CSS variable. This is intended per the dev's scope note — Task 2.2
   ships the loader; Task 2.3 ships the consumers.

4. **`baseline-measure.mjs` is intentionally outside the test suite.** It is a
   ~3-minute on-demand methodology tool, not a CI gate. Task 4.7 will replace it
   with Lighthouse CI. The script is sound and committed alongside the baseline
   doc so the methodology is auditable.

5. **Dev `.next/dev/` directory contains stale Geist references.** Cosmetic
   only — `.next/dev/` is the dev-server cache from before the font swap. It is
   gitignored, never deployed, and the production output (`.next/static/`,
   `.next/server/`) is clean. A `rm -rf .next/dev` on the dev's machine before
   the next `npm run dev` would clear the noise — not a blocker.

6. **Tracked vs untracked files at QA end.** Mirrors the worktree state at QA
   start exactly (see "git status snapshot" below). No accidental modifications
   from this QA pass.

---

## Sign-off recommendation

**Recommendation to operator: PASS — proceed to commit + push + open PR.**

All 6 ACs pass for the work in scope. All 6 regression checks pass. The
deferred-to-preview AC6 step is a spec-defined methodology requirement, not a
code-quality defect: the baseline doc itself documents that the post-change
numbers are captured against the preview/prod URL, not against the developer's
local worktree. The local-loopback sanity check confirms CLS stays at 0.0000
across the font swap (the highest-risk metric for this kind of change), so the
production measurement is expected to land within the ±5% budget on the
preview.

**Standard merge gate:** the dev's auto-merge policy (per CLAUDE.md) holds —
this is a small, contained change with no new production-runtime dependencies
and no schema impact. The operator may auto-merge after:

- Pushing the branch and confirming the preview deploys cleanly;
- Running `baseline-measure.mjs` against the preview URL;
- Confirming the AFTER medians satisfy `FCP ≤ 214 ms` AND `CLS ≤ 0.005`;
- Filling in the AFTER table in `docs/qa/e6-baseline-metrics.md` and committing
  alongside the PR.

If the preview FCP regresses > +5%, return to dev — investigate `font-display`
behaviour, preload ordering, and woff2 subset sizing before merge.

---

## QA-pass git status snapshot

```
On branch feat/E6.2-task-2.2
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
	modified:   website/package-lock.json
	modified:   website/package.json
	modified:   website/src/app/globals.css
	modified:   website/src/app/layout.tsx

Untracked files:
	docs/engineering/changes/2026-05-28-E6.2-task-2.2-fonts/
	docs/qa/e6-baseline-metrics.md
	website/public/fonts/
	website/scripts/baseline-measure.mjs

no changes added to commit
```

Identical to the worktree at QA start. The QA-REPORT.md being added here is
expected (it lands inside the already-untracked
`docs/engineering/changes/2026-05-28-E6.2-task-2.2-fonts/` directory, where the
HANDOFF.md already lives — so the untracked-folder line covers both).
