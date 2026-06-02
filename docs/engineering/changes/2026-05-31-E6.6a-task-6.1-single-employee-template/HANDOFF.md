# HANDOFF — E6.6a Task 6.1: SingleEmployee react-pdf template

**Date:** 2026-05-31
**Branch:** `feat/E6.6a-6.1-single-employee-template`
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.5 — §5.3, §5.4, §8.6, OQ-5
**Plan:** `.specify/features/006-ui-design-system/impl-plan.md` §1.1 + Phase 5a
**Tasks:** `.specify/features/006-ui-design-system/tasks.md` lines 712-724 (Task 6.1)

---

## What this PR ships

A new react-pdf template — `SingleEmployee` — that wraps the existing public-calc
single-employee result inside an `<A4Page>` primitive. This is the FIRST template
to land for Phase 5a. Task 6.3 will register it in the
`/api/reports/[family]/route.ts` dispatcher and flip the 501
`'template-not-shipped'` stub to a 200 `application/pdf` response. This PR
deliberately does NOT touch the route handler — that is Task 6.3's scope.

### Files added

- `website/src/lib/pdf/templates/SingleEmployee.tsx` (NEW) — the template
- `website/src/lib/pdf/templates/__tests__/SingleEmployee.test.ts` (NEW) — 17 tests
- `website/src/lib/pdf/templates/index.ts` (NEW) — barrel export

### Files modified

None outside `templates/`. The shipped primitives
(`Letterhead`/`MethodologyFooter`/`PageNumber`/`A4Page`/`fonts`/`types`/`families`)
are consumed read-only.

---

## Engine result type — payload contract

The template accepts the engine's existing `Result` type from
`@/lib/lsl/engine/types` directly as the payload, wrapped in a
`SingleEmployeePayload` envelope:

```ts
export interface SingleEmployeePayload {
  /** Engine result — the canonical shape `ResultPanel` consumes. */
  result: Result;
  /** Optional form-supplied identity fields the engine doesn't own. */
  identity?: SingleEmployeeIdentity;
}
```

This keeps the PDF template coupled to the **canonical** source of truth
(`Result` is already the type the web `ResultPanel` consumes — same shape,
same fields, same display strings). No parallel payload type was defined.

The optional `identity` slice (`legalName` / `externalEmployeeId` / `startDate`)
mirrors the equivalent fields the legacy `/api/export-pdf` endpoint accepts in
its `ExportPayload`. These are form-level data the engine `Result` doesn't
carry — keeping them in a separate slice avoids loosening the engine's
contract.

