import type { ComponentType, ReactNode } from 'react';
import { NextRequest, NextResponse } from 'next/server';
import {
  renderToBuffer,
  Document as _Document,
  Page as _Page,
  Text as _Text,
  View as _View,
  StyleSheet,
} from '@react-pdf/renderer';

// @react-pdf/renderer ships React-18-era component types that aren't directly assignable
// to React 19's JSX type. Re-type as plain ComponentType to satisfy the React-19 type-checker.
type AnyProps = Record<string, unknown> & { children?: ReactNode; style?: unknown; fixed?: boolean };
const Document = _Document as unknown as ComponentType<AnyProps>;
const Page = _Page as unknown as ComponentType<AnyProps & { size?: string }>;
const Text = _Text as unknown as ComponentType<AnyProps>;
const View = _View as unknown as ComponentType<AnyProps>;

export const runtime = 'nodejs';

interface Citation {
  section: string;
  rule: string;
  pdfPage?: number;
}

interface ExportPayload {
  legalName: string | null;
  externalEmployeeId: string | null;
  startDate: string;
  trigger: {
    kind: 'taking_leave' | 'termination' | 'as_at';
    leaveStartDate?: string;
    terminationDate?: string;
    reason?: string;
    asAtDate?: string;
  };
  category: 'A' | 'B' | 'C' | null;
  outputs: {
    valueOfWeek: string;
    valueOfDay: string;
    totalEntitlementWeeks: string;
    totalEntitlementDollars: string;
    systemFormula?: {
      display: string;
      varianceDisplay: string;
      varianceSign: 'over' | 'under' | 'equal';
    };
  };
  warnings: { code: string; message: string }[];
  diagnostics: {
    yearsOfContinuousService: string;
    daysOfContinuousService: number;
    weeklyAvg12mo: string;
    weeklyAvg5yr: string;
    serviceStartUsed: string;
  } | null;
  citations: {
    valueOfWeek: Citation[];
    valueOfDay: Citation[];
    weeks: Citation[];
    dollars: Citation[];
  };
}

export async function POST(req: NextRequest) {
  let body: ExportPayload;
  try {
    body = (await req.json()) as ExportPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const buffer = await renderToBuffer(<LSLReportDocument payload={body} />);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="lsl-report.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[/api/export-pdf]', err);
    const msg = err instanceof Error ? err.message : 'PDF render failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#111827' },
  h1: { fontSize: 18, fontWeight: 'bold', color: '#1d4ed8', marginBottom: 4 },
  subhead: { fontSize: 8, color: '#6b7280', marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
    textDecoration: 'underline',
  },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 140, color: '#6b7280' },
  value: { flex: 1, color: '#111827' },
  tile: {
    border: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
    backgroundColor: '#f9fafb',
  },
  tileLabel: {
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tileValue: { fontSize: 14, fontWeight: 'bold', color: '#1d4ed8', marginTop: 2 },
  citation: {
    paddingLeft: 8,
    borderLeft: 1,
    borderColor: '#bfdbfe',
    marginBottom: 4,
  },
  citationSection: { fontWeight: 'bold', fontSize: 9 },
  citationRule: { fontSize: 8, color: '#6b7280', fontFamily: 'Courier' },
  warning: { color: '#a16207', fontSize: 9, marginBottom: 2 },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
  },
});

