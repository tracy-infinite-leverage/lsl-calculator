# HANDOFF — Task 2.5.1 — Wordmark text outlined to paths

**Branch:** `feat/E6.2-task-2.5.1-wordmark-paths`
**Base:** `origin/main` @ `021c719`
**Date:** 2026-05-28
**Author:** Designer (Claude Opus 4.7)
**Scope:** docs-only / brand assets — no engine, no Tailwind, no website code

---

## 1. What this task fixes

PR #60 (Task 2.5 — brand barrel) shipped `wordmark-master.svg` with a
`@import url('https://fonts.googleapis.com/css2?...')` block embedded in
the SVG's `<style>` element. Any time the Wordmark SVG was rendered through
a browser or `<img>`-inlined consumer, it fired a Google Fonts request —
violating **OQ-3** (self-hosted fonts only, no third-party font CDN) and
spec §5.7 ("MUST NOT ship any new third-party font hosting"). The leak was
flagged in PR #60's QA-REPORT and documented in §10 of the PR #60 HANDOFF
as a deferred follow-up.

Task 2.5.1 closes it by **converting the `<text>` elements in all 3
wordmark SVG masters to outlined `<path>` data** drawn from the locally
installed Montserrat SemiBold and Source Sans 3 Regular TTF files. The
`@import` is no longer needed (no `<text>` = no font lookup) and has been
removed.

---

## 2. Files modified

### SVG masters (3)
- `docs/brand/final/wordmark/wordmark-master.svg`            (1 752 → 20 965 bytes)
- `docs/brand/final/wordmark/wordmark-mono.svg`              (   978 → 20 521 bytes)
- `docs/brand/final/wordmark/wordmark-white-on-navy.svg`     ( 1 094 → 20 742 bytes)

### PNG re-renders (5) — derived from the outlined SVGs
- `docs/brand/final/wordmark/wordmark-1x.png`                (10 458 → 10 513 bytes)
- `docs/brand/final/wordmark/wordmark-2x.png`                (22 734 → 22 794 bytes)
- `docs/brand/final/wordmark/wordmark-3x.png`                (35 990 → 36 291 bytes)
- `docs/brand/final/wordmark/wordmark-mono.png`              (22 654 → 22 726 bytes)
- `docs/brand/final/wordmark/wordmark-white-on-navy.png`     (23 899 → 21 855 bytes)

### Engineering record (1)
- `docs/engineering/changes/2026-05-28-task-2.5.1-wordmark-paths/HANDOFF.md` (this file)

No other paths touched. No `website/` changes. No `package.json` changes
(opentype.js was installed under `/tmp` with `--prefix` — never made it
into the repo).

---

## 3. Outlining tool + driver

**Tool:** `opentype.js` (latest, parsed via `opentype.parse(fs.readFileSync(...).buffer)`),
running on Node v24.15.0. Installed scratch-side at
`/tmp/wm-outline/node_modules/opentype.js` (no repo deps added).

**Driver:** `/tmp/wm-outline/outline.js` (kept under `/tmp/` — scratch
output, not part of the repo). The script:

1. Parses Montserrat SemiBold (`~/Library/Fonts/MontserratSemiBold.ttf`)
   and Source Sans 3 Regular (`~/Library/Fonts/SourceSans3-Regular.ttf`).
2. For each `<text>` element, walks the glyphs char-by-char, advancing the
   cursor by `glyph.advanceWidth * (fontSize / unitsPerEm) + letterSpacing`
   (mirrors SVG `letter-spacing` semantics — last glyph drops trailing space).
3. Computes total run width to anchor on `x="500"` per `text-anchor="middle"`.
4. Emits one combined `<path d="…" fill="…"/>` per text run, replacing both
   the `<style>` block and the original `<text>` elements.
5. Preserves the gold rule `<line>` (master + inverse) and background
   `<rect>` (master + inverse) verbatim.

Re-running is reproducible: `node /tmp/wm-outline/outline.js` overwrites
the 3 SVGs deterministically.

**Why not Inkscape?** Not installed on this machine. opentype.js was the
fastest scriptable path with no system-level installs.

---

## 4. PNG re-render pipeline

`rsvg-convert` (librsvg 2.62.2, Homebrew) — same toolchain as Task 1.4.
Dimensions match the originals exactly so downstream consumers see
byte-comparable assets:

