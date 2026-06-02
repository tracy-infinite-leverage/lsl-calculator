/**
 * BulkSummary.tsx — react-pdf template for the bulk-employee LSL summary.
 *
 * E6.6a Task 6.2 (spec §5.4, §8.6, OQ-5; impl-plan §1.1 + Phase 5a).
 *
 * Wraps the existing public-calc bulk-summary multi-employee table inside an
 * `<A4Page>` primitive (Task 5.4). The second template to land — Task 6.3 will
 * register it alongside SingleEmployee in the `/api/reports/[family]` dispatcher
 * and flip the bulk-summary 501 "template-not-shipped" stub to a 200
 * application/pdf response.
 *
 * ----------------------------------------------------------------------------
 * Composition (top-to-bottom)
 * ----------------------------------------------------------------------------
 *
 *   <A4Page>                       ← Letterhead (page 1 only) + Methodology
 *                                    footer (page 1 full / pages 2+ short) +
 *                                    PageNumber on every page (inherited)
 *     ┌──────────────────────────┐
 *     │ Summary banner (counts)  │   ← computed / blocked / failed counts +
 *     │                          │     total entitlement aggregate
 *     ├──────────────────────────┤
 *     │ ┌──────┬──────┬──────┐   │   ← table header — `<View fixed>` so it
 *     │ │ Emp  │ Cat. │ ...  │   │     repeats at the top of EVERY page when
 *     │ ├──────┼──────┼──────┤   │     rows overflow. The wrapping <View>
 *     │ │ row1 │  B   │  $X  │   │     for each row carries `wrap={false}`
 *     │ │ row2 │  B   │  $Y  │   │     so a row never half-breaks across the
 *     │ │ ...  │ ...  │ ...  │   │     page edge.
 *     │ └──────┴──────┴──────┘   │
 *     └──────────────────────────┘
 *   </A4Page>
 *
 * Per OQ-5: NO separate executive summary block — the bulk-summary report's
 * banner row (counts + aggregate $) IS its at-a-glance. The CFO at-a-glance
 * lives in the E5.5 liability report (3-column) and the E5.6 reconciliation
 * report (single headline number) — see spec §8.6.
 *
 * ----------------------------------------------------------------------------
 * Multi-page table-header repetition (the load-bearing technical contract)
 * ----------------------------------------------------------------------------
 *
 * react-pdf does NOT auto-repeat table headers across pages. Two viable
 * approaches; we use the FIRST per the dispatch brief:
 *
 *   1. **Render-prop / `<View fixed>` for the header**. Put the header in a
 *      `<View fixed>` at the top of the body content. react-pdf re-renders
 *      the `fixed` band on every page, so the header repeats automatically
 *      when the row list overflows. The row list itself flows below and
 *      breaks naturally row-by-row when each row carries `wrap={false}`.
 *      This mirrors the OQ-10 footer pattern Task 5.4 established —
 *      `<View fixed>` for "per-page chrome that repeats".
 *
 *   2. Manually split rows into page-sized batches and emit multiple
 *      `<Page>` elements. Brittle (row heights are not knowable in
 *      advance), and breaks the `<A4Page>` composition contract from
 *      Task 5.1 spike finding #4 (single `<Page>` per template). Rejected.
 *
 * Approach 1 has one subtlety: the `<View fixed>` header sits at the top of
 * the body content, INSIDE the page-padding-top region. This means on page 1
 * the header sits BELOW the Letterhead band (which is in document flow at
 * the top of page 1 only — see A4Page.tsx). On pages 2+ the Letterhead is
 * absent, so the header rendered by the `<View fixed>` sits at the top of
 * the content area. The visual effect is the desired one: header always
 * at the top of every page's table content.
 *
 * The snapshot test (`__tests__/BulkSummary.test.ts`) asserts this with a
 * 50-row fixture: page count ≥ 2 AND the header text appears at least
 * twice in the PDF object stream.
 *
 * ----------------------------------------------------------------------------
 * Why `wrap={false}` on each row (not `break-inside: avoid` CSS)
 * ----------------------------------------------------------------------------
 *
 * react-pdf's pagination model is opinionated: a `<View>` with `wrap={false}`
 * forces the layout engine to push the entire view onto the next page when
 * it does not fit on the current page. This is the canonical way to prevent
 * mid-row breaks in a table — there is no CSS `break-inside` equivalent that
 * crosses the react-pdf renderer.
 *
 * ----------------------------------------------------------------------------
 * Payload shape — consumes engine `Result[]` directly
 * ----------------------------------------------------------------------------
 *
 * Accepts an array of engine `Result` objects (from `@/lib/lsl/engine/types`)
 * as the payload — the same shape the public-calc bulk-mode-form supplies
 * via `stage.results`. Optional `namesById` map carries the form-supplied
 * `legalName` lookup (the engine `Result` does NOT carry the name —
 * `bulk-mode-form.tsx` keeps it in `parsed[].legalName` and projects it via
 * `namesById` for the on-screen `BulkResultsTable`; we mirror that pattern
 * here).
 *
 * Optional `summary` slice carries the aggregate counts shown in the
 * banner. Both are optional so the route handler can pass only what's
 * known — the template degrades gracefully when fields are absent.
 *
 * Per spec §5.7 (PII discipline): the payload may carry employee
 * identifiers via `namesById` — the template renders them when supplied
 * but never persists them. The whole payload lives in the route function's
 * memory for the duration of the render only.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer';
import * as React from 'react';
import { colors } from '../../design-tokens';
import { A4Page } from '../A4Page';
import type { ReportContext } from '../types';
import type { Result } from '@/lib/lsl/engine/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Optional summary aggregates the public-calc bulk runner produces. Mirrors
 * the `summary` shape on the `done` stage in `bulk-mode-form.tsx`:
 *
 *   { computed: number; blocked: number; failed: number; elapsedMs: number }
 *
 * Rendered in the banner row. Absent → banner omits the counts strip.
 */