function LSLReportDocument({ payload }: { payload: ExportPayload }) {
  const allCitations = dedup([
    ...payload.citations.valueOfWeek,
    ...payload.citations.valueOfDay,
    ...payload.citations.weeks,
    ...payload.citations.dollars,
  ]);

  // Derive the governing jurisdiction from the citation section prefixes the
  // engine emitted — keeps the header truthful for NSW vs VIC without the
  // form/payload having to thread state through explicitly.
  const jurisdictionLine = deriveJurisdictionLine(allCitations);

  let triggerLine = `Kind: ${payload.trigger.kind}`;
  if (payload.trigger.kind === 'taking_leave' && payload.trigger.leaveStartDate) {
    triggerLine += ` · Leave start: ${payload.trigger.leaveStartDate}`;
  } else if (payload.trigger.kind === 'termination') {
    triggerLine += ` · Date: ${payload.trigger.terminationDate} · Reason: ${payload.trigger.reason}`;
  } else if (payload.trigger.kind === 'as_at' && payload.trigger.asAtDate) {
    triggerLine += ` · As-at: ${payload.trigger.asAtDate}`;
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Long Service Leave Report</Text>
        <Text style={styles.subhead}>
          Generated {new Date().toISOString().slice(0, 10)} — {jurisdictionLine}
        </Text>

        <Text style={styles.sectionTitle}>Employee</Text>
        {payload.legalName && (
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{payload.legalName}</Text>
          </View>
        )}
        {payload.externalEmployeeId && (
          <View style={styles.row}>
            <Text style={styles.label}>Employee ID</Text>
            <Text style={styles.value}>{payload.externalEmployeeId}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Start date</Text>
          <Text style={styles.value}>{payload.startDate}</Text>
        </View>
        {payload.category && (
          <View style={styles.row}>
            <Text style={styles.label}>Category</Text>
            <Text style={styles.value}>{payload.category}</Text>
          </View>
        )}
        {payload.diagnostics?.yearsOfContinuousService && (
          <View style={styles.row}>
            <Text style={styles.label}>Continuous service</Text>
            <Text style={styles.value}>
              {payload.diagnostics.yearsOfContinuousService} years (
              {payload.diagnostics.daysOfContinuousService} days)
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Trigger</Text>
        <Text>{triggerLine}</Text>

        <Text style={styles.sectionTitle}>Result</Text>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Value of a week</Text>
          <Text style={styles.tileValue}>${payload.outputs.valueOfWeek}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Value of a day</Text>
          <Text style={styles.tileValue}>${payload.outputs.valueOfDay}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Total entitlement</Text>
          <Text style={styles.tileValue}>
            ${payload.outputs.totalEntitlementDollars} ({payload.outputs.totalEntitlementWeeks}{' '}
            weeks)
          </Text>
        </View>

        {payload.outputs.systemFormula && (
          <Text style={{ fontSize: 9, marginTop: 4, color: '#374151' }}>
            System-formula comparison: ${payload.outputs.systemFormula.display} — variance $
            {payload.outputs.systemFormula.varianceDisplay} (
            {payload.outputs.systemFormula.varianceSign})
          </Text>
        )}

        {payload.warnings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Warnings</Text>
            {payload.warnings.map((w, i) => (
              <Text key={i} style={styles.warning}>
                • {w.message}
              </Text>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Citations</Text>
        {allCitations.map((c, i) => (
          <View key={i} style={styles.citation}>
            <Text style={styles.citationSection}>{c.section}</Text>
            <Text style={styles.citationRule}>
              {c.rule}
              {c.pdfPage ? ` · LSL-training PDF p.${c.pdfPage}` : ''}
            </Text>
          </View>
        ))}

        {payload.diagnostics && (
          <>
            <Text style={styles.sectionTitle}>Diagnostics</Text>
            <View style={styles.row}>
              <Text style={styles.label}>12-month avg weekly</Text>
              <Text style={styles.value}>${payload.diagnostics.weeklyAvg12mo}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>5-year avg weekly</Text>
              <Text style={styles.value}>${payload.diagnostics.weeklyAvg5yr}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Effective service start</Text>
              <Text style={styles.value}>{payload.diagnostics.serviceStartUsed}</Text>
            </View>
          </>
        )}

        <Text style={styles.footer} fixed>
          This report computes the legislated LSL value against the relevant state statute (see
          citations above). Not legal advice. Verify edge cases against the source statute.
        </Text>
      </Page>
    </Document>
  );
}

function dedup(cits: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of cits) {
    const key = `${c.section}|${c.rule}|${c.pdfPage ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Inspect the emitted citations to figure out which state's statute drove this
 * calculation, then return a human-readable header line for the report.
 *
 * The engine prefixes section labels with the state code (e.g. "NSW LSA s.4(5)(b)"
 * or "VIC LSL Act 2018 s.6"), so we can detect jurisdictions without threading
 * state through the PDF payload schema.
 */
function deriveJurisdictionLine(cits: Citation[]): string {
  const seen = new Set<string>();
  for (const c of cits) {
    if (c.section.startsWith('NSW')) seen.add('NSW');
    if (c.section.startsWith('VIC')) seen.add('VIC');
  }
  if (seen.size === 0) return 'Long Service Leave Act';
  const parts: string[] = [];
  if (seen.has('NSW')) parts.push('Long Service Leave Act 1955 (NSW)');
  if (seen.has('VIC')) parts.push('Long Service Leave Act 2018 (VIC)');
  return parts.join(' · ');
}
