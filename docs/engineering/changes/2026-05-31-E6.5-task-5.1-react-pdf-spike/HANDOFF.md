# HANDOFF — E6.5 Task 5.1: react-pdf spike

**Date:** 2026-05-31
**Branch:** `feat/E6.5-5.1-react-pdf-spike` (worktree `/Users/tracyangwin/code-projects/lsl-e6-5`)
**Effort:** M
**Spec anchors:** `.specify/features/006-ui-design-system/spec.md` §5.4, §5.7, §8.5, OQ-10; `.specify/features/006-ui-design-system/impl-plan.md` §PD-1; `.specify/features/006-ui-design-system/dev-findings.md` PD-1; `.specify/features/006-ui-design-system/tasks.md` lines 599–615.

---

## TL;DR — go/no-go on react-pdf

**GO. Proceed with `@react-pdf/renderer` for Tasks 5.2–5.7.** The citation-block rich-text path works cleanly. Puppeteer fallback is NOT required.

Three operational findings landed during the spike that Task 5.2 must absorb before shipping the production Letterhead + CitationBlock + footer components. None block proceeding; all are well-understood with documented fixes.

---

## Acceptance criteria — verdict (tasks.md 605–611)

| AC | Verdict | Evidence |
|---|---|---|
| 5-page test PDF renders correctly on A4 | PASS | `spike-output.pdf` is 5 pages, every page MediaBox = `[0 0 595.280029 841.890015]` = 210 × 297 mm exactly. |
| Letterhead visible on page 1 only | PASS | "LSL Liability — Spike Test Report" + APA subtitle + wordmark proxy appear once (line 1 of extracted text). Pages 2–5 start directly with body content. |
| Full methodology footer on page 1; short version on pages 2–5 | PASS | Page 1: `Calculation methodology v0.7.2 · State engine v2.4.1 · Data as at 2026-05-31` + `Calculated, not advice. Contact: support@austpayroll.com.au · www.austpayroll.com.au`. Pages 2–5: `State engine v2.4.1 · Calculated, not advice · www.austpayroll.com.au`. |
| Page X of Y on every page | PASS | "Page 1 of 5" through "Page 5 of 5" — verified via `pdftotext -layout`. |
| Both font faces embed cleanly | PARTIAL — see finding #1 | The brand woff2 files in `public/fonts/` crash `fontkit` during PDF subsetting. Spike uses Helvetica + Helvetica-Bold (built-in PDF Standard 14) to prove layout. Production needs unsubset TTF/OTF source files alongside the woff2 web assets. Fix is contained — see finding #1. |
| If citation rich text fails, document failure + decide Puppeteer fallback | PASS — does NOT fail | Citation block renders cleanly. See finding #2 for the one minor caveat (italic style needs a registered italic font, dropped to weight contrast). |

---

## Findings

### Finding #1 (CRITICAL — gate for Task 5.2): woff2 in `public/fonts/` cannot be subset by fontkit

**Symptom:**
```
RangeError: Offset is outside the bounds of the DataView
  at DataView.prototype.setUint16
  at TTFSubset._addGlyph
  at EmbeddedFont.embed
```

**Root cause:** The woff2 files in `website/public/fonts/` are pre-subset latin-only files (15–18 KB each, vs the canonical ~80–95 KB unsubset originals). They serve the browser perfectly via Next.js `localFont`, but `fontkit` (the font library `@react-pdf/renderer` uses) cannot RE-subset them for PDF embedding — it tries to access glyph offsets that the upstream subsetting already removed.

**Verification:** A standalone probe with `/Library/Fonts/Arial Unicode.ttf` (a normal full TTF) rendered cleanly via the same `Font.register(...)` call. Confirmed react-pdf + fontkit work fine with non-pre-subset fonts; the woff2 in our repo is the only constraint.

**Fix for Task 5.2 (the actual production work):**
1. Add **unsubset TTF or OTF** source files for the PDF pipeline, kept alongside the web-facing woff2:
   - `website/public/fonts/pdf/Montserrat-SemiBold.ttf`
   - `website/public/fonts/pdf/SourceSans3-Regular.ttf`
   - `website/public/fonts/pdf/SourceSans3-SemiBold.ttf`
2. Sources: SIL OFL 1.1, available from Google Fonts (Montserrat) and Adobe Fonts / GitHub source-sans (Source Sans 3) — same licence + foundry as the existing woff2.
3. Register them in the PDF templates via `Font.register({ family, fonts: [{ src: absolutePath, fontWeight }] })`.
4. The web `@font-face` declarations in `layout.tsx` stay on woff2 — no regression for browser users.
5. Update `scripts/audit-bundle.mjs` to confirm the TTF files only ship to the serverless function bundle, not to the browser bundle (they're ~3× larger; we don't want them on the public asset path).

**Cost:** ~5 lines in Task 5.2's Letterhead PR; +~300 KB to the serverless function payload (still well under Vercel's 50 MB limit for Node runtime). No change to public bundle.

### Finding #2 (LOW): No italic woff2 ships — citation-note italic style must drop

