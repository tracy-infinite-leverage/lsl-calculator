/**
 * SingleEmployee.tsx — react-pdf template for the single-employee LSL result.
 *
 * E6.5 Task 6.1 (spec §5.3, §5.4, §8.6, OQ-5; impl-plan §1.1 + Phase 5a).
 *
 * Wraps the existing public-calc single-employee result inside an `<A4Page>`
 * primitive (Task 5.4). The template is the FIRST template to land — Task 6.3
 * will register it in the `/api/reports/[family]` dispatcher and flip the
 * 501 "template-not-shipped" stub to a 200 application/pdf response.
 *
 * ----------------------------------------------------------------------------
 * Composition (top-to-bottom)
 * ----------------------------------------------------------------------------
 *
 *   <A4Page>                       ← Letterhead (page 1 only) + Methodology
 *                                    footer (page 1 full / pages 2+ short) +
 *                                    PageNumber on every page (inherited)
 *     ┌──────────────────────────┐
 *     │ Employee header strip    │   ← name / employee-id / start-date /
 *     │                          │     category / years-of-service. Mirrors
 *     │                          │     the data ResultPanel surfaces.
 *     ├──────────────────────────┤
 *     │ Trigger line             │   ← termination / taking-leave / as-at
 *     ├──────────────────────────┤
 *     │ Result tiles (3-up)      │   ← Value of a week + Value of a day +
 *     │                          │     Total entitlement. Number FIRST,
 *     │   ┌──────┬──────┬──────┐ │     citation block SECOND per spec §5.3
 *     │   │ Tile │ Tile │ Tile │ │     invariant.
 *     │   └──────┴──────┴──────┘ │
 *     ├──────────────────────────┤
 *     │ Warnings (if any)        │   ← each warning rendered as a line item
 *     ├──────────────────────────┤
 *     │ Diagnostics              │   ← 12-mo avg, 5-yr avg, service start
 *     └──────────────────────────┘
 *   </A4Page>
 *
 * Per OQ-5: NO separate executive summary block — the single-employee report
 * is already short enough that the body content above IS the executive summary.
 *
 * ----------------------------------------------------------------------------
 * Cat A/B/C semantics — number-first / citation-second (spec §5.3 invariant)
 * ----------------------------------------------------------------------------
 *
 * The web `ResultPanel.NumericTile` renders:
 *
 *   <p>{label}</p>                  ← uppercase caption
 *   <p>{value}</p>                  ← the legislated dollar number
 *   {sub && <p>{sub}</p>}           ← the secondary unit (e.g. "10.83 weeks")
 *   <CitationBlock citations={…}/>  ← citation list, source order = visual order
 *
 * The PDF template mirrors this with react-pdf `<Text>` / `<View>` primitives.
 * Number rendered FIRST (line order), citation block rendered IMMEDIATELY
 * below — the same "number → citation" visual hierarchy that the web upholds.
 *
 * ----------------------------------------------------------------------------
 * Citation byte-for-byte contract (spec §8.6 + Task 6.1 AC)
 * ----------------------------------------------------------------------------
 *
 * The web `<CitationBlock>` renders each citation as:
 *
 *   <li>
 *     <p class="font-semibold">{c.section}</p>
 *     <p class="font-mono">{c.rule}{c.pdfPage && ` · LSL-training PDF p.${c.pdfPage}`}</p>
 *     {c.note && <p class="italic">{c.note}</p>}
 *   </li>
 *
 * The PDF cannot share JSX with the web component (different primitives —
 * `<Text>` vs `<p>`), so byte-for-byte applies to the TEXTUAL CONTENT rendered
 * into the citation block. We render the SAME data with the SAME formatting:
 *
 *   - section string verbatim
 *   - rule string verbatim, with ` · LSL-training PDF p.${pdfPage}` appended
 *     when `pdfPage` is present (exact same template string as
 *     `citation-block.tsx` line 39)
 *   - note string verbatim when present
 *
 * Dedup logic matches `citation-block.tsx` (lines 15-23): same composite key
 * `${section}|${rule}|${pdfPage ?? ''}|${note ?? ''}`.
 *
 * The snapshot test in `__tests__/SingleEmployee.test.ts` asserts:
 *   1. Template renders to a valid PDF buffer (font-embedding gate).
 *   2. Multi-page output composes correctly (Letterhead + footer split).
 *   3. The dedup branch matches the web behaviour.
 *   4. SOURCE-level assertion that the citation formatting strings here
 *      match `citation-block.tsx` exactly (the cross-surface byte-identity
 *      check — same pattern as `MethodologyFooter.test.ts` for the
 *      "Calculated, not advice" disclosure phrase).
 *
 * ----------------------------------------------------------------------------
 * Payload shape — consumes the engine's `Result` type directly
 * ----------------------------------------------------------------------------
 *
 * Accepts the engine's `Result` type (from `@/lib/lsl/engine/types`) as the
 * payload — the same shape `ResultPanel` consumes. This keeps the template
 * coupled to the canonical source of truth without re-defining a parallel
 * payload type. The route handler (Task 6.3) is responsible for narrowing
 * the JSON body into a `Result` before invoking this template.
 *
 * Per spec §5.7 (PII discipline): the payload may carry employee identifiers
 * (`legalName`, `externalEmployeeId`) — the template renders them when
 * supplied by the caller but never persists them. The whole payload lives in
 * the route function's memory for the duration of the render only.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer';
import * as React from 'react';
import { colors } from '../../design-tokens';
import { A4Page } from '../A4Page';
import type { ReportContext } from '../types';
import type { Citation, Result } from '@/lib/lsl/engine/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Optional employee identity fields that the engine `Result` does NOT carry
 * but the public-calc form supplies. The template renders these in the
 * employee header strip when present.
 *
 * Why a separate identity slice rather than threading these through the engine
 * `Result`: the engine `Result` is purely computational (the legislated
 * answer). Identity (legal name, external employee ID, start date) is form-
 * level data the caller already has. Keeping them in a separate slice avoids
 * loosening the engine's `Result` contract.
 *
 * Mirrors the equivalent `legalName` + `externalEmployeeId` + `startDate`
 * fields the existing `/api/export-pdf` endpoint accepts in its `ExportPayload`
 * shape.
 */