export interface BulkSummaryAggregates {
  computed: number;
  blocked: number;
  failed: number;
  /** Optional — surfaced in the banner only when > 0. */
  elapsedMs?: number;
}

/**
 * Payload for the bulk-summary template. The engine `Result[]` is the row
 * data; the optional `namesById` map carries form-supplied legal names; the
 * optional `summary` slice carries the banner aggregates.
 */
export interface BulkSummaryPayload {
  /** Engine results — one entry per employee processed. */
  results: Result[];
  /**
   * Optional employee-id → legal name lookup. Mirrors the `namesById`
   * surface used by the on-screen `BulkResultsTable`.
   */
  namesById?: Record<string, string | undefined>;
  /** Optional aggregate counts surfaced in the banner. */
  summary?: BulkSummaryAggregates;
}

/**
 * Props for the `<BulkSummary>` template. Standard `ReportContext` (letter-
 * head + methodology fields) plus the `BulkSummaryPayload` above.
 */
export interface BulkSummaryProps {
  /** Per-report context — letterhead + methodology fields. */
  context: ReportContext;
  /** Bulk results + optional names + optional summary aggregates. */
  payload: BulkSummaryPayload;
}

// ---------------------------------------------------------------------------
// Column model
// ---------------------------------------------------------------------------

/**
 * Table column layout. Widths are flex weights — the table fills the
 * available content width (A4 595pt minus A4Page horizontal padding 32pt × 2
 * = 531pt usable). The flex weights below approximate the on-screen
 * `BulkResultsTable` proportions while collapsing the chevron / action /
 * filter columns (not meaningful in a paper PDF).
 *
 * Print column order mirrors the canonical web table:
 *   Employee ID · Name · Status · Category · Years · Weeks · $ entitlement
 *
 * The on-screen table also has "expand" and "action" cells — both are pure
 * interaction affordances with no PDF analogue. Per OQ-5 the report shows
 * the row data only.
 */
interface ColumnDef {
  /** Stable id — also the rendered header text. */
  header: string;
  /** Flex weight — sets the column's share of the row width. */
  flex: number;
  /** Optional right-alignment for numeric columns. */
  align?: 'right';
  /** Pull the cell value out of a Result. Returns a renderable string. */
  cell: (
    result: Result,
    namesById?: Record<string, string | undefined>,
  ) => string;
}

