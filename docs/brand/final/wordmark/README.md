# LSL Calculator — Final Wordmark Assets

**Spec:** [`.specify/features/006-ui-design-system/spec.md`](../../../.specify/features/006-ui-design-system/spec.md) §7.6 + §8.1 (E6.1)
**Source candidate:** Candidate B (stacked masthead with gold accent rule)

## Operator sign-off (Task 1.3 AC)

Operator-approved on **2026-05-28** by **Tracy Angwin**. Full decision record + rationale lives in [`../../wordmark-candidates/README.md`](../../wordmark-candidates/README.md) (the candidate-review document is the canonical sign-off record — this file is a discovery pointer so future readers landing in `final/wordmark/` can find it).

## Files

| File | Purpose |
|---|---|
| `wordmark-master.svg` | Master SVG — single source of truth for the wordmark |
| `wordmark-1x.png` / `wordmark-2x.png` / `wordmark-3x.png` | Raster exports for HTML `<img>` use |
| `wordmark-mono.svg` / `wordmark-mono.png` | Monochrome variant (single-colour reproductions) |
| `wordmark-white-on-navy.svg` / `wordmark-white-on-navy.png` | Inverse variant for dark backgrounds |

Sibling directories under `docs/brand/final/`:
- `app-icon/` — favicon set (16/32/48/180/192/512) + Apple touch icon + safari-pinned-tab.svg
- `og/` — Open Graph card variants

## Build-time sync

These files are NOT served directly. The `prebuild` and `prestorybook` scripts run [`website/scripts/sync-brand-assets.mjs`](../../../website/scripts/sync-brand-assets.mjs) which copies the relevant assets into `website/public/brand/` (gitignored). Symlinks were explicitly rejected — Vercel build container + OS differences make them fragile (Task 1.4 G-12 resolution).

## Typography

The wordmark text is **outlined to paths** in the master SVG (Task 2.5.1, [PR #62](https://github.com/tracy-infinite-leverage/lsl-calculator/pull/62)) so it renders identically across systems regardless of font loading. The original sources for reference:
- Primary: Montserrat Semibold (`@fontsource/montserrat`)
- Secondary: Source Sans 3 Regular (`@fontsource/source-sans-3` — Adobe's 2021 rename of Source Sans Pro, see spec v0.5 Clarification Summary)