**Symptom:**
```
Error: Could not resolve font for Source Sans 3, fontWeight 400, fontStyle italic
  at FontFamily.resolve
```

**Root cause:** react-pdf strictly resolves font variants — it cannot synthesise italic from a roman font. The shipped font set in `public/fonts/` is `light` + `regular` + `semibold` roman variants only — no italic.

**Decision for Task 5.3 (CitationBlock production component):** drop italic styling on the citation `note`. Use `color: muted-foreground` (already in the web component) + a small `marginTop` for visual separation instead of `font-style: italic`. The web component (`website/src/components/lsl/citation-block.tsx`) currently uses `italic` — Task 5.3 will either:
- (a) Drop italic from both web and PDF for consistency, or
- (b) Ship italic woff2 + italic OTF/TTF files (more font work; consult designer agent).

Operator-facing impact is minimal — the citation note is supporting text, not body content.

### Finding #3 (HOW-TO — no code change needed): font paths must be filesystem paths, not `file://` URLs

**Symptom:**
```
TypeError: fetch failed
  cause: Error: not implemented... yet...
  at schemeFetch (node:internal/deps/undici/undici)
```

**Root cause:** `@react-pdf/font`'s `FontSource._load()` runs `isUrl(this.src)` → branches to `fetch(src)` for any URL-shaped input. Node's undici fetch does not implement the `file://` scheme. The fallback branch is `fontkit.open(this.src)` which reads a bare filesystem path directly.

**Decision for Task 5.4 (serverless function):** when constructing absolute paths to the bundled TTFs at runtime in the serverless function, use bare absolute filesystem paths (`/var/task/fonts/Montserrat-SemiBold.ttf` or `path.join(process.cwd(), 'public', 'fonts', 'pdf', '...')`). Do NOT use `pathToFileURL()` for Node-context font registration.

### Finding #4 (PATTERN — adopt in Task 5.2): single `<Page>` + render-prop footer for OQ-10

**Tried first:** two `<Page>` blocks in the document — one for page 1 with full footer, one for pages 2+ with short footer.

**What broke:** page 1 body content overflowed into a second page that inherited the page-1 footer, producing "full footer on page 2" — violates OQ-10.

**Pattern that works:** single `<Page>` with a single fixed footer `<View>` whose children use the `render={({ pageNumber }) => ...}` callback to switch between full + short content. This is the canonical react-pdf pattern for per-page content variants.

**Recorded in spike code** at `MethodologyFooter` — Task 5.2 should adopt verbatim.

---

## Files in this PR

- **`website/scripts/e6-pdf-spike.tsx`** — the spike harness (~440 lines). Heavily commented with the four findings inline. NOT imported by application code. Lives under `scripts/` (sibling to `src/`) so Next.js build does not pick it up.
- **`website/package.json`** — one new line: `"spike:pdf": "tsx scripts/e6-pdf-spike.tsx"`. No dependency changes (`@react-pdf/renderer@^4.5.1` was already in package.json + lockfile per dev-findings PD-1).
- **`docs/engineering/changes/2026-05-31-E6.5-task-5.1-react-pdf-spike/spike-output.pdf`** — 13 KB rendered artifact. 5 A4 pages.
- **`docs/engineering/changes/2026-05-31-E6.5-task-5.1-react-pdf-spike/spike-output-page1.png`** — 158 KB rasterised page-1 preview for PR description visual review.
- **`docs/engineering/changes/2026-05-31-E6.5-task-5.1-react-pdf-spike/HANDOFF.md`** — this document.

---

## Dependency state

- `@react-pdf/renderer@4.5.1` — confirmed in `website/package.json` line 22 + `website/package-lock.json`. `npm install` was a no-op (nothing to add). Lockfile untouched.
- `tsx@^4.22.3` — existing devDep; used by the `spike:pdf` script via `npx tsx`.
- No new direct or transitive dependency added.

---

## Validation evidence

**A4 dimension check** (all 5 pages):
```
$ node -e "const f=require('fs').readFileSync('/tmp/e6-pdf-spike.pdf','latin1');
> console.log((f.match(/\\/MediaBox\\s*\\[[^\\]]+\\]/g)||[]).join('\\n'))"
/MediaBox [0 0 595.280029 841.890015]
/MediaBox [0 0 595.280029 841.890015]
/MediaBox [0 0 595.280029 841.890015]
/MediaBox [0 0 595.280029 841.890015]
/MediaBox [0 0 595.280029 841.890015]
```
PDF point conversion: 595.28 pt = 210 mm and 841.89 pt = 297 mm — exactly A4 per ISO 216.

**Footer split + page numbering** (from `pdftotext -layout`):
```
Page 1 of 5 — full: Calculation methodology v0.7.2 · State engine v2.4.1 · Data as at 2026-05-31
                    Calculated, not advice. Contact: support@austpayroll.com.au · www.austpayroll.com.au
Page 2 of 5 — short: State engine v2.4.1 · Calculated, not advice · www.austpayroll.com.au
Page 3 of 5 — short: State engine v2.4.1 · Calculated, not advice · www.austpayroll.com.au
Page 4 of 5 — short: State engine v2.4.1 · Calculated, not advice · www.austpayroll.com.au
Page 5 of 5 — short: State engine v2.4.1 · Calculated, not advice · www.austpayroll.com.au
```

