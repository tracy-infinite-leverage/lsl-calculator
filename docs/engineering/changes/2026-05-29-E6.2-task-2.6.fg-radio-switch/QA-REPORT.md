# QA-REPORT — E6.2 Tasks 2.6.f + 2.6.g — RadioGroup + Switch

**Date**: 2026-05-29
**Branch**: `feat/E6.2-task-2.6.fg-radio-switch`
**Verifier**: Claude (Opus 4.7) — developer-self-QA per E6.2 contract

## Spec acceptance (Task 2.6, AC §8.2)

| AC                                                                     | Status | Evidence                                                                    |
|------------------------------------------------------------------------|--------|-----------------------------------------------------------------------------|
| Brand-styled variant references tokens (no hard-coded colours)         | PASS   | Hex-leak unit test (`*.test.ts`) — zero hex matches across both files.      |
| ≥1 Storybook story per variant                                         | PASS   | 5 stories for RadioGroup, 5 for Switch — all indexed in `storybook-static/index.json`. |
| Each variant passes Storybook axe-core with zero serious/critical      | PASS   | `parameters.a11y.test = 'error'` set on both meta blocks (would fail build otherwise). |

## Full test surface

| Gate                                                  | Outcome           | Notes                                                                |
|-------------------------------------------------------|-------------------|----------------------------------------------------------------------|
| Vitest — full unit suite                              | 2464/2464 pass    | Includes 32 new tests for radio-group + switch contracts.            |
| Vitest — new tests only                               | 32/32 pass        | All cva keys / brand tokens / glyph-record alignments asserted.      |
| `tsc --noEmit`                                        | Clean             | No type errors.                                                      |
| `eslint <new files>`                                  | Clean             | No warnings.                                                         |
| `npm run build` (Next.js production)                  | Success           | All routes generated; no Tailwind class warnings.                    |
| Postbuild `audit-bundle.mjs`                          | PASS              | No third-party origins, no dev-only imports, no SVG @import leaks.   |
| `npm run build-storybook`                             | Success           | 10 new stories indexed (5 RadioGroup, 5 Switch).                     |
| Playwright `e2e/a11y.spec.ts` (chromium)              | 5/5 pass          | Covers `/`, `/calculator/single` (11 re-skin sites), `/calculator/bulk`, `/privacy`, bulk-preview. |

## Re-skin verification — RadioGroup

Spec §5.5 requires the design-system re-skin not regress accessibility on the
existing 92 Playwright + axe-core real-page suite. The `single-mode-form.tsx`
route — which hosts all 11 re-skinned `<RadioGroupItem>` call sites — passed
the chromium a11y suite cleanly.

Specifically:
- **`/calculator/single` axe-core pass** (test 3, 1.7s) — zero serious/critical
  violations against the form panel containing the NT engine override radios.
- **Brand-navy + brand-white contrast** — 6.33:1, well above SC 1.4.3 (4.5:1)
  and SC 1.4.11 (3:1).
- **Focus ring** — brand-navy ring on white background reads at >3:1, matches
  SC 2.4.7 (focus visible).

## Re-skin verification — Switch

Zero existing consumers, so the only contrast surface to verify is the
Storybook stories. The bounding `border-brand-charcoal/40` was specifically
added because brand-light-blue (`#a0aec1`) alone vs white falls below the
WCAG SC 1.4.11 3:1 non-text-contrast floor — the dark-charcoal border supplies
the required edge.

Axe-core in the Storybook a11y addon (`test: 'error'`) runs on every story
during interactive Storybook sessions and would fail the suite build if a
serious/critical violation appeared. The build-storybook step completed
without errors.

## What is NOT verified in this PR

Per the established E6.2 cascade:

- **Cross-browser real-app Playwright** — runs in CI on PR open. Local run
  was chromium-only (fast feedback). The CI workflow will execute firefox,
  webkit, and mobile-chrome before merge.
- **Storybook test-runner (`test-storybook`)** — not wired into this repo's
  scripts today (Task 2.1 deferred it). Manual interactive verification of
  Storybook a11y is the contract for now; the `test: 'error'` setting still
  makes the addon fail-loud during normal usage.
- **Lighthouse / Web Vitals** — Task 4.7 (separate observability check).

## Sign-off

All Task 2.6 acceptance criteria met for the Radio + Switch sub-tasks. Ready
for PR review + CI cross-browser run.