export interface SingleEmployeeIdentity {
  /** Optional legal name — rendered as "Name: <legalName>" when present. */
  legalName?: string;
  /** Optional external employee ID — rendered when present. */
  externalEmployeeId?: string;
  /** ISO 8601 start date — rendered as "Start date: <yyyy-mm-dd>". */
  startDate?: string;
}

/**
 * Payload for the single-employee template. The engine `Result` carries the
 * computed numbers + citations + warnings + diagnostics; the optional
 * `identity` slice carries the form-supplied employee header fields the
 * engine doesn't own.
 */
export interface SingleEmployeePayload {
  /** Engine result — the canonical shape `ResultPanel` consumes. */
  result: Result;
  /** Optional employee identity fields supplied by the caller. */
  identity?: SingleEmployeeIdentity;
}

/**
 * Props for the `<SingleEmployee>` template. Consumes the standard
 * `ReportContext` (letterhead + methodology fields) plus the
 * `SingleEmployeePayload` above.
 */
export interface SingleEmployeeProps {
  /** Per-report context — letterhead + methodology fields. */
  context: ReportContext;
  /** Engine result + optional identity slice. */
  payload: SingleEmployeePayload;
}

// ---------------------------------------------------------------------------
// Styles — mirror the web ResultPanel + NumericTile + CitationBlock semantics
// ---------------------------------------------------------------------------