const COLUMNS: ColumnDef[] = [
  {
    header: 'Employee ID',
    flex: 1.4,
    cell: (r) => r.employeeId,
  },
  {
    header: 'Name',
    flex: 1.8,
    cell: (r, namesById) => namesById?.[r.employeeId] ?? '—',
  },
  {
    header: 'Status',
    flex: 1.0,
    cell: (r) => formatStatus(r.status),
  },
  {
    header: 'Cat.',
    flex: 0.5,
    cell: (r) => r.category ?? '—',
  },
  {
    header: 'Years',
    flex: 0.7,
    align: 'right',
    cell: (r) =>
      r.diagnostics?.yearsOfContinuousService
        ? Number(r.diagnostics.yearsOfContinuousService.toFixed(2)).toFixed(2)
        : '—',
  },
  {
    header: 'Weeks',
    flex: 0.8,
    align: 'right',
    cell: (r) => r.outputs?.totalEntitlement.weeks.display ?? '—',
  },
  {
    header: '$ Entitlement',
    flex: 1.2,
    align: 'right',
    cell: (r) =>
      r.outputs ? `$${r.outputs.totalEntitlement.dollars.display}` : '—',
  },
];

/**
 * Format a `Result['status']` for human display in the PDF cell. Mirrors
 * the on-screen badge text from `BulkResultsTable.StatusBadge`:
 *   - 'computed'                  → "computed"
 *   - 'blocked_cross_jurisdiction'→ "blocked"
 *   - 'failed'                    → "failed"
 *
 * Kept colour-free in the PDF — colour-coded badges don't survive grayscale
 * print runs without contrast loss, so we render the status string in plain
 * body type. Auditors filter by the string verbatim.
 */
function formatStatus(status: Result['status']): string {
  switch (status) {
    case 'computed':
      return 'computed';
    case 'blocked_cross_jurisdiction':
      return 'blocked';
    case 'failed':
      return 'failed';
    default: {
      // Defensive — future status kinds. Render verbatim if it ever lands.
      const fallback = status as string;
      return fallback;
    }
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * BulkSummary template styles. All values in PDF points.
 *
 * Visual ramp mirrors the web `BulkResultsTable`:
 *   - Section labels: 11pt SemiBold, brand-navy (matches `sectionTitle`
 *     pattern from SingleEmployee).
 *   - Banner: 9pt Regular, brand-charcoal — chips rendered inline.
 *   - Table header cells: 9pt SemiBold uppercase, brand-grey background tint.
 *     The bold + slightly lighter background mirrors the on-screen
 *     `bg-muted/50` thead.
 *   - Table body cells: 9pt Regular, brand-charcoal. Mono-spaced for the
 *     numeric columns to keep digits aligned (matches the web `tabular-nums`
 *     utility).
 *   - Row separator: 0.5pt brand-grey hairline beneath each row — matches
 *     `border-t` on the web table.
 *
 * Density tuning: the body cell font is 9pt (rather than the SingleEmployee
 * body 10pt) because bulk-summary trades per-row breathing room for total
 * row capacity per page. A 50-row fixture should comfortably span 2 pages —
 * a 100-row fixture closer to 3. The print stylesheet (Task 5.6) uses an
 * equivalent compression.
 */
const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: colors['brand-navy'],
    marginTop: 12,
    marginBottom: 6,
  },
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  bannerChip: {
    fontSize: 9,
    color: colors['brand-charcoal'],
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: colors['brand-grey'],
  },
  /** Total-line callout below the chips — the aggregate $ figure if shown. */
  bannerTotal: {
    fontSize: 10,
    fontWeight: 600,
    color: colors['brand-navy'],
    marginTop: 4,
  },
  /**
   * Outer table container — provides a stable border around the whole
   * table block. The fixed header sits inside this container.
   */
  table: {
    borderWidth: 0.5,
    borderColor: colors['brand-grey'],
    borderRadius: 2,
  },
  /**
   * Table header — wrapped in `<View fixed>` at the top of the table so
   * the header repeats on every page that the table overflows onto. See
   * the file header comment for why `fixed` is the canonical pattern.
   */
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f3f7', // soft brand-grey tint; matches web bg-muted/50
    borderBottomWidth: 0.5,
    borderBottomColor: colors['brand-grey'],
  },
  headerCell: {
    fontSize: 9,
    fontWeight: 600,
    color: colors['brand-charcoal'],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  /** Body row — one per employee. `wrap={false}` set on the JSX. */
  bodyRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e7e9ee', // softer hairline between rows
  },
  bodyCell: {
    fontSize: 9,
    color: colors['brand-charcoal'],
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  bodyCellMono: {
    fontSize: 9,
    color: colors['brand-charcoal'],
    paddingVertical: 3,
    paddingHorizontal: 4,
    // Source Sans 3 doesn't ship a mono cut; render right-aligned + the
    // engine .display strings (already digit-stable) preserve column
    // alignment without a monospace face. See SingleEmployee's
    // `citationNote` doc-comment for the same Source Sans 3 italic
    // substitution rationale.
  },
  /**
   * Empty-state fallback — rendered when the results array is empty
   * (defensive; the public-calc UI cannot trigger this path today).
   */
  emptyLine: {
    fontSize: 10,
    color: colors['brand-grey'],
    fontStyle: 'normal', // explicit — no italic in the bundled font subset
    marginTop: 12,
  },
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Render the banner row — counts strip + optional aggregate total $.
 *
 * Computed inline from the results array when `summary` is absent (so the
 * banner is always meaningful even if the caller forgot to supply pre-
 * computed aggregates).
 */
function BulkBanner({
  results,
  summary,
}: {
  results: Result[];
  summary?: BulkSummaryAggregates;
}) {
  // Derive counts if not supplied. Same recount semantics as
  // `bulk-mode-form.tsx::recountSummary`.
  const counts = summary ?? recountStatuses(results);
  // Aggregate the total $ entitlement across computed rows. Engine
  // `display` strings are pre-formatted with commas (e.g. "10,830.00") —
  // strip non-numeric for the sum, then re-stringify with commas.
  const totalDollars = sumComputedEntitlement(results);
  return (
    <View>
      <View style={styles.banner}>
        <Text style={styles.bannerChip}>Employees: {results.length}</Text>
        <Text style={styles.bannerChip}>Computed: {counts.computed}</Text>
        {counts.blocked > 0 && (
          <Text style={styles.bannerChip}>Blocked: {counts.blocked}</Text>
        )}
        {counts.failed > 0 && (
          <Text style={styles.bannerChip}>Failed: {counts.failed}</Text>
        )}
      </View>
      {totalDollars !== null && (
        <Text style={styles.bannerTotal}>
          Total accrued entitlement (computed rows): ${formatDollarsWithCommas(totalDollars)}
        </Text>
      )}
    </View>
  );
}

/**
 * Re-derive `{ computed, blocked, failed }` counts from a `Result[]`.
 * Mirrors `bulk-mode-form.tsx::recountSummary` but without the elapsed-ms.
 */
function recountStatuses(results: Result[]): BulkSummaryAggregates {
  let computed = 0;
  let blocked = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === 'computed') computed++;
    else if (r.status === 'blocked_cross_jurisdiction') blocked++;
    else failed++;
  }
  return { computed, blocked, failed };
}

