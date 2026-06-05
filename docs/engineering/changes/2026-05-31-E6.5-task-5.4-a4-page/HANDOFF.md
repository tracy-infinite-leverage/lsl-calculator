# Task 5.4 — PageNumber + A4Page primitives — HANDOFF

**Date**: 2026-05-31
**Branch**: `feat/E6.5-5.4-a4-page`
**Spec**: `.specify/features/006-ui-design-system/spec.md` v0.5 — §5.4, §8.5, OQ-10
**Task**: `.specify/features/006-ui-design-system/tasks.md` lines 644-655 (Task 5.4)
**Predecessors**: Task 5.1 spike (PR #129) · Task 5.2 Letterhead (PR #130) · Task 5.3 MethodologyFooter (PR #132)

---

## What shipped

Two new files under `website/src/lib/pdf/`:

1. **`PageNumber.tsx`** — wraps the react-pdf `<Text render={({ pageNumber, totalPages }) => ...}/>` pattern as a reusable primitive. Source Sans 3 Regular 8pt, brand-grey, no `fixed` (parent band owns positioning). Exports a `defaultPageNumberFormat` helper + optional `format` prop for future i18n.

2. **`A4Page.tsx`** — A4 page wrapper that composes:
   - **Letterhead** (page 1 only) — rendered INLINE in document flow at the top of `<Page>` so react-pdf's natural pagination places it on page 1 only without repeating it on pages 2+.
   - **Body content** (`children`) — normal flow, auto-paginated by react-pdf.
   - **Footer band** — a single `<View fixed>` containing two cells:
     - Left: `<View render={({ pageNumber }) => <MethodologyFooter variant={pageNumber === 1 ? 'full' : 'short'}/>}/>` — the load-bearing finding #4 pattern. Same fixed band, different content per page.
     - Right: `<PageNumber />` — counter, "Page X of Y".

Plus two new test files:

- `website/src/lib/pdf/__tests__/PageNumber.test.ts` — 8 tests, default-formatter + custom-formatter + render-prop contract.
- `website/src/lib/pdf/__tests__/A4Page.test.ts` — 10 tests, single-page + 3-page snapshot + slot-composition source-level invariants.

---

## Slot composition decisions

### Letterhead — inline flow (NOT fixed render-prop)

The dispatch suggested `<View fixed render={({ pageNumber }) => pageNumber === 1 ? <Letterhead/> : null}/>`. I tried that pattern first and ran a standalone render with ~70 KB of body text. The 5-page output had Source Sans 3 embedded but Montserrat was **missing** from the embedded font table — the Letterhead's report title (Montserrat) had not actually been rendered.

I switched to the spike's actual pattern from `scripts/e6-pdf-spike.tsx` line 423-424: place the Letterhead **inline** as the first child of `<Page>`. React-pdf's natural pagination renders the letterhead at the top of page 1 in document flow, then continues body content onto pages 2+ without it (because the letterhead is not `fixed`). Subsequent verify render showed both fonts embedded correctly.

This is what `spike-output.pdf` actually validated end-to-end. The dispatch's "render-prop everywhere" reading of finding #4 over-generalises — the spike PROVES finding #4 for the FOOTER only. The Letterhead is in document flow.

### Footer — fixed render-prop (finding #4)

The footer uses the canonical Task 5.1 spike finding #4 pattern:

```tsx
<View fixed style={styles.footerBand}>
  <View style={styles.footerLeft}>
    <View render={({ pageNumber }) => (
      <MethodologyFooter variant={pageNumber === 1 ? 'full' : 'short'} ... />
    )} />
  </View>
  <View style={styles.footerRight}>
    <PageNumber />
  </View>
</View>
```

The outer `<View fixed>` repeats on every page; the inner `<View render={...}>` swaps content per page; `<PageNumber />` uses its own internal render-prop for the counter.

### A4 margins

Taken from the spike's validated values:

| Margin | Value | Rationale |
|---|---|---|
| `paddingTop` | 24pt | Letterhead band carries its own marginBottom; tight top padding lets the band sit at a natural top-of-page position |
| `paddingBottom` | 60pt | Reserves space for the fixed footer band (~50pt high in full variant + 10pt safe area) |
| `paddingHorizontal` | 32pt | Leaves 531pt content width — comfortable for 11pt body |
| Footer band offsets | bottom 18pt, left/right 32pt | Aligns footer band horizontally with body content; 18pt bottom margin from page edge |

These match the spike's `styles.page` block (lines 124-132 of `scripts/e6-pdf-spike.tsx`). The APA Brand Guide does not pin numeric pt margins for PDF; the spike's validated values are the de facto standard.

---

## Verification

- TypeScript: `npx tsc --noEmit` — clean.
- Tests: `npm run test` — 3066 pass, 32 skipped, 0 fail.
- Build: `npm run build` — clean; `audit-bundle` PASS.
- ESLint: `npx eslint src/lib/pdf/` — clean.
- Standalone verify render: 4 A4 pages, 31 KB, both Montserrat-SemiBold + SourceSans3-Regular embedded as subsets. Inspected manually.

---

## Files touched

| Path | Change |
|---|---|
| `website/src/lib/pdf/PageNumber.tsx` | NEW |
| `website/src/lib/pdf/A4Page.tsx` | NEW |
| `website/src/lib/pdf/__tests__/PageNumber.test.ts` | NEW |
| `website/src/lib/pdf/__tests__/A4Page.test.ts` | NEW |
| `docs/engineering/changes/2026-05-31-E6.5-task-5.4-a4-page/HANDOFF.md` | NEW (this file) |

Untouched (per dispatch MUST-NOT-touch scope): all Letterhead, MethodologyFooter, fonts, types, e6-pdf-spike, app routes, engine code, E5 specs.

---

## Open questions

None for Task 5.4. The next task (5.5 — POST `/api/reports/:family` endpoint) consumes `<A4Page>` directly. The slot composition contract is now locked by source-level + PDF-level tests; any future regression in finding #4 will surface immediately.