/**
 * SingleEmployee template styles. All values in PDF points.
 *
 * Visual ramp mirrors the web `ResultPanel`:
 *   - Section labels: 11pt SemiBold, brand-navy (matches web `sectionTitle`).
 *   - Body rows: 10pt Regular, brand-charcoal (matches web `row`/`label`).
 *   - Result tile values: 16pt SemiBold, brand-navy (the legislated number is
 *     the most prominent element on the page — matches web `tileValue`).
 *   - Result tile captions: 8pt Regular uppercase brand-grey (matches web
 *     `tileLabel`).
 *   - Citation rows: 9pt Regular for section, 8pt mono-style for rule.
 *
 * The left-border accent under each citation row is rendered as a 2pt-wide
 * navy-tint vertical strip (`borderLeft`) — the closest PDF equivalent of the
 * web's `border-l-2 border-primary/40` Tailwind utility.
 */
const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: colors['brand-navy'],
    marginTop: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  rowLabel: {
    width: 140,
    fontSize: 10,
    color: colors['brand-grey'],
  },
  rowValue: {
    flex: 1,
    fontSize: 10,
    color: colors['brand-charcoal'],
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tile: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: colors['brand-grey'],
    borderRadius: 4,
    padding: 8,
  },
  tileEmphasized: {
    borderColor: colors['brand-navy'],
    borderWidth: 1,
  },
  tileCaption: {
    fontSize: 8,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors['brand-grey'],
  },
  tileValue: {
    fontSize: 16,
    fontWeight: 600,
    color: colors['brand-navy'],
    marginTop: 4,
  },
  tileSub: {
    fontSize: 9,
    color: colors['brand-grey'],
    marginTop: 2,
  },
  /**
   * Citation list container — `<ol>` semantics in plain react-pdf primitives.
   * Source order = visual order (matches web).
   */
  citationList: {
    flexDirection: 'column',
    marginTop: 4,
  },
  citationItem: {
    borderLeftWidth: 1.5,
    borderLeftColor: colors['brand-navy'],
    paddingLeft: 6,
    marginTop: 4,
  },
  citationSection: {
    fontSize: 9,
    fontWeight: 600,
    color: colors['brand-charcoal'],
  },
  citationRule: {
    fontSize: 8,
    color: colors['brand-grey'],
    marginTop: 1,
  },
  /**
   * Citation note — visually softened via reduced size + grey tone (no
   * italic). The web `CitationBlock` renders the note in italic Tailwind
   * (`italic mt-0.5`) but the PDF font bundle ships Source Sans 3 Regular
   * + Semibold only (no italic — see `fonts.ts` and the Task 5.1 spike
   * finding #2 rationale). The grey tone + smaller size preserves the
   * "secondary note" visual hierarchy without requiring an italic subset.
   */
  citationNote: {
    fontSize: 8,
    color: colors['brand-grey'],
    marginTop: 1,
  },
  warningLine: {
    fontSize: 9,
    color: colors['brand-charcoal'],
    marginBottom: 3,
  },
  triggerLine: {
    fontSize: 10,
    color: colors['brand-charcoal'],
  },
  errorLine: {
    fontSize: 11,
    color: colors['brand-charcoal'],
    marginTop: 12,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the "rule" line text for a citation — replicates the EXACT template
 * string used by `citation-block.tsx` (line 39):
 *
 *   {c.rule}
 *   {c.pdfPage && <> · LSL-training PDF p.{c.pdfPage}</>}
 *
 * The web JSX renders `c.rule` followed by ` · LSL-training PDF p.{pdfPage}`
 * when `pdfPage` is truthy. This helper produces the same string for the
 * react-pdf `<Text>` primitive. The exact template string (` · LSL-training
 * PDF p.${page}`) is the byte-for-byte contract surface.
 *
 * Exported so the snapshot test can assert byte-identity against the web
 * component's source.
 */
export function formatCitationRule(citation: Citation): string {
  if (citation.pdfPage !== undefined && citation.pdfPage !== null) {
    return `${citation.rule} · LSL-training PDF p.${citation.pdfPage}`;
  }
  return citation.rule;
}

/**
 * Dedup citations using the SAME composite key as `citation-block.tsx`
 * (lines 15-23): `${section}|${rule}|${pdfPage ?? ''}|${note ?? ''}`.
 *
 * Preserves source order (first occurrence wins). Exposed so the snapshot
 * test can assert the dedup contract matches the web rendering.
 */
export function dedupCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of citations) {
    const key = `${c.section}|${c.rule}|${c.pdfPage ?? ''}|${c.note ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Trigger line — mirrors the public-calc `ResultPanel` upstream display.
 * Renders the trigger kind + the kind-specific timestamp fields.
 */
function formatTriggerLine(result: Result): string {
  const t = result.trigger;
  switch (t.kind) {
    case 'taking_leave': {
      const leaveWeeks =
        t.leaveWeeks !== undefined ? ` · Weeks: ${t.leaveWeeks}` : '';
      return `Taking leave · Leave start: ${t.leaveStartDate}${leaveWeeks}`;
    }
    case 'termination':
      return `Termination · Date: ${t.terminationDate} · Reason: ${t.reason}`;
    case 'as_at':
      return `As-at · Date: ${t.asAtDate}`;
    case 'cash_out':
      return `Cash-out · Date: ${t.cashOutDate}`;
    default: {
      // Defensive: future trigger kinds. The type system makes this
      // unreachable today, but render a stable fallback if it ever lands.
      const fallback = t as { kind: string };
      return `Trigger: ${fallback.kind}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Render a deduped citation list as a react-pdf `<View>` column. The visual
 * structure (left-border strip per item + section line + rule line +
 * optional italic note line) mirrors `citation-block.tsx`.
 */
function PdfCitationBlock({ citations }: { citations: Citation[] }) {
  const deduped = dedupCitations(citations);
  if (deduped.length === 0) return null;
  return (
    <View style={styles.citationList}>
      {deduped.map((c, i) => (
        <View key={i} style={styles.citationItem} wrap={false}>
          <Text style={styles.citationSection}>{c.section}</Text>
          <Text style={styles.citationRule}>{formatCitationRule(c)}</Text>
          {c.note && <Text style={styles.citationNote}>{c.note}</Text>}
        </View>
      ))}
    </View>
  );
}

/**
 * Render a single result tile (number first, citation second — spec §5.3
 * invariant). Mirrors `ResultPanel.NumericTile` from the web rendering.
 */
function ResultTile({
  label,
  value,
  sub,
  citations,
  emphasized,
}: {
  label: string;
  value: string;
  sub?: string;
  citations: Citation[];
  emphasized?: boolean;
}) {
  return (
    <View style={emphasized ? [styles.tile, styles.tileEmphasized] : styles.tile}>
      <Text style={styles.tileCaption}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {sub && <Text style={styles.tileSub}>{sub}</Text>}
      <PdfCitationBlock citations={citations} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * `<SingleEmployee>` — the single-employee LSL report PDF template.
 *
 * Composes the engine `Result` into the body of an `<A4Page>`. The page-1
 * Letterhead + every-page methodology footer + per-page PageNumber are
 * inherited from the `<A4Page>` primitive — this template renders ONLY the
 * body content.
 *
 * Per OQ-5: no separate executive summary. The body itself IS the report.
 *
 * Per spec §5.3 invariant: number FIRST, citation SECOND within each tile.
 *
 * Usage (route handler — Task 6.3 will wire this):
 *
 *   const buffer = await renderToBuffer(
 *     <Document>
 *       <SingleEmployee context={ctx} payload={{ result, identity }} />
 *     </Document>
 *   );
 */
export function SingleEmployee({ context, payload }: SingleEmployeeProps) {
  const { result, identity } = payload;

  // Failure-mode results render a single error message. The engine surfaces
  // `blocked_cross_jurisdiction` + `failed` statuses with a user-facing
  // message; mirror the web ResultPanel's branching for these paths.
  if (result.status === 'failed' || result.status === 'blocked_cross_jurisdiction') {
    const message =
      result.error?.userMessage ??
      result.warnings.find((w) => w.code === 'cross_jurisdiction_pending')
        ?.message ??
      'Calculation could not complete.';
    return (
      <A4Page context={context}>
        <Text style={styles.sectionTitle}>Result</Text>
        <Text style={styles.errorLine}>{message}</Text>
      </A4Page>
    );
  }

  const outputs = result.outputs;
  // Defensive — `outputs` is undefined on non-computed statuses. The branch
  // above catches `failed` + `blocked_cross_jurisdiction`; this guards the
  // theoretical case of a `computed` status with no outputs (shouldn't
  // happen by engine contract).
  if (!outputs) {
    return (
      <A4Page context={context}>
        <Text style={styles.sectionTitle}>Result</Text>
        <Text style={styles.errorLine}>
          No result outputs were produced for this calculation.
        </Text>
      </A4Page>
    );
  }

  const { valueOfWeek, valueOfDay, totalEntitlement } = outputs;
  const years = result.diagnostics?.yearsOfContinuousService;

  return (
    <A4Page context={context}>
      {/* Employee header strip */}
      <Text style={styles.sectionTitle}>Employee</Text>
      {identity?.legalName && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Name</Text>
          <Text style={styles.rowValue}>{identity.legalName}</Text>
        </View>
      )}
      {identity?.externalEmployeeId && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Employee ID</Text>
          <Text style={styles.rowValue}>{identity.externalEmployeeId}</Text>
        </View>
      )}
      {identity?.startDate && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Start date</Text>
          <Text style={styles.rowValue}>{identity.startDate}</Text>
        </View>
      )}
      {result.category && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Category</Text>
          <Text style={styles.rowValue}>{result.category}</Text>
        </View>
      )}
      {years !== undefined && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Continuous service</Text>
          <Text style={styles.rowValue}>
            {String(years)} years
            {result.diagnostics?.daysOfContinuousService !== undefined &&
              ` (${result.diagnostics.daysOfContinuousService} days)`}
          </Text>
        </View>
      )}

      {/* Trigger */}
      <Text style={styles.sectionTitle}>Trigger</Text>
      <Text style={styles.triggerLine}>{formatTriggerLine(result)}</Text>

      {/* Result tiles — number first, citation second (spec §5.3 invariant) */}
      <Text style={styles.sectionTitle}>Result</Text>
      <View style={styles.tilesRow}>
        <ResultTile
          label="Value of a week"
          value={`$${valueOfWeek.display}`}
          citations={valueOfWeek.citations}
        />
        <ResultTile
          label="Value of a day"
          value={`$${valueOfDay.display}`}
          citations={valueOfDay.citations}
        />
        <ResultTile
          label="Total entitlement"
          value={`$${totalEntitlement.dollars.display}`}
          sub={`${totalEntitlement.weeks.display} weeks`}
          citations={[
            ...totalEntitlement.weeks.citations,
            ...totalEntitlement.dollars.citations,
          ]}
          emphasized
        />
      </View>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Advisories</Text>
          {result.warnings.map((w, i) => (
            <Text key={i} style={styles.warningLine}>
              • {w.message}
            </Text>
          ))}
        </View>
      )}

      {/* Diagnostics — operator/auditor reference */}
      {result.diagnostics && (
        <View>
          <Text style={styles.sectionTitle}>Diagnostics</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>12-month avg weekly</Text>
            <Text style={styles.rowValue}>
              ${String(result.diagnostics.weeklyAvg12mo)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>5-year avg weekly</Text>
            <Text style={styles.rowValue}>
              ${String(result.diagnostics.weeklyAvg5yr)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Effective service start</Text>
            <Text style={styles.rowValue}>
              {result.diagnostics.serviceStartUsed}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Days of continuous service</Text>
            <Text style={styles.rowValue}>
              {result.diagnostics.daysOfContinuousService}
            </Text>
          </View>
        </View>
      )}
    </A4Page>
  );
}
