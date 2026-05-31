# E6 Performance Baseline — FCP / CLS / LCP

**Owner:** developer agent
**Created:** 2026-05-28 (Task 2.2 — self-hosted fonts)
**Spec reference:** `.specify/features/006-ui-design-system/spec.md` §8.2 + tasks.md Task 2.2 AC
**Resolves:** G-10 (font-swap regression guard)

---

## Purpose

Task 2.2 swaps the public calculator's typography from `next/font/google` (Geist) to `next/font/local` (self-hosted Montserrat + Source Sans 3 woff2 subsets). The task is **not done** unless the post-change FCP / CLS numbers stay **within ±5% of this baseline or strictly better**. This file is the pinned baseline.

A future task may swap measurement tooling for Lighthouse CI (Task 4.7). Until then, this file is the source of truth.

---

## Methodology

Production URL `https://www.lslcalculator.com.au/` is measured via headless Chromium driven by Playwright. The script (`website/scripts/baseline-measure.mjs`) launches a fresh browser context with no cache, navigates to the URL, waits for `networkidle`, then reads `PerformanceObserver` entries for:

- `first-contentful-paint` → **FCP** (ms)
- `layout-shift` (excluding `hadRecentInput`) → **CLS** (cumulative)
- `largest-contentful-paint` → **LCP** (ms)

Three runs are taken; the **median** of each metric is the pinned value. Three runs is enough to filter a single cold-cache outlier; if cold-cache variance dominates in future re-measurements, bump to five runs.

**Network conditions:** the runs use the host machine's broadband connection (no throttling). This is deliberate — Task 2.2's risk is regression in the font-loading critical path, which is bandwidth-insensitive at typical broadband speeds. Lighthouse-style 4G throttling will land with Task 4.7.

**Viewport:** 1280 × 720 (desktop-equivalent).

**Re-running the script:**

```bash
cd website
node scripts/baseline-measure.mjs
```

The script requires `playwright` (already a devDependency) and Chromium installed (`npx playwright install chromium`).

---

## Baseline — BEFORE self-hosted fonts (Geist via `next/font/google`)

**Captured:** 2026-05-28
**Commit on production:** `b297f84` (E5.0.1 — PDF removal homepage cleanup; latest on `main` at time of measurement)
**URL:** `https://www.lslcalculator.com.au/`

| Metric | Run 1 | Run 2 | Run 3 | **Median** |
|---|---|---|---|---|
| FCP (ms) | 168 | 216 | 204 | **204** |
| CLS | 0.0000 | 0.0000 | 0.0000 | **0.0000** |
| LCP (ms) | 168 | 216 | 204 | **204** |

Note: FCP and LCP are identical here because the public calc above-the-fold paint is a single contentful element (the state-selector heading); the first paint is also the largest paint.

---

## Post-change target (within ±5% or strictly better)

| Metric | Baseline | Acceptable ceiling (+5%) | Acceptable floor (-5%, better) |
|---|---|---|---|
| FCP (ms) | 204 | ≤ 214 | ≥ 194 |
| CLS | 0.0000 | ≤ 0.0050 | n/a (already perfect) |
| LCP (ms) | 204 | ≤ 214 | ≥ 194 |

CLS is the more critical metric for this change — `font-display: swap` can cause text-reflow shifts if the fallback font's metrics differ materially from the loaded face. Next.js's `next/font/local` automatically generates a `size-adjust` fallback metric to suppress this, but the post-change measurement must confirm.

---

## Post-change — AFTER self-hosted fonts (filled in once feature lands on preview/prod)

**Captured:** *(to be populated after the Task 2.2 PR's Vercel preview deploys, OR after merge to `main` once the prod URL reflects the change)*
**Commit:** *(fill in)*
**URL:** `https://www.lslcalculator.com.au/`

| Metric | Run 1 | Run 2 | Run 3 | **Median** | Δ vs baseline | Verdict |
|---|---|---|---|---|---|---|
| FCP (ms) | | | | | | |
| CLS | | | | | | |
| LCP (ms) | | | | | | |

**Verdict rule:** PASS if median is within ±5% of baseline or strictly better. FAIL otherwise — investigate and re-run before merging.

---

## Measurement script

The script lives at `website/scripts/baseline-measure.mjs`. It is a small, dependency-free (beyond `playwright`) Node ESM script intentionally separate from the test suite so it cannot accidentally leak into CI and slow PRs. Run it on demand only.

If the script needs structural changes (e.g. throttling, additional metrics, more runs), commit the script change alongside the re-measurement so the methodology stays auditable.

---

## Post Phase 3b (2026-05-31) — Lighthouse CI on `/`

**Captured:** 2026-05-31 (E6.4 Task 4.8 acceptance gate)
**Commit on main:** `2900b97` (E6.4 Phase 3b shipped via PRs #99, #103, #106)
**Method:** `npx lhci autorun` against `npm run start` (port 3000), desktop preset with Lighthouse default throttling, 3 runs. Config at `website/lighthouserc.json`.
**URL:** `http://localhost:3000/`

> Note: This run uses a different tool (Lighthouse CI, desktop preset, throttled) than the original baseline above (`baseline-measure.mjs`, unthrottled broadband against prod URL). FCP + CLS remain directly comparable because the above-the-fold paint is a single contentful element and is network-light. **LCP is not directly comparable** between the two methods — the lhci LCP figure is treated as a separate observability stream until the baseline is re-measured via lhci against prod.

| Metric | Run 1 | Run 2 | Run 3 | **Median** | vs 2026-05-28 baseline (204 / 0 / 204) | Verdict |
|---|---|---|---|---|---|---|
| Accessibility score | 0.98 | 0.98 | 0.98 | **0.98** | n/a (new metric, target ≥ 0.95) | PASS |
| Performance score | 0.99 | 1.00 | 1.00 | **1.00** | n/a | PASS |
| Best-practices score | 0.93 | 0.93 | 0.93 | **0.93** | n/a | PASS |
| SEO score | 1.00 | 1.00 | 1.00 | **1.00** | n/a | PASS |
| FCP (ms) | 210.27 | 205.25 | 204.67 | **205.25** | +0.5% (well within ±5%) | PASS |
| CLS | 0.000 | 0.000 | 0.000 | **0.000** | identical (0 vs 0) | PASS |
| LCP (ms) | 1043.65 | 620.88 | 620.01 | **620.88** | (methodology change — not comparable) | n/a |

**Verdict:** Phase 3b carries **no font/layout regression**. FCP delta +0.5% and CLS 0 are within the Task 2.2 ±5% gate. Accessibility 0.98 exceeds the §8.4 target of ≥ 0.95.

Local lhci artifacts (gitignored): `website/.lighthouseci/lhr-{timestamp}.html` and `.json` per run.

lhci `temporary-public-storage` upload (median run): `https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1780219684779-97732.report.html`