/**
 * Sum the total $ entitlement across `computed` rows. Returns null when no
 * computed rows exist.
 *
 * Decimal arithmetic note: each `result.outputs.totalEntitlement.dollars`
 * is a `NumericOutput` carrying a `value: Decimal` AND a pre-formatted
 * `display: string`. We sum the Decimal values via the `decimal.js` API
 * (the engine standard — see `engine/decimal.ts`) to avoid floating-point
 * drift. Number coercion would lose cents on >1000 rows.
 *
 * The `decimal.js` API surface used here: `.plus(other)` returns a new
 * Decimal; `.toFixed(2)` returns the 2dp string. The engine's wrapper
 * module re-exports `Decimal` as the canonical class.
 */
function sumComputedEntitlement(results: Result[]): string | null {
  // We type the accumulator structurally rather than importing the
  // `decimal.js` class — the template should not couple to the engine's
  // Decimal implementation directly. The engine guarantees the
  // `NumericOutput.value` carries `.plus()` + `.toFixed()` (both standard
  // `decimal.js` methods).
  interface DecimalLike {
    plus: (other: DecimalLike) => DecimalLike;
    toFixed: (n: number) => string;
  }
  let total: DecimalLike | null = null;
  for (const r of results) {
    if (r.status !== 'computed' || !r.outputs) continue;
    const v = r.outputs.totalEntitlement.dollars.value as unknown as DecimalLike;
    total = total === null ? v : total.plus(v);
  }
  if (total === null) return null;
  return total.toFixed(2);
}