**Citation block** (rendered as page-1 trailing block):
```
[bordered-left rule] [book glyph]  NSW Long Service Leave Act 1955
                                   s.4(1)(a) · accrual rate 2/12 · LSL-training PDF p.14
                                   Applies to employees completing 10 years continuous service.
[bordered-left rule] [book glyph]  VIC Long Service Leave Act 2018
                                   s.6(2) · 13/60 weeks per year of service · LSL-training PDF p.22
                                   Continuous service includes unpaid parental leave up to 12 months (s.10).
[bordered-left rule] [book glyph]  QLD Industrial Relations Act 2016
                                   s.95 · 8.6667 weeks at 10 years · LSL-training PDF p.37
```
Demonstrates: nested `<Text>` for inline styling (the `· LSL-training PDF p.N` suffix is a nested `<Text>` inside the rule `<Text>`), bordered-left visual rule via `<View borderLeftWidth=2>`, inline `<Svg><Path/></Svg>` for the book glyph, multi-paragraph layout per item.

---

## Local gate state

- `npx tsc --noEmit` — clean (zero output).
- `npx eslint scripts/e6-pdf-spike.tsx` — clean (zero errors, zero warnings).
- `npm run lint` (full) — only pre-existing errors in `website/src/lib/lsl/**` and `website/src/lib/observability/**` (unrelated to this PR). Confirmed nothing introduced by this change.
- `npm run test` — 3026 passed, 32 skipped (pre-existing).
- `npm run build` — succeeds; `audit-bundle` PASS (no third-party origins, no SVG `@import` leaks, bundle-chunks 1809.6 KB).
- `npm run spike:pdf` — succeeds; renders 13 KB PDF to `/tmp/e6-pdf-spike.pdf`.

Playwright not run for this PR — the spike is a Node-side build-script with zero application surface area, and the dispatch's Playwright guidance addresses client/server boundary bugs from importing `'use client'` modules into server scripts. The spike intentionally does not import from `website/src/`, so the lesson from PR #108 does not apply here.

---

## Recommended sequence for Task 5.2 onward

1. **Task 5.2 (Letterhead) pre-work** — operator or designer ships unsubset TTF/OTF source files into `website/public/fonts/pdf/` (Montserrat-SemiBold, SourceSans3-Regular, SourceSans3-SemiBold). Estimated effort: <30 min, just downloads + copy. Documented in finding #1 above.
2. **Task 5.2 (Letterhead production component)** — proceed with react-pdf. Promote the spike's patterns:
   - `Font.register({ family, fonts: [{ src: ttfPath, fontWeight }] })` with TTF paths (NOT woff2, NOT `file://`).
   - Single-`<Page>` + render-prop footer pattern (finding #4).
   - Inline the actual wordmark path data from `docs/brand/final/wordmark/wordmark-master.svg` (already text-outlined to `<path>` per PR #62 — safe to inline).
3. **Task 5.3 (CitationBlock production component)** — proceed with react-pdf. Decide on italic note treatment (finding #2) — operator + designer call.
4. **Task 5.4 (serverless function)** — use bare absolute filesystem paths for font registration (finding #3).
5. **Tasks 5.5–5.7** — should be straightforward once 5.2–5.4 land.

**Do NOT fall back to Puppeteer.** No technical justification for it surfaced during the spike. react-pdf is the right call.

---

## Out of scope / explicit non-goals

- This PR does not ship the production Letterhead, MethodologyFooter, or CitationBlock components — those are Tasks 5.2 / 5.2-attached / 5.3 respectively.
- The spike does not exercise the serverless function bundling path — that's Task 5.4.
- The spike does not exercise the public route handler that downloads a PDF — that's Phase 5a.
- No print stylesheet work (separate AC §8.5 bullet not load-bearing for the spike).
- No PDF/UA tagging — explicitly out of v1 scope per spec §5.5.

---

## QA brief (for the orchestrator's QA dispatch)

The deliverable is a one-shot validation harness, not application surface. QA should verify:
- `npm run spike:pdf` succeeds on a fresh checkout.
- `/tmp/e6-pdf-spike.pdf` opens in Preview and reads cleanly (no font rendering glitches, layout intact).
- `pdftotext -layout /tmp/e6-pdf-spike.pdf -` produces the expected page count + footer split (commands in §Validation evidence above).
- `docs/engineering/changes/2026-05-31-E6.5-task-5.1-react-pdf-spike/spike-output.pdf` matches the freshly-generated one byte-for-byte modulo react-pdf's nondeterministic CreationDate (it is not — react-pdf injects a fresh timestamp per render — but the page count + MediaBox + extracted text should match).
- The three findings in this handoff are reflected in the spike file's inline comments.
- No new dependency in `website/package.json` beyond the `spike:pdf` script.
