# LSL Calculator — Final Brand Assets

> **Status:** Produced by Task 1.4 of E6.1 (Phase 1) on 2026-05-28.
> **Source masters:** approved Candidate B wordmark and approved 512×512 app icon (operator sign-off 2026-05-28).
> **Downstream:** Phase 2 / E6.2 copies these into `website/public/` via the `scripts/sync-brand-assets` step described in `.specify/features/006-ui-design-system/tasks.md` Task 1.4.

This folder is the **single source of truth** for every rendered brand asset used at runtime by the LSL Calculator product. The vector masters here are the only files that may be re-edited. Every PNG and ICO file is **derived output** — if a change is needed, edit the master SVG and re-render via the same build pipeline (see "Rendering pipeline" below), do not pixel-push the raster.

---

## Inventory

### `wordmark/`

| File | Type | Spec | Use |
| --- | --- | --- | --- |
| `wordmark-master.svg` | **vector master** | 1000×360 viewBox | Canonical wordmark. Identical to `docs/brand/wordmark-candidates/candidate-b.svg`. Has a white backing rect for the master file; raster exports drop the rect for transparency. |
| `wordmark-1x.png` | rendered | 480×173, transparent | Standard 1× display (e.g. header at typical zoom). |
| `wordmark-2x.png` | rendered | 960×346, transparent | Retina / @2× display. |
| `wordmark-3x.png` | rendered | 1440×519, transparent | @3× / large-screen display. |
| `wordmark-mono.svg` | vector master | 1000×360 | Navy-only variant — gold rule removed. For use inside coloured fields where the gold accent would clash. |
| `wordmark-mono.png` | rendered | 960×346, transparent | @2× raster of the mono variant. |
| `wordmark-white-on-navy.svg` | vector master | 1000×360 | Inverse variant — navy field, white type, gold rule preserved. For dark / coloured contexts. |
| `wordmark-white-on-navy.png` | rendered | 960×346 (navy background baked in) | @2× raster of the inverse variant. |

### `app-icon/`

| File | Type | Spec | Use |
| --- | --- | --- | --- |
| `app-icon-master.svg` | **vector master** | 512×512 | Canonical app icon. Identical to `docs/brand/icon-mockups/app-icon.svg`. Rounded-square navy field + white LSL monogram + gold corner square. |
| `icon-16.png` | rendered | 16×16, simplified | **No monogram** — navy rounded square + gold 4×4 corner only (icon-direction.md §7). Browser tab favicon at 1× density. |
| `icon-32.png` | rendered | 32×32, simplified | Single **L** + gold 6×6 corner (LSL not legible at 32px). Browser tab favicon at retina density. |
| `icon-48.png` | rendered | 48×48, simplified | Same composition as 32×32 scaled up. Legacy ICO layer. |
| `apple-touch-icon-180.png` | rendered | 180×180, **no transparency** | Full LSL monogram. Navy fills the entire square edge-to-edge so iOS can apply its own rounded-corner mask. |
| `android-chrome-192.png` | rendered | 192×192, transparent corners | Full LSL monogram. Android launcher icon. |
| `android-chrome-512.png` | rendered | 512×512, transparent corners | Full LSL monogram. PWA manifest source. |
| `icon-512.png` | rendered | 512×512, transparent corners | Same image as `android-chrome-512.png`; some PWA manifests reference this name. |
| `favicon.ico` | rendered (multi-resolution) | 16/32/48 PNG layers | Multi-resolution ICO containing the three simplified glyphs above as separate layers. Browsers pick the best match. |
| `safari-pinned-tab.svg` | **vector master** | 512×512, monochrome | Single-colour navy SVG of the full app icon, no gold. Safari uses it as a monochrome mask. |
| `_sources/favicon-16.svg` | vector source | 16×16 viewBox | Source for `icon-16.png`. Kept under `_sources/` so the favicon simplification rule remains auditable. |
| `_sources/favicon-32.svg` | vector source | 32×32 viewBox | Source for `icon-32.png`. |
| `_sources/favicon-48.svg` | vector source | 48×48 viewBox | Source for `icon-48.png`. |

### `og/`

| File | Type | Spec | Use |
| --- | --- | --- | --- |
| `og-card.svg` | **vector master** | 1200×630 | Open Graph card master. White background, navy wordmark centred at ~60% width, app-icon glyph (96×96) in upper-right at 48px inset. |
| `og-card.png` | rendered | 1200×630 | Rendered OG card for `<meta property="og:image">` and Twitter card. |
| `og-card-square.svg` | **vector master** | 1200×1200 | Square OG fallback for surfaces that crop horizontal images. Wordmark centred vertically with the app-icon glyph (160×160) beneath. |
| `og-card-square.png` | rendered | 1200×1200 | Rendered square OG card. |