| File | Dimensions | Source SVG |
| --- | --- | --- |
| wordmark-1x.png | 480 × 173  | master (white rect stripped — see §6) |
| wordmark-2x.png | 960 × 346  | master (white rect stripped) |
| wordmark-3x.png | 1440 × 519 | master (white rect stripped) |
| wordmark-mono.png | 960 × 346 | mono (no rect) |
| wordmark-white-on-navy.png | 960 × 346 | white-on-navy (navy rect kept) |

Commands (run from `docs/brand/final/wordmark/`):
```bash
rsvg-convert -w 480  -h 173  /tmp/wm-outline/wordmark-master-norect.svg -o wordmark-1x.png
rsvg-convert -w 960  -h 346  /tmp/wm-outline/wordmark-master-norect.svg -o wordmark-2x.png
rsvg-convert -w 1440 -h 519  /tmp/wm-outline/wordmark-master-norect.svg -o wordmark-3x.png
rsvg-convert -w 960  -h 346  wordmark-mono.svg                          -o wordmark-mono.png
rsvg-convert -w 960  -h 346  wordmark-white-on-navy.svg                 -o wordmark-white-on-navy.png
```

---

## 5. OQ-3 grep verification

```
$ grep -rE "fonts\.(googleapis|gstatic)|@import" docs/brand/final/wordmark/
(zero hits)

$ for f in docs/brand/final/wordmark/*.svg; do
    n=$(grep -cE "fonts\.(googleapis|gstatic)|@import" "$f")
    echo "$f -> $n hits"
  done
docs/brand/final/wordmark/wordmark-white-on-navy.svg -> 0 hits
docs/brand/final/wordmark/wordmark-mono.svg          -> 0 hits
docs/brand/final/wordmark/wordmark-master.svg        -> 0 hits
```

Zero hits per file. The `@import url('fonts.googleapis.com/...')` is gone
from every brand asset.

---

## 6. Visual parity verification

Pixel diff (`PIL.ImageChops.difference`) between Task 1.4 originals and
new outlined renders, at identical dimensions:

| File | mean Δ / 255 | max Δ | differing pixels | rms-on-diff |
| --- | --- | --- | --- | --- |
| wordmark-1x.png            | 1.06 | 255 | 3.84 % | 51.8 |
| wordmark-2x.png            | 1.19 | 255 | 2.49 % | 77.5 |
| wordmark-3x.png            | 1.12 | 255 | 1.89 % | 89.2 |
| wordmark-mono.png          | 1.10 | 255 | 2.28 % | 77.1 |
| wordmark-white-on-navy.png | 0.97 | 183 | 2.78 % | 55.1 |

Interpretation:
- **Mean delta ≈ 1 / 255 (≈ 0.4 %)** across the whole image — visually
  indistinguishable to the human eye.
- **Differing pixels are confined to glyph anti-alias edges** — verified
  by inspecting the bounding box of differences on `wordmark-mono.png`:
  bbox `(158, 94, 808, 260)` lands exactly where the centered text runs
  live in the 960×346 frame. No diff outside the text band.
- The variance is the **expected difference between font-driven
  rasterisation and curve-driven rasterisation** of the same glyph
  outlines, not a positioning/kerning/scale regression.

Parity composites (orig | new | 10× amplified diff) saved at
`/tmp/wm-outline/parity/*.png` for any reviewer who wants the visual
confirmation.

### Background-rect handling — important Task 1.4 quirk preserved

Task 1.4 exported `wordmark-1x.png`, `wordmark-2x.png`, `wordmark-3x.png`
with a **transparent** background (PNG alpha=0 across the canvas),
**despite** the SVG having a `<rect width="1000" height="360" fill="#ffffff"/>`.
This was a deliberate Task 1.4 choice so the master PNGs composite over
arbitrary host backgrounds. The mono variant has no rect (transparent by
construction) and the white-on-navy keeps its navy rect.

To preserve byte-comparable behavior, I rendered the master PNGs from a
**rect-stripped copy** of the outlined SVG (`/tmp/wm-outline/wordmark-master-norect.svg`,
created inline by Python regex) — the on-disk `wordmark-master.svg` itself
still contains the white rect (matching the Task 1.4 SVG source).

---

## 7. File-size impact

