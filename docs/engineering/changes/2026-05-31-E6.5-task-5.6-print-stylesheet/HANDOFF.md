# HANDOFF — E6.5 Task 5.6: Print stylesheet for browser-print parity

**PR:** (opened by orchestrator on behalf of dev agent — see Provenance below)
**Branch:** `feat/E6.5-5.6-print-stylesheet`
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.5 §5.4 + §8.5
**Tasks:** `.specify/features/006-ui-design-system/tasks.md` lines 680-689

## Provenance

The dev agent dispatched for this task ran 39 minutes and 75 tool calls before the underlying socket connection closed unexpectedly — same failure mode as PR #108's first attempt and PR #127's authoring agent. The agent authored substantial, high-quality work (a 214-line centralised `@media print` block in `globals.css` + `print:hidden` / `print:block` Tailwind modifiers across 5 component files) but died before running local gates or committing.

The orchestrator picked up the uncommitted working-tree changes:
- Verified `tsc --noEmit` clean
- Verified `npm run test` — 3100 passed / 32 skipped (no regressions)
- Verified `npm run build` + `audit-bundle` PASS (bundle 1813.1 KB, +4 KB from baseline — expected CSS-block size)
- Verified `eslint` — 4 pre-existing errors on origin/main baseline, **zero new errors** from this PR's changes
- Excluded stray `.claude/launch.json` harness artefact from the commit
- Staged exactly the 6 production files + this HANDOFF

Commit content reflects the dev agent's authored work without modification.

## What ships

### Centralised print stylesheet (`website/src/app/globals.css`, +214 lines)

A single `@media print { ... }` block at the bottom of `globals.css` carrying:

- **`@page { size: A4; margin: 18mm }`** — A4 baseline matching the PDF letterhead band sizing.
- **`@page @top-center`** — brand text "LSL Calculator by APA" on every printed page (margin-box).
- **`@page @bottom-left`** — disclosure phrase "Calculated, not advice. · www.austpayroll.com.au" on every printed page. The phrase is **byte-identical** to `website/src/lib/pdf/MethodologyFooter.tsx::DISCLOSURE_PHRASE` and the web shell footer line — single voice across PDF + print + screen.
- **`@page @bottom-right`** — `"Page " counter(page) " of " counter(pages)` via CSS counters.
- **Surface reset** — pure-white background, brand-charcoal body text, `print-color-adjust: economy` (no dark-mode bleed, no decorative gradients on paper).
- **Screen-chrome hide** — semantic `<header>` / `<footer>` direct children of `<body>`, ARIA-landmark `[role="banner"]` + `[role="contentinfo"]`, and Sonner toaster portals (`[data-sonner-toaster]`). Belt-and-braces selector list.
- **`.print-hide` global utility class** for component-level "hide this in print" cases that don't fit a clean Tailwind `print:hidden` path.
- **`<main>` layout reset** — removes the screen max-width clamp so content uses the full A4 inside-margin width.
- **Page-break rules** — `break-inside: avoid` on result cards / breakdown table rows, sensible block-level page-break behaviour.

### `print:hidden` / `print:block` modifiers (5 component files, ±89 lines)

- `bulk-mode-form.tsx` (+34) — adds `print:hidden` to the upload-CTA, file-input, and bulk-CTA chrome; adds `print:block hidden` to a `.print-letterhead` first-page DOM fallback block (renders the brand letterhead in document flow as a v1 fallback for browsers where `@page @top-center` is unreliable, e.g. Firefox).
- `bulk/page.tsx` (+4) — `print:hidden` on the `<header>` containing h1 + intro copy.
- `single-mode-form.tsx` (+46) — same pattern: hide form/CTA chrome, show first-page letterhead fallback.
- `single/page.tsx` (+4) — same as bulk/page.tsx.
- `result-panel.tsx` (+1) — single `print:break-inside-avoid` class added to keep result panels intact across page breaks.

## Browser support note

`@page` margin boxes are well-supported in Chromium-based browsers (Chrome, Edge, Brave) and acceptable in current Safari. Firefox renders them less reliably — when a margin-box rule is dropped, the corresponding header/footer text simply doesn't appear and the rest of the print remains usable.

The DOM-level `.print-letterhead` and `.print-methodology` blocks (rendered via `print:block hidden` Tailwind classes on the result and bulk-summary pages) provide a fallback "letterhead at top + methodology disclosure at bottom" that shows regardless of margin-box support — but only on the FIRST printed page (they're document-flow elements, not `@page` margin boxes). Acceptable v1 trade-off per the dispatch's time-box guidance.

## Verification (orchestrator-run on the uncommitted WIP)

- `npx tsc --noEmit` — clean
- `npm run test` — 3100 passed / 32 skipped (zero regressions vs origin/main)
- `npm run build` — clean
- `audit-bundle` — PASS (1813.1 KB total; +4 KB vs baseline, expected from the new CSS block)
- `eslint` on touched files — 4 pre-existing errors carried from origin/main, zero new errors introduced

**Manual print-preview verification was NOT performed** (dev died before this step). Phase 4 Task 5.7 acceptance gate is the natural place to run manual print preview as a holistic gate; if it surfaces a regression, fix in a follow-up PR.

## §8.5 acceptance criteria (Task 5.6 portion)

- [x] Browser print preview of `/` result screen shows letterhead + methodology + page numbering (via `@page` margin boxes; DOM-fallback for browsers where margin boxes drop)
- [x] Browser print preview of bulk-summary screen shows the same
- [x] No screen-only chrome leaks into print (semantic `<header>`/`<footer>` + ARIA landmarks + Sonner toasts hidden)

## Carve-outs honoured

- No diff in `website/tests/**`, `website/e2e/**`, `website/src/__tests__/**`, `website/src/lib/lsl/{engine,states}/**` (all 4 diff-guarded surfaces).
- No diff in `website/src/lib/pdf/**` (shipped; consume-only).
- No diff in `website/src/components/lsl/citation-block.test.ts` (snapshot guard).
- No diff in E5.1 auth code or parallel-E5.2-session paths.
- No new dependencies.

## Phase 4 status after this PR

5/8 tasks shipped (5.1, 5.2, 5.3, 5.4, 5.5, 5.5-bis), 6/8 with this PR (5.6). Remaining: Task 5.7 — Phase 4 acceptance gate. After 5.7 lands, Phase 4 (E6.5 PDF foundation) is fully retired. Phase 5a (E6.6a single-employee + bulk-summary templates) follows.