/**
 * Format a 2-decimal dollar string with comma separators on the integer
 * part. Input is the `Decimal.toFixed(2)` output (e.g. `"123456.78"`);
 * output is `"123,456.78"`. Matches the engine `.display` formatting so
 * the banner total reads consistently with the per-row display strings.
 */
function formatDollarsWithCommas(fixed2: string): string {
  const [intPart, decPart] = fixed2.split('.');
  const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${intWithCommas}.${decPart}` : intWithCommas;
}

/**
 * Render one row of the table. `wrap={false}` so the row never half-breaks
 * across a page boundary.
 */
function BulkRow({
  result,
  namesById,
}: {
  result: Result;
  namesById?: Record<string, string | undefined>;
}) {
  return (
    <View style={styles.bodyRow} wrap={false}>
      {COLUMNS.map((col, i) => {
        const value = col.cell(result, namesById);
        return (
          <Text
            key={i}
            style={[
              col.align === 'right' ? styles.bodyCellMono : styles.bodyCell,
              { flex: col.flex, textAlign: col.align ?? 'left' },
            ]}
          >
            {value}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * Render the table header. Used in two places:
 *   - Wrapped in `<View fixed>` at the top of the table body — repeats on
 *     EVERY page when the row list overflows.
 *
 * Exposed as a sub-component so the test can assert the header rendering
 * surface independently if needed.
 */
function BulkHeaderRow() {
  return (
    <View style={styles.headerRow}>
      {COLUMNS.map((col, i) => (
        <Text
          key={i}
          style={[
            styles.headerCell,
            { flex: col.flex, textAlign: col.align ?? 'left' },
          ]}
        >
          {col.header}
        </Text>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * `<BulkSummary>` — the bulk-employee LSL summary PDF template.
 *
 * Composes a multi-employee `Result[]` into the body of an `<A4Page>`. The
 * page-1 Letterhead + every-page methodology footer + per-page PageNumber
 * are inherited from the `<A4Page>` primitive — this template renders ONLY
 * the body content.
 *
 * Per OQ-5: no separate executive summary. The banner row is the at-a-
 * glance; the table is the data.
 *
 * Multi-page contract: the table header is a `<View fixed>` so it repeats
 * on every page when row content overflows. See the file header comment
 * for the full pagination rationale.
 *
 * Usage (route handler — Task 6.3 will wire this):
 *
 *   const buffer = await renderToBuffer(
 *     <Document>
 *       <BulkSummary
 *         context={ctx}
 *         payload={{ results, namesById, summary }}
 *       />
 *     </Document>
 *   );
 */
export function BulkSummary({ context, payload }: BulkSummaryProps) {
  const { results, namesById, summary } = payload;

  // Empty-state fallback. The public-calc UI cannot trigger this path
  // (a successful parse always yields ≥ 1 employee). Defensive: render a
  // graceful empty message rather than a blank table.
  if (results.length === 0) {
    return (
      <A4Page context={context}>
        <Text style={styles.sectionTitle}>Bulk LSL summary</Text>
        <Text style={styles.emptyLine}>
          No employees were processed in this bulk run.
        </Text>
      </A4Page>
    );
  }

  return (
    <A4Page context={context}>
      {/* Banner — counts strip + aggregate $ */}
      <Text style={styles.sectionTitle}>Bulk LSL summary</Text>
      <BulkBanner results={results} summary={summary} />

      {/*
        Table — fixed header repeats on every page; rows flow with
        `wrap={false}` so they never half-break across page boundaries.

        The OUTER `<View>` carries the table border + radius. The INNER
        `<View fixed>` is the header — react-pdf re-renders fixed views
        on every page, which is what gives us "header on every page"
        behaviour for free. The row list flows below.
      */}
      <View style={styles.table}>
        <View fixed>
          <BulkHeaderRow />
        </View>
        {results.map((r, i) => (
          <BulkRow key={r.employeeId ?? i} result={r} namesById={namesById} />
        ))}
      </View>
    </A4Page>
  );
}

// ---------------------------------------------------------------------------
// Helpers exposed for testing
// ---------------------------------------------------------------------------

/**
 * Test-surface re-exports — let the snapshot test assert sub-component
 * behaviour without rendering the full template.
 */
export { COLUMNS as __columns, recountStatuses as __recountStatuses, sumComputedEntitlement as __sumComputedEntitlement, formatDollarsWithCommas as __formatDollarsWithCommas, formatStatus as __formatStatus };
