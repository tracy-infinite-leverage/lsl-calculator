# HANDOFF — E6.5 Task 5.2: Production Letterhead component

**Date:** 2026-05-31
**Branch:** `feat/E6.5-5.2-letterhead` (worktree `/Users/tracyangwin/code-projects/lsl-e6-5`)
**Effort:** S (per tasks.md line 599)
**Spec anchors:**
- `.specify/features/006-ui-design-system/spec.md` v0.5 §5.4 (PDF requirements), §8.5 (E6.5 ACs)
- `.specify/features/006-ui-design-system/impl-plan.md` §1.1 (Letterhead architecture)
- `.specify/features/006-ui-design-system/tasks.md` lines 591–601 (Task 5.2)
- `docs/engineering/changes/2026-05-31-E6.5-task-5.1-react-pdf-spike/HANDOFF.md` (findings #1, #3, #4)

---

## TL;DR — production Letterhead lands; the font-pipeline blocker from Task 5.1 is resolved.

The Letterhead component renders correctly to PDF with full brand fidelity:

- **Wordmark** — inline outlined `<Path>` data from `docs/brand/final/wordmark/wordmark-master.svg` (primary "LSL Calculator" mark + gold accent rule via `<Line>`). No font dependency for the wordmark itself.
- **Tagline** — live PDF text "by Australian Payroll Association" in Source Sans 3 Regular. Mirrors the web `Lockup.tsx` accessibility contract (screen readers + PDF text extraction surface the tagline correctly).
- **Report title** — Montserrat SemiBold 16pt navy, right-column.
- **Generated-at timestamp** — Source Sans 3 Regular 10pt, ISO 8601 input → `"31 May 2026, 3:42 pm AEST"` output, deterministic in `Australia/Sydney`.
- **Optional org line** — `"for: <organisationName>"` when provided; cleanly hidden when not.
- **2pt navy underline** anchors the band from body content.

**CRITICAL fix landed:** unsubset TTFs in `website/public/fonts/pdf/` (Montserrat-SemiBold, SourceSans3-Regular, SourceSans3-Semibold) replace the woff2-based registration that crashed fontkit in the Task 5.1 spike. The brand fonts now embed cleanly into every PDF the pipeline produces.

See `letterhead-sample.pdf` + `letterhead-sample-page1-1.png` in this folder for a rendered artefact.

---

## Acceptance criteria — verdict (tasks.md 593–596)

| AC | Verdict | Evidence |
|---|---|---|
| Letterhead renders sub-brand wordmark + APA lockup | PASS | `letterhead-sample.pdf` — visible wordmark with outlined glyphs + gold rule + "by Australian Payroll Association" tagline. Rasterised page-1 PNG attached. |
| Report title + timestamp + optional org name visible | PASS | All three appear in the right column; `pdftotext -layout` extracts: `LSL liability valuation 2026-Q2 / Generated 31 May 2026, 3:42 pm AEST / for: Acme Pty Ltd`. |
| Snapshot test pins the layout | PASS | `src/lib/pdf/__tests__/Letterhead.test.ts` — 10 assertions covering font embedding gate, font dictionary subtype, size band (8–80 KB), optional org line, MediaBox, plus 4 timezone-determinism tests for `formatGeneratedAt`. |

---

## Critical gate verification — Task 5.1 spike finding #1 RESOLVED

The Task 5.1 spike documented (HANDOFF.md finding #1) that woff2 files in `public/fonts/` cannot be re-subset by fontkit:

```
RangeError: Offset is outside the bounds of the DataView
  at DataView.prototype.setUint16
  at TTFSubset._addGlyph
  at EmbeddedFont.embed
```

**Verification this PR resolves it:**

1. **Unsubset TTFs shipped** to `website/public/fonts/pdf/`:
   - `Montserrat-SemiBold.ttf` — 444 KB — Julieta Ula's Montserrat upstream (https://github.com/JulietaUla/Montserrat, SIL OFL 1.1).
   - `SourceSans3-Regular.ttf` — 421 KB — Adobe `source-sans` `release` branch (https://github.com/adobe-fonts/source-sans, SIL OFL 1.1).
   - `SourceSans3-Semibold.ttf` — 416 KB — same source.
   - All three pass `file *.ttf` validation as TrueType binaries.

2. **Standalone fontkit probe** (run + deleted before commit): `Font.register({ family, fonts: [{ src: pathTo('Montserrat-SemiBold.ttf'), fontWeight: 600 }] })` → renders 25.2 KB PDF with PostScript subset prefixes (`XQGTNS+Montserrat-SemiBold`, `NNAVKV+SourceSans3-Regular`, `HAYDAD+SourceSans3-Semibold`). No fontkit crash.

3. **Letterhead test gate** (`renders to a valid PDF without throwing`) — exercises the same code path as the production pipeline; passes.

4. **Production sample PDF** (`letterhead-sample.pdf`, 16.9 KB) — renders the Montserrat SemiBold report title + Source Sans 3 Regular tagline/timestamp/org-line cleanly with full glyph fidelity.

The Task 5.3 (MethodologyFooter) and 5.4 (PageNumber + A4Page) work can now proceed against the same font-pipeline foundation without further font-feasibility risk.

---

## Findings carried into Task 5.3 / 5.4

### Finding A (PATTERN — adopt verbatim): module-load font registration is idempotent

`src/lib/pdf/fonts.ts` exposes `registerPdfFonts()` and is called once at module load by `Letterhead.tsx`. `@react-pdf/font` deduplicates by `(family, weight, style, src)`, so subsequent imports from `MethodologyFooter.tsx`, `A4Page.tsx`, or any template do not re-register. Task 5.3 should `import { registerPdfFonts } from './fonts'` and call it from the top of its file the same way Letterhead does.

### Finding B (PATTERN — adopt verbatim): bare absolute filesystem paths via `process.cwd()`

`fonts.ts` resolves font paths as `path.resolve(process.cwd(), 'public', 'fonts', 'pdf', name)`. Per Task 5.1 spike finding #3, this skips the `file://` URL branch of `@react-pdf/font`'s loader (which throws "not implemented... yet..." on Node's undici fetch). `process.cwd()` is the `website/` directory in every context this code runs: `npm run dev`, `npm run build`, vitest, and the Vercel serverless function runtime (`/var/task/`).

### Finding C (DEFERRED to Task 5.3): Source Sans 3 Semibold is registered but unused in Letterhead

`fonts.ts` registers `SourceSans3-Semibold.ttf` (weight 600), but `Letterhead.tsx` does not exercise it. As a result, the PDF font dictionary contains a `Montserrat-SemiBold` subset and a `SourceSans3-Regular` subset, but no `SourceSans3-Semibold` subset (fontkit only embeds what is referenced). This is correct behaviour — the snapshot test asserts on the two subsets actually used, not on registration state.

Task 5.3 (CitationBlock) and Task 5.4 (PageNumber) will exercise the Semibold weight for citation section labels and page-number emphasis. The Letterhead test will need NO change when that happens; the new MethodologyFooter / CitationBlock tests will add their own Semibold-subset assertions.

### Finding D (audit-bundle update): `/fonts/pdf/` is now a SERVER_ONLY_PATHS guard

`scripts/audit-bundle.mjs` was extended with a `SERVER_ONLY_PATHS` needle category — currently `['/fonts/pdf/']`. The grep runs against every text artefact under `.next/static/*`, so if a future `'use client'` module accidentally references `/fonts/pdf/SourceSans3-Regular.ttf`, CI catches it. Today's build passes cleanly (bundle-chunks total: 1809.6 KB, unchanged from main).

---

## Files in this PR

- **`website/public/fonts/pdf/Montserrat-SemiBold.ttf`** (NEW, 444 KB, SIL OFL 1.1)
- **`website/public/fonts/pdf/SourceSans3-Regular.ttf`** (NEW, 421 KB, SIL OFL 1.1)
- **`website/public/fonts/pdf/SourceSans3-Semibold.ttf`** (NEW, 416 KB, SIL OFL 1.1)
- **`website/public/fonts/pdf/README.md`** (NEW) — licence + provenance + maintenance procedure.
- **`website/src/lib/pdf/fonts.ts`** (NEW) — central `registerPdfFonts()` helper; idempotent.
- **`website/src/lib/pdf/Letterhead.tsx`** (NEW) — production Letterhead component + `formatGeneratedAt` helper.
- **`website/src/lib/pdf/__tests__/Letterhead.test.ts`** (NEW) — 10 vitest tests covering structural PDF assertions + timezone determinism.
- **`website/scripts/audit-bundle.mjs`** — extended with `SERVER_ONLY_PATHS = ['/fonts/pdf/']` to guard against client-bundle leakage.
- **`docs/engineering/changes/2026-05-31-E6.5-task-5.2-letterhead/HANDOFF.md`** — this document.
- **`docs/engineering/changes/2026-05-31-E6.5-task-5.2-letterhead/letterhead-sample.pdf`** — rendered Letterhead with all four bands (title / timestamp / org / wordmark + tagline).
- **`docs/engineering/changes/2026-05-31-E6.5-task-5.2-letterhead/letterhead-sample-page1-1.png`** — rasterised preview at 150 dpi for inline PR review.

**Not touched** (parallel sessions / shipped epics / spike sentinel):
- `website/scripts/e6-pdf-spike.tsx` — spike sentinel preserved as a regression check. Production patterns were re-implemented from the spike, not extracted.
- `website/src/components/brand/{Wordmark,Lockup}.tsx` — web brand components, unchanged. The PDF Letterhead inlines its own wordmark path data + renders its own live tagline; no shared component code.
- `website/public/fonts/*.woff2` — browser font assets, untouched.
- All of `src/lib/lsl/`, `src/lib/tenant-context*`, `src/lib/auth/*`, `src/app/(calculator)/*`, `src/app/app/*`, `src/proxy.ts`, `.specify/features/005-*`, `website/supabase/*`, `website/src/lib/data/employee/*`.

---

## Dependency state

- No new direct or transitive dependency added.
- `@react-pdf/renderer@^4.5.1` — unchanged from PR #129 (Task 5.1 spike).
- `pdf-parse` was considered for snapshot test text extraction; rejected — the byte-stream + font-name + subtype assertions in `Letterhead.test.ts` cover the same structural guarantees without a new devDep.

---

## Design decisions

### 1. Wordmark provenance — inline outlined `<Path>` data, not a runtime SVG fetch

The `<Path d="…" />` constant in `Letterhead.tsx` is transcribed verbatim from `docs/brand/final/wordmark/wordmark-master.svg` (primary mark path, `fill="#48608a"`). Per PR #62 (Task 2.5.1), the wordmark glyphs were outlined to `<path>` data so the SVG has no external font dependency — and that property is exactly what makes the data safe to inline into a PDF without registering Montserrat for the wordmark itself.

The viewBox is cropped to `0 0 1000 210` (the master is `0 0 1000 360`, including the secondary "by Australian Payroll Association" path region at y≈246–270). The cropped region captures the primary mark + the gold accent rule at y=205. The tagline path data is NOT inlined — the tagline is rendered as live `<Text>` in Source Sans 3 Regular instead. This matches the accessibility pattern used by the web `Lockup.tsx` component (`src/components/brand/Lockup.tsx` line 122–123) and ensures screen readers + PDF text extraction surface the tagline as text, not as a graphic.

### 2. Timestamp format — deterministic `Australia/Sydney`

`formatGeneratedAt(iso: string): string` uses `Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', ... })` and replaces the locale-default ` at ` separator with `, ` for the dispatched format `"31 May 2026, 3:42 pm AEST"`. The function is exported from `Letterhead.tsx` so Task 5.3's MethodologyFooter can reuse it for the "Data as at …" date in the full-variant footer.

Tests pin three cases:
1. UTC ISO → AEST in May (no DST).
2. Same instant via `+10:00` offset string → identical output.
3. UTC ISO in January → AEDT (DST active).
Plus a `RangeError` on unparseable input.

### 3. Organisation-name fallback — explicit `!== undefined && length > 0`

The conditional renders the `"for: …"` line only when `organisationName` is a non-empty string. Empty strings and `undefined` both suppress the line. This matches spec §5.4's "where applicable" wording and mirrors the route-handler contract (Task 5.5): anonymous public-calc runs do not pass `organisationName`; B2B authenticated runs do.

### 4. Type contract — local `ReportLetterheadContext` interface

The `ReportLetterheadContext` interface is defined locally in `Letterhead.tsx` and exported. When Task 5.3's `MethodologyFooter` lands, the shared fields (`reportTitle`, `generatedAtIso`) plus the MethodologyFooter-specific fields (`calcMethodologyVersion`, `stateEngineVersion`, `dataAsAtIso`) will merge into a wider `ReportContext` in a new `src/lib/pdf/types.ts`. Until then, defining the contract on the component that consumes it keeps Letterhead self-contained for testing.

---

## Local gate state

- `npx tsc --noEmit` — clean (zero output).
- `npx eslint src/lib/pdf/Letterhead.tsx src/lib/pdf/fonts.ts src/lib/pdf/__tests__/Letterhead.test.ts scripts/audit-bundle.mjs` — clean (zero errors, zero warnings).
- `npm run test` — **3036 passed | 32 skipped** (baseline 3026 + 10 new Letterhead tests; skipped count unchanged).
- `npm run build` — succeeds.
- `audit-bundle` PASS — no third-party origins, no dev-only imports, no SVG `@import` leaks, **no `/fonts/pdf/` references in client chunks**. Bundle-chunks total 1809.6 KB (unchanged from main).

Playwright not run for this PR — Task 5.2 ships server-only PDF library code (no browser surface). Playwright re-runs when Task 5.5 wires the API route handler.

---

## Recommended next steps (for the orchestrator)

1. **Dispatch QA.** This PR opens + local gates clean. QA validation per `qa-best-practices`:
   - Open `letterhead-sample.pdf` in Preview — verify all four bands render with correct typography + the 2pt navy underline + gold accent rule under the wordmark.
   - Run `pdftotext -layout docs/engineering/changes/2026-05-31-E6.5-task-5.2-letterhead/letterhead-sample.pdf -` — confirm the four text fields extract cleanly (wordmark is silent — it's vector).
   - Run `cd website && npm run test src/lib/pdf/__tests__/Letterhead.test.ts` — 10/10 pass.
   - Verify `grep -r '/fonts/pdf/' website/.next/static/ 2>/dev/null` returns empty after `npm run build` (audit-bundle's `SERVER_ONLY_PATHS` guard is doing its job).
2. **Task 5.3 (MethodologyFooter) onward.** Patterns to promote verbatim:
   - `import { registerPdfFonts } from './fonts'; registerPdfFonts();` at module top.
   - `import { formatGeneratedAt } from './Letterhead';` for the data-as-at date in the full footer variant.
   - Single `<Page>` + `<View fixed>` + `render={({ pageNumber }) => …}` for the OQ-10 per-page split (Task 5.1 finding #4).
3. **PR cadence** is 1-PR-per-task. Do NOT continue to Task 5.3 in this dispatch.

---

## Out of scope / explicit non-goals

- No MethodologyFooter, PageNumber, or A4Page primitives — those are Tasks 5.3 / 5.4.
- No route handler (`POST /api/reports/:family`) — that's Task 5.5.
- No template families (single-employee / bulk-summary / liability / reconciliation) — those are Tasks 5.6 / 5.7 + E5.5 / E5.6.
- No print stylesheet (`@media print`) — separate AC under §8.5; not load-bearing for the Letterhead component.
- No italic font ships — citation `note` italic-styling decision is deferred to Task 5.3 per Task 5.1 finding #2.
- No PDF/UA tagging — explicitly out of v1 scope per spec §5.5.