---

## How Phase 2 / E6.2 should use these

Per `icon-direction.md §6.3`, the install paths in `website/public/` map one-to-one with the files above. Phase 2's `scripts/sync-brand-assets.{ts,sh}` should copy as follows:

| Source under `docs/brand/final/` | Target under `website/public/` |
| --- | --- |
| `wordmark/wordmark-master.svg` | `/brand/wordmark.svg` |
| `wordmark/wordmark-1x.png` | `/brand/wordmark-1x.png` |
| `wordmark/wordmark-2x.png` | `/brand/wordmark-2x.png` |
| `wordmark/wordmark-3x.png` | `/brand/wordmark-3x.png` |
| `wordmark/wordmark-mono.svg` | `/brand/wordmark-mono.svg` |
| `wordmark/wordmark-mono.png` | `/brand/wordmark-mono.png` |
| `wordmark/wordmark-white-on-navy.svg` | `/brand/wordmark-white-on-navy.svg` |
| `wordmark/wordmark-white-on-navy.png` | `/brand/wordmark-white-on-navy.png` |
| `app-icon/icon-16.png` | `/favicon-16x16.png` |
| `app-icon/icon-32.png` | `/favicon-32x32.png` |
| `app-icon/apple-touch-icon-180.png` | `/apple-touch-icon.png` |
| `app-icon/android-chrome-192.png` | `/android-chrome-192x192.png` |
| `app-icon/android-chrome-512.png` | `/android-chrome-512x512.png` |
| `app-icon/icon-512.png` | `/icon-512x512.png` |
| `app-icon/favicon.ico` | `/favicon.ico` |
| `app-icon/safari-pinned-tab.svg` | `/safari-pinned-tab.svg` |
| `og/og-card.png` | `/og/og-card.png` |
| `og/og-card-square.png` | `/og/og-card-square.png` |

`website/public/brand/` and `website/public/og/` should be gitignored (per Task 1.4 AC) since they are derived from this folder at build time.

---

## Masters vs rendered finals

- **Vector masters (editable):** `wordmark-master.svg`, `wordmark-mono.svg`, `wordmark-white-on-navy.svg`, `app-icon-master.svg`, `safari-pinned-tab.svg`, `og-card.svg`, `og-card-square.svg`, plus the three favicon source SVGs under `app-icon/_sources/`.
- **Rendered finals (do not edit in place):** every `.png` and `.ico` file. Re-render from the master via the build pipeline if a change is needed.

If you need to update an asset:

1. Edit the relevant `*.svg` master.
2. Re-run the render script (see "Rendering pipeline").
3. Commit the master + the re-rendered raster together.

---

## Rendering pipeline

Assets in this folder were produced via `rsvg-convert` (librsvg 2.62.2) for SVG→PNG conversion and Pillow 11.3 for multi-resolution ICO assembly. The build script that produced this set is the standalone Python script `/tmp/render-assets.py` used during Task 1.4 — if Phase 2 needs a re-render, port that script into `scripts/render-brand-assets.{ts,py,sh}` in the repo.

**Font handling.** The SVG masters reference Montserrat (Bold + SemiBold) and Source Sans 3 by family name. The render machine had these fonts installed system-wide (under `~/Library/Fonts/`) at render time. **The PNGs are deterministic ONLY when rendered on a machine with those fonts available.** For a reproducible build:

- Either install Montserrat + Source Sans 3 into the build environment before rendering, OR
- Convert the text glyphs to SVG paths inside the master files before rendering (preferred for long-term reproducibility — eliminates the font-availability dependency entirely).

This run used the "install fonts on the build machine" approach. Phase 2 may want to upgrade to inline-glyph-paths to remove the font dependency from CI.

---

## Pointers

- **Wordmark candidates + decision history:** [`../wordmark-candidates/README.md`](../wordmark-candidates/README.md)
- **Icon direction + design rationale:** [`../icon-direction.md`](../icon-direction.md)
- **Spec acceptance criteria:** [`.specify/features/006-ui-design-system/spec.md`](../../../.specify/features/006-ui-design-system/spec.md) §8.1
- **Task 1.4 in tasks.md:** [`.specify/features/006-ui-design-system/tasks.md`](../../../.specify/features/006-ui-design-system/tasks.md)
- **Parent APA Brand Guidelines:** [`../apa-brand-source.pdf`](../apa-brand-source.pdf)