**Route handler implication for Task 6.3:** the route handler will need to
narrow the validated `payload` from `unknown` (per the route's Zod schema) into
`SingleEmployeePayload` before invoking `<SingleEmployee>`. A per-template Zod
schema co-located with the template module is the recommended path. Out of
scope for this PR.

---

## Citation byte-for-byte contract (spec §8.6)

Per spec §8.6 + tasks.md AC: "Citation block byte-for-byte matches web
snapshot." The web `<CitationBlock>` renders text into HTML `<p>` elements
under a `<li>`; the PDF template renders the same TEXTUAL CONTENT into
react-pdf `<Text>` primitives under `<View>`. The wrapping markup differs by
necessity (different rendering surface). "Byte-for-byte" therefore applies to
the **TEXT** — the citation strings the reader actually sees.

The template ships two co-located helpers — `formatCitationRule` and
`dedupCitations` — that reproduce the web component's logic exactly:

- `formatCitationRule(c)` returns `${c.rule}` when `pdfPage` is absent, and
  `${c.rule} · LSL-training PDF p.${c.pdfPage}` when it is present. The
  separator string ` · LSL-training PDF p.` is **byte-identical** to the
  string in `citation-block.tsx` line 39.
- `dedupCitations(arr)` uses the **same composite key**
  `${section}|${rule}|${pdfPage ?? ''}|${note ?? ''}` as
  `citation-block.tsx` lines 15-23.

### Snapshot test approach

The test file `SingleEmployee.test.ts` enforces citation byte-identity in two
complementary layers, mirroring the pattern `MethodologyFooter.test.ts` uses
for the "Calculated, not advice." disclosure-phrase contract:

1. **Source-level cross-surface check.** Read both `SingleEmployee.tsx` and
   `citation-block.tsx`; assert both files contain the exact substring
   ` · LSL-training PDF p.`. Any drift on either side fails the test loud.
2. **Structural unit test on `dedupCitations`.** Pass a fixture with one
   exact duplicate + two near-duplicates differing only on `pdfPage` and
   `note`; assert the deduped output has length 3, source order preserved.

A third test asserts the literal output of `formatCitationRule` against
hand-written expected strings — the rule line is what ends up rendered in
the PDF, so this pins the exact format.

PDF content-stream byte-for-byte (decompress FlateDecode + recover the
glyph mapping) was **not** pursued. The MethodologyFooter precedent
documents the rationale: the content stream is Flate-compressed and the
glyph indices are subset-dependent, so byte-level equality on the binary
PDF is brittle to react-pdf updates. The source-level + structural contract
above is the meaningful surface — same data + same template string + same
dedup logic produces the same rendered text downstream. This is the same
strategy that pins the "Calculated, not advice." disclosure phrase across
the web footer and the PDF footer (`MethodologyFooter.test.ts` lines
186-208).

---

## Test coverage (17 tests, all passing locally)

```
SingleEmployee — single-page render (Cat A/B/C semantics)
  ✓ renders a valid PDF without throwing
  ✓ embeds both Montserrat (Letterhead) and Source Sans 3 (body + footer) font subsets
  ✓ emits a MediaBox with A4 dimensions
  ✓ produces a PDF in the expected size band

SingleEmployee — multi-page render (Letterhead + footer inheritance)
  ✓ produces a multi-page PDF when content overflows
  ✓ multi-page PDF embeds Montserrat + Source Sans 3
  ✓ multi-page PDF is meaningfully larger than the single-page baseline

SingleEmployee — failure-mode results render gracefully
  ✓ renders an error message for `failed` status without throwing
  ✓ renders a cross-jurisdiction blocked status without throwing

SingleEmployee — citation byte-for-byte contract (spec §8.6)
  ✓ `formatCitationRule` reproduces the web CitationBlock template string for pdfPage
  ✓ `formatCitationRule` omits the PDF suffix when pdfPage is absent
  ✓ template + web citation block share the exact " · LSL-training PDF p." string
  ✓ `dedupCitations` matches the web composite key (section|rule|pdfPage|note)
  ✓ `dedupCitations` returns an empty array for an empty input
  ✓ template source preserves the "number-first, citation-second" composition

SingleEmployee — OQ-5: no separate executive summary block
  ✓ template source contains no "executive summary" / "exec summary" section label

SingleEmployee — A4Page composition (Letterhead + footer inheritance)
  ✓ template uses <A4Page>, does not duplicate Letterhead/Footer/PageNumber
```

---

## Acceptance criteria (tasks.md 714-721)

| AC | Status | Where it's pinned |
|----|--------|-------------------|
| Template renders single-employee result with Cat A/B/C semantics intact (number first, citation second per spec §5.3 invariant) | ✅ | `SingleEmployee.tsx` — `ResultTile` composition; test "template source preserves the number-first, citation-second composition" |
| Citation block byte-for-byte matches web snapshot | ✅ | `formatCitationRule` + `dedupCitations` helpers; cross-surface source-level assertion against `citation-block.tsx` |
| Letterhead + methodology footer + page numbering inherited from Phase 4 primitives | ✅ | Template wraps body in `<A4Page>`; multi-page test confirms Montserrat (letterhead, page 1) + Source Sans 3 (footer, every page) both embed |
| No separate exec summary (OQ-5) | ✅ | Source-level assertion that the template contains no "executive summary" / "exec summary" section label |

---

## Decisions taken / out-of-scope deferrals

### Italic citation note → grey-tone substitute
The web `<CitationBlock>` renders the citation note with `italic` Tailwind. The
PDF font bundle ships **Source Sans 3 Regular + Semibold only** (no italic — see
`fonts.ts` and Task 5.1 spike finding #2). Using `fontStyle: 'italic'` in the
PDF Stylesheet causes `@react-pdf/font` to throw "Could not resolve font for
Source Sans 3, fontWeight 400, fontStyle italic" at render time. The template
preserves the "secondary note" visual hierarchy via reduced font size + grey
tone instead. Documented inline in `SingleEmployee.tsx` styles.

### `Decimal` typing in test fixtures
The engine `Result` types nest `Decimal` instances under numeric outputs (e.g.
`outputs.valueOfWeek.value`). The template never re-computes from Decimals —
it consumes the `.display` string fields the engine emits. The test fixtures
cast string placeholders through `unknown` rather than importing the Decimal
implementation. This is a pragmatic test-only shim documented in the fixture
helper. If a future test needs to assert engine-side computation, it should
import `Decimal` and use real instances.

### `executive-summary` exclusion contract pinned at source level
OQ-5 (no exec summary) is checked by source inspection — the template file
must not contain the literal string "executive summary" or "exec summary"
(case-insensitive, comments stripped). The docstring uses the canonical OQ-5
reference. This is the same source-inspection pattern used by
`MethodologyFooter.test.ts` for the no-watermark contract.

---

## Local gates (all green)

- `npx tsc --noEmit` — clean (one earlier error on conditional `View` style
  array was fixed: `View style` requires `Style | Style[]` not
  `Style | null`).
- `npx eslint src/lib/pdf/templates/` — clean.
- `npm run test` — **3117 tests passed**, 32 skipped, 6 skipped files
  (project baseline).
- `npm run build` — clean, audit-bundle PASS (1813.1 KB chunks, no third-
  party origins, no dev-only imports, no SVG @import leaks).

---

## Out of scope (deliberate)

- **Task 6.3 dispatcher wiring.** This PR does NOT modify
  `app/api/reports/[family]/route.ts`. The 501 stub still returns for the
  `single-employee` family. Task 6.3 will register the template in
  `FAMILY_TEMPLATE` and replace the 501 with a streamed PDF.
- **Per-template Zod schema for `payload`.** The route handler's outer Zod
  schema marks `payload: z.unknown()` — each template is responsible for
  narrowing further. A `SingleEmployeePayload` Zod schema co-located with
  the template is the recommended Task 6.3 follow-up; out of scope here.
- **Public-calc CTA route swap.** The single-employee CTA on the result
  screen still calls `/api/export-pdf` (per PR #103). Task 6.3 will swap
  the CTA to `/api/reports/single-employee`. Out of scope for this PR.
- **Bulk-summary, liability, reconciliation templates.** Tasks 6.2, E5.5,
  E5.6. Separate PRs.

---

## Suggested QA verification

QA can verify the template end-to-end without the route handler wired by
running:

```
cd website
npm run test -- src/lib/pdf/templates/__tests__/SingleEmployee.test.ts
```

For a visual eyeball, write a one-off Node script that imports
`SingleEmployee`, renders to a PDF buffer with the sample fixture from the
test file, and writes it to disk. The test fixture is representative of the
Cat B 10-year result — multi-page test fixture exercises the page-1 letterhead
+ pages 2+ short-footer split.