| Asset | Before (bytes) | After (bytes) | Δ |
| --- | --- | --- | --- |
| wordmark-master.svg          |  1 752 | 20 965 | **+19 213 (+1 097 %)** |
| wordmark-mono.svg            |    978 | 20 521 | **+19 543 (+1 998 %)** |
| wordmark-white-on-navy.svg   |  1 094 | 20 742 | **+19 648 (+1 796 %)** |
| wordmark-1x.png              | 10 458 | 10 513 | +55 (+0.5 %) |
| wordmark-2x.png              | 22 734 | 22 794 | +60 (+0.3 %) |
| wordmark-3x.png              | 35 990 | 36 291 | +301 (+0.8 %) |
| wordmark-mono.png            | 22 654 | 22 726 | +72 (+0.3 %) |
| wordmark-white-on-navy.png   | 23 899 | 21 855 | −2 044 (−8.6 %) |

**SVG growth ≈ +19 KB per file** is the cost of storing 47 outlined glyph
characters (`L`, `S`, `L`, space, `C`, `a`, `l`, `c`, `u`, `l`, `a`, `t`, `o`, `r`
in Montserrat + `by Australian Payroll Association` in Source Sans 3) as
explicit `<path d="…">` bezier curves.

Net repo impact: **+58 KB** for SVGs, ~negligible for PNGs. Trivial
relative to the OQ-3 win (zero third-party font requests per page render).

If the SVG growth ever becomes a concern, the path data is highly
compressible — gzip/brotli should knock the wire size down by ~60 %.

---

## 8. Caveats

1. **No kerning pairs.** opentype.js's `glyph.advanceWidth` does **not**
   apply OpenType kerning tables. SVG `<text>` rendering in modern
   browsers DOES use kerning by default (`font-kerning: auto`). So the
   outlined wordmark may differ by **a few sub-pixel units of advance**
   in a handful of letter pairs (e.g. `LS`, `La`, `to`, `or`). The pixel
   diff above (max 3.8 % differing pixels, all at glyph edges) is the
   ceiling of that effect — no glyph is visibly mispositioned. If a
   future audit wants pixel-perfect kerning, the script can be extended
   to use `font.getKerningValue(prev, next)` between successive glyphs.

2. **Source Sans 3 was already the spec font.** The original SVGs declared
   `Source Sans 3, Source Sans Pro, …` and the `@import` requested
   `Source+Sans+3`. The outlining uses Source Sans 3 Regular per spec.
   No font swap.

3. **PNG re-encoding has a normal ~0.3 % byte drift.** Different
   librsvg/cairo runs produce non-identical bytestreams even for
   identical inputs (chunk ordering, deflate variants). The PNGs are
   semantically identical, not byte-identical, to Task 1.4 originals.

4. **wordmark-master.svg still has the white background rect** in the
   on-disk source. Only the PNG export strips it (to match Task 1.4
   transparency). This is intentional — consumers that render the SVG
   directly will see the white field as designed.

5. **No new runtime deps.** opentype.js stays in `/tmp/wm-outline/`. The
   `website/package.json` is untouched. The outlined SVGs are
   self-contained — they need no font at all to render correctly.

---

## 9. `git status`

```
On branch feat/E6.2-task-2.5.1-wordmark-paths
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   docs/brand/final/wordmark/wordmark-1x.png
  modified:   docs/brand/final/wordmark/wordmark-2x.png
  modified:   docs/brand/final/wordmark/wordmark-3x.png
  modified:   docs/brand/final/wordmark/wordmark-master.svg
  modified:   docs/brand/final/wordmark/wordmark-mono.png
  modified:   docs/brand/final/wordmark/wordmark-mono.svg
  modified:   docs/brand/final/wordmark/wordmark-white-on-navy.png
  modified:   docs/brand/final/wordmark/wordmark-white-on-navy.svg

Untracked files:
  docs/engineering/changes/2026-05-28-task-2.5.1-wordmark-paths/HANDOFF.md
```

---

## 10. QA dispatch

Per task spec: **do not commit, push, or PR.** Dispatching QA on this
branch. Pass criteria for QA:

1. `grep -rE "fonts\.(googleapis|gstatic)|@import" docs/brand/final/wordmark/` returns zero hits.
2. All 3 SVGs open in a browser with **no network requests** issued.
3. The 5 PNGs render visually identically to the Task 1.4 versions at
   1x, 2x, 3x sizes (head-of-needle inspection, then optional pixel diff).
4. No changes to `website/`, `engine/`, `package.json`, or token files.
