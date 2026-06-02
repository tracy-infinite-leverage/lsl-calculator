/**
 * POST /api/reports/[family] — serverless PDF rendering endpoint.
 *
 * E6.5 Task 5.5 (spec §5.3 + §5.4 + §5.7, impl-plan §1.3 — resolves G-1).
 *
 * ----------------------------------------------------------------------------
 * Auth-posture split (LOAD-BEARING — OQ-6 / G-1)
 * ----------------------------------------------------------------------------
 *
 * The four report families have DIFFERENT auth postures:
 *
 *   | Family            | Posture          | Source                                |
 *   |-------------------|------------------|---------------------------------------|
 *   | single-employee   | public           | Spec §5.3 / OQ-6 — public-calc CTA    |
 *   | bulk-summary      | public           | Spec §5.3 / OQ-6 — same public CTA    |
 *   | liability         | authenticated    | Tenant-scoped under /app/liability    |
 *   | reconciliation    | authenticated    | Tenant-scoped under /app/reconciliation|
 *
 * The handler MUST branch on the family BEFORE invoking any auth check.
 * Public families NEVER touch Supabase or read session cookies. This
 * decouples Phase 5a (public-calc PDF) from E5.1's merge to `main` and is
 * the contract Task 5.5-bis (separate PR) locks in with an e2e regression test.
 *
 * ----------------------------------------------------------------------------
 * Status codes
 * ----------------------------------------------------------------------------
 *
 *   200  application/pdf            — successful render (Phase 5a/5b)
 *   400  { error: 'unsupported-family' }     — `family` URL segment unknown
 *   400  { error: 'invalid-payload' }        — Zod validation failed
 *   401  { error: 'unauthorized' }           — authenticated family, no session
 *   501  { error: 'template-not-shipped' }   — recognised family, no template wired yet
 *   500  { error: 'render-failure', requestId } — internal render error
 *
 * TODAY (Task 5.5 only): all four families return 501 because Phase 5a/5b
 * templates have not landed. The `'template-not-shipped'` shape is
 * intentional — it lets the contract test (Task 5.5-bis) assert posture
 * BEFORE templates exist, by checking the status code without requiring a
 * valid PDF response. Public families return 501 with no auth touched.
 * Authenticated families return 401 first (when no session) or 501 (when
 * authed but no template) — both proves auth gating is wired.
 *
 * Tasks 6.1 / 6.2 will replace the 501 with a streamed `application/pdf`
 * for the public families. Tasks E5.5 / E5.6 will replace the 501 with a
 * streamed PDF for the authenticated families.
 *
 * ----------------------------------------------------------------------------
 * PII / tenant-data discipline (spec §5.7)
 * ----------------------------------------------------------------------------
 *
 * No PII or tenant data leaves the Vercel function for any family. The
 * payload is rendered to a PDF buffer in-process and streamed back to the
 * caller. No external service call. The audit-log hook below logs ONLY
 * request metadata (family, request ID, posture, timestamp) — never the
 * payload contents. The full audit trail lands in E5.4's table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import * as React from 'react';
import { Document, renderToBuffer } from '@react-pdf/renderer';
import Decimal from 'decimal.js';
import {
  FAMILY_POSTURE,
  isKnownFamily,
  type ReportFamily,
} from '@/lib/pdf/families';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  BulkSummary,
  SingleEmployee,
  type BulkSummaryPayload,
  type SingleEmployeePayload,
} from '@/lib/pdf/templates';
import type { Result } from '@/lib/lsl/engine/types';

// react-pdf is a Node-only renderer (uses Buffer, fs for fonts). The endpoint
// MUST run on the Node runtime — Edge would break font registration and the
// PDF document tree construction.
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

/**
 * Zod schema for the request body.
 *
 * `context` is validated structurally to match `ReportContext` (from
 * `@/lib/pdf/types`). The schema is intentionally a SUPERSET-compatible
 * shape — fields are required where templates require them; optional where
 * they are optional in the type.
 *
 * `payload` is `unknown` at this layer. Each family-specific template (Tasks
 * 6.1 / 6.2 / E5.5 / E5.6) is responsible for narrowing the payload with its
 * own Zod schema before rendering. Doing the per-family narrowing inside the
 * template — not here — keeps this route handler decoupled from individual
 * template shapes.
 */
const reportRequestSchema = z.object({
  context: z.object({
    // Letterhead fields (from ReportLetterheadContext)
    reportTitle: z.string().min(1, 'reportTitle is required'),
    generatedAtIso: z
      .string()
      .min(1, 'generatedAtIso is required (ISO 8601)'),
    organisationName: z.string().optional(),
    // Methodology footer fields (from MethodologyFooterFields)
    calcMethodologyVersion: z
      .string()
      .min(1, 'calcMethodologyVersion is required'),
    stateEngineVersion: z.string().min(1, 'stateEngineVersion is required'),
    dataAsAtIso: z.string().min(1, 'dataAsAtIso is required (ISO 8601)'),
    // APA contact (from ApaContact)
    apaContact: z.object({
      email: z.string().min(1, 'apaContact.email is required'),
      url: z.string().min(1, 'apaContact.url is required'),
    }),
  }),
  // Family-specific payload — each template narrows further.
  payload: z.unknown(),
});

// ---------------------------------------------------------------------------
// Audit / operational logging
// ---------------------------------------------------------------------------

/**
 * Structured log line for an endpoint invocation. Carries metadata ONLY —
 * never payload contents (spec §5.7). The actual audit trail (per spec
 * §5.7) lands in E5.4's audit-log table. This logger emits to stdout so the
 * line is captured by Vercel function logs for operational visibility.
 *
 * Why a wrapper instead of inline `console.info`: lets us add a test seam
 * (see route.test.ts — the mock asserts the metadata shape) without
 * coupling tests to the exact `console` call pattern.
 */
function logReportRequest(payload: {
  event: 'report-requested' | 'report-rendered' | 'report-failed';
  family: string;
  requestId: string;
  posture: 'public' | 'authenticated' | 'unknown';
  outcome: 'ok' | 'unauthorized' | 'template-not-shipped' | 'invalid-payload' | 'unsupported-family' | 'render-failure';
}): void {
  // Operational log line for Vercel function logs. PAYLOAD CONTENTS ARE
  // NEVER LOGGED (spec §5.7) — only the request metadata above.
  console.info('[api/reports]', JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * POST /api/reports/[family]
 *
 * Dispatches `{ context, payload }` to the appropriate report template based
 * on the `family` URL segment. Branches on auth posture FIRST (line below
 * marked CRITICAL) so public families never reach the Supabase server-client.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ family: string }> },
): Promise<Response> {
  const requestId = randomUUID();

  // 1. Resolve the family URL segment (Next.js 16 async params).
  const { family: rawFamily } = await ctx.params;

  // 2. Validate the family BEFORE any auth check. Unknown families fail
  //    fast with 400 — they never reach the posture branch, so no
  //    Supabase access is incurred for bogus requests.
  if (!isKnownFamily(rawFamily)) {
    logReportRequest({
      event: 'report-failed',
      family: rawFamily,
      requestId,
      posture: 'unknown',
      outcome: 'unsupported-family',
    });
    return NextResponse.json(
      { error: 'unsupported-family' },
      { status: 400 },
    );
  }

  const family: ReportFamily = rawFamily;
  const posture = FAMILY_POSTURE[family];

  // 3. ── CRITICAL: branch on posture BEFORE touching Supabase ────────────
  //    Public families MUST NOT call createSupabaseServerClient() or read
  //    cookies. This is the load-bearing OQ-6 contract — see file header.
  if (posture === 'authenticated') {
    // Construct the Supabase server client lazily so the public path never
    // touches the @supabase/ssr cookie API. The helper is async (Next.js 16
    // cookies() is async — see lib/supabase/server.ts).
    let user: { id: string } | null = null;
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      user = data.user ? { id: data.user.id } : null;
    } catch (err) {
      // Supabase env-var misconfig or transient outage. Log + 500 — DO NOT
      // silently fall through to a public render path; that would leak the
      // authenticated family to anonymous users.
      console.error('[api/reports]', requestId, 'supabase auth lookup failed', err);
      logReportRequest({
        event: 'report-failed',
        family,
        requestId,
        posture,
        outcome: 'render-failure',
      });
      return NextResponse.json(
        { error: 'render-failure', requestId },
        { status: 500 },
      );
    }

    if (!user) {
      logReportRequest({
        event: 'report-failed',
        family,
        requestId,
        posture,
        outcome: 'unauthorized',
      });
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 },
      );
    }
    // Authenticated user — continue to template dispatch.
  }
  // Public families fall straight through here without touching Supabase.

  // 4. Parse + validate the JSON body. We do this AFTER the auth check
  //    so authenticated families don't waste cycles parsing bodies for
  //    requests that would 401 anyway.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logReportRequest({
      event: 'report-failed',
      family,
      requestId,
      posture,
      outcome: 'invalid-payload',
    });
    return NextResponse.json(
      { error: 'invalid-payload' },
      { status: 400 },
    );
  }

  const parseResult = reportRequestSchema.safeParse(body);
  if (!parseResult.success) {
    logReportRequest({
      event: 'report-failed',
      family,
      requestId,
      posture,
      outcome: 'invalid-payload',
    });
    return NextResponse.json(
      { error: 'invalid-payload' },
      { status: 400 },
    );
  }

  const { context, payload } = parseResult.data;

  // 5. Template dispatch.
  //
  // Public families (Phase 5a — single-employee, bulk-summary): render via
  // the templates registered below. Authenticated families (Phase 5b —
  // liability, reconciliation): still 501 until E5.5 / E5.6 ship.
  try {
    // `@react-pdf/renderer`'s `Document` and `renderToBuffer` types carry
    // React-18-era prop shapes that don't directly satisfy React 19's
    // `ReactElement<DocumentProps>` constraint. Re-type both via a narrow
    // structural cast (matches the pattern in `/api/export-pdf/route.tsx`).
    const DocumentNode = Document as unknown as React.ComponentType<{
      children?: React.ReactNode;
      title?: string;
    }>;
    type AnyPdfElement = Parameters<typeof renderToBuffer>[0];

    let element: AnyPdfElement | null = null;
    let filename = '';

    if (family === 'single-employee') {
      const narrowed = narrowSingleEmployeePayload(payload);
      element = React.createElement(
        DocumentNode,
        { title: context.reportTitle },
        React.createElement(SingleEmployee, { context, payload: narrowed }),
      ) as unknown as AnyPdfElement;
      filename = buildFilename(
        family,
        narrowed.identity?.externalEmployeeId ?? narrowed.identity?.legalName,
      );
    } else if (family === 'bulk-summary') {
      const narrowed = narrowBulkSummaryPayload(payload);
      element = React.createElement(
        DocumentNode,
        { title: context.reportTitle },
        React.createElement(BulkSummary, { context, payload: narrowed }),
      ) as unknown as AnyPdfElement;
      filename = buildFilename(family);
    }

    if (element === null) {
      // Authenticated families (liability, reconciliation) — template not yet
      // wired. They land in Phase 5b (E5.5 + E5.6). Same 501 shape the contract
      // test asserts today.
      logReportRequest({
        event: 'report-failed',
        family,
        requestId,
        posture,
        outcome: 'template-not-shipped',
      });
      return NextResponse.json(
        { error: 'template-not-shipped' },
        { status: 501 },
      );
    }

    const buffer = await renderToBuffer(element);
    logReportRequest({
      event: 'report-rendered',
      family,
      requestId,
      posture,
      outcome: 'ok',
    });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    // Distinguish payload-narrowing errors (invalid-payload, 400) from real
    // render failures (render-failure, 500). `PayloadNarrowError` is the
    // sentinel thrown by `narrowSingleEmployeePayload` /
    // `narrowBulkSummaryPayload` when the family-specific shape doesn't
    // satisfy the template's contract (e.g. missing `result` / `results`).
    if (err instanceof PayloadNarrowError) {
      logReportRequest({
        event: 'report-failed',
        family,
        requestId,
        posture,
        outcome: 'invalid-payload',
      });
      return NextResponse.json(
        { error: 'invalid-payload' },
        { status: 400 },
      );
    }
    // Real render failure (react-pdf threw, font registration failed, etc.).
    // Log with requestId so the operator can correlate Vercel function logs.
    console.error('[api/reports]', requestId, 'render failed', err);
    logReportRequest({
      event: 'report-failed',
      family,
      requestId,
      posture,
      outcome: 'render-failure',
    });
    return NextResponse.json(
      { error: 'render-failure', requestId },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Per-family payload narrowing
// ---------------------------------------------------------------------------

/**
 * Sentinel error for invalid family-specific payload shape. Thrown by the
 * narrowing helpers below and caught in the route handler to map to a 400
 * `invalid-payload` response.
 */
class PayloadNarrowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadNarrowError';
  }
}

/**
 * Narrow the route's `payload: unknown` into the `SingleEmployeePayload`
 * shape the template consumes.
 *
 * The route handler's Zod schema validates `context` structurally but treats
 * `payload` as opaque — each family narrows its own slice here. We accept
 * `{ result: Result, identity?: ... }` and rehydrate the `Decimal` fields
 * (see `rehydrateResult` below for the JSON-round-trip rationale).
 *
 * Throws `PayloadNarrowError` on missing/malformed shape — the handler
 * surfaces that as `400 invalid-payload`.
 */
function narrowSingleEmployeePayload(raw: unknown): SingleEmployeePayload {
  if (typeof raw !== 'object' || raw === null) {
    throw new PayloadNarrowError('single-employee payload must be an object');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.result !== 'object' || obj.result === null) {
    throw new PayloadNarrowError(
      'single-employee payload requires `result` object (engine Result)',
    );
  }
  const result = rehydrateResult(obj.result);
  const identityRaw = obj.identity;
  let identity: SingleEmployeePayload['identity'];
  if (identityRaw !== undefined && identityRaw !== null) {
    if (typeof identityRaw !== 'object') {
      throw new PayloadNarrowError(
        'single-employee payload `identity` must be an object when present',
      );
    }
    const idObj = identityRaw as Record<string, unknown>;
    identity = {
      legalName: optString(idObj.legalName),
      externalEmployeeId: optString(idObj.externalEmployeeId),
      startDate: optString(idObj.startDate),
    };
  }
  return { result, identity };
}

/**
 * Narrow the route's `payload: unknown` into the `BulkSummaryPayload` shape.
 *
 * Accepts `{ results: Result[], namesById?: ..., summary?: ... }`. The
 * `results` array MUST be present and non-array values throw. Each entry
 * goes through `rehydrateResult` to restore Decimal instances on the
 * outputs / diagnostics fields (BulkSummary's `sumComputedEntitlement` calls
 * `.plus()` and `.toFixed()` on `outputs.totalEntitlement.dollars.value`,
 * which JSON-round-trips to a string — see the rehydration helper).
 */
function narrowBulkSummaryPayload(raw: unknown): BulkSummaryPayload {
  if (typeof raw !== 'object' || raw === null) {
    throw new PayloadNarrowError('bulk-summary payload must be an object');
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.results)) {
    throw new PayloadNarrowError(
      'bulk-summary payload requires `results` array (engine Result[])',
    );
  }
  const results: Result[] = obj.results.map((r, i) => {
    if (typeof r !== 'object' || r === null) {
      throw new PayloadNarrowError(
        `bulk-summary payload results[${i}] must be an object`,
      );
    }
    return rehydrateResult(r);
  });

  // `namesById` — optional employee-id → legalName lookup. Validate
  // structurally; ignore non-string values rather than throwing.
  let namesById: BulkSummaryPayload['namesById'];
  if (obj.namesById !== undefined && obj.namesById !== null) {
    if (typeof obj.namesById !== 'object') {
      throw new PayloadNarrowError(
        'bulk-summary `namesById` must be an object when present',
      );
    }
    namesById = {};
    for (const [k, v] of Object.entries(obj.namesById as Record<string, unknown>)) {
      namesById[k] = typeof v === 'string' ? v : undefined;
    }
  }

  // `summary` — optional aggregate counts.
  let summary: BulkSummaryPayload['summary'];
  if (obj.summary !== undefined && obj.summary !== null) {
    if (typeof obj.summary !== 'object') {
      throw new PayloadNarrowError(
        'bulk-summary `summary` must be an object when present',
      );
    }
    const sObj = obj.summary as Record<string, unknown>;
    summary = {
      computed: typeof sObj.computed === 'number' ? sObj.computed : 0,
      blocked: typeof sObj.blocked === 'number' ? sObj.blocked : 0,
      failed: typeof sObj.failed === 'number' ? sObj.failed : 0,
      elapsedMs: typeof sObj.elapsedMs === 'number' ? sObj.elapsedMs : undefined,
    };
  }

  return { results, namesById, summary };
}

function optString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

// ---------------------------------------------------------------------------
// Decimal rehydration — JSON-round-trip restoration
// ---------------------------------------------------------------------------

/**
 * Rehydrate an engine `Result` after JSON round-trip.
 *
 * The engine `Result` carries `decimal.js` Decimal instances on
 * `outputs.{valueOfWeek,valueOfDay,totalEntitlement.{weeks,dollars}}.value`
 * and `diagnostics.{yearsOfContinuousService,weeklyAvg12mo,weeklyAvg5yr}`.
 * `decimal.js` defines a `toJSON()` that emits its decimal as a STRING — so
 * after `JSON.stringify` + `JSON.parse` the `.value` field is a string, not
 * a `Decimal` instance. The templates render `.display` strings for
 * visual output (those round-trip fine), but `BulkSummary.sumComputedEntitlement`
 * calls `.plus()` and `.toFixed()` on `outputs.totalEntitlement.dollars.value`
 * to derive the banner total — that requires a real `Decimal`.
 *
 * This helper walks the relevant fields and re-wraps strings/numbers into
 * fresh `Decimal` instances. Fields that are already `Decimal` (in-process
 * calls, e.g. tests) pass through unchanged.
 *
 * Non-Decimal fields are passed through verbatim. The walk is shallow —
 * only the fields the templates touch get rehydrated. Unknown fields are
 * preserved as-is so a future engine-side additive change doesn't break
 * this path.
 */
function rehydrateResult(raw: unknown): Result {
  if (typeof raw !== 'object' || raw === null) {
    throw new PayloadNarrowError('result must be an object');
  }
  // Type-erase to a plain record so we can write the structural walk; cast
  // the return at the end. The engine `Result` is the canonical type — we
  // never want to materialise a parallel shape here.
  const r = raw as Record<string, unknown>;

  // Walk `outputs` if present.
  if (r.outputs && typeof r.outputs === 'object') {
    const outs = r.outputs as Record<string, unknown>;
    rehydrateNumericOutput(outs.valueOfWeek);
    rehydrateNumericOutput(outs.valueOfDay);
    if (outs.totalEntitlement && typeof outs.totalEntitlement === 'object') {
      const te = outs.totalEntitlement as Record<string, unknown>;
      rehydrateNumericOutput(te.weeks);
      rehydrateNumericOutput(te.dollars);
    }
    // systemFormula — only `value` + `variance` + `variancePct` are Decimals;
    // the templates today don't call methods on them, but rehydrate
    // defensively so future template work doesn't trip on string-vs-Decimal.
    if (outs.systemFormula && typeof outs.systemFormula === 'object') {
      const sf = outs.systemFormula as Record<string, unknown>;
      sf.value = toDecimalLike(sf.value);
      sf.variance = toDecimalLike(sf.variance);
      sf.variancePct = toDecimalLike(sf.variancePct);
    }
  }

  // Walk `diagnostics` if present.
  if (r.diagnostics && typeof r.diagnostics === 'object') {
    const d = r.diagnostics as Record<string, unknown>;
    d.yearsOfContinuousService = toDecimalLike(d.yearsOfContinuousService);
    d.weeklyAvg12mo = toDecimalLike(d.weeklyAvg12mo);
    d.weeklyAvg5yr = toDecimalLike(d.weeklyAvg5yr);
  }

  return r as unknown as Result;
}

function rehydrateNumericOutput(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return;
  const n = raw as Record<string, unknown>;
  n.value = toDecimalLike(n.value);
}

/**
 * Best-effort wrap of a value into a `Decimal`. Accepts existing Decimals,
 * strings (the JSON-round-trip shape), and numbers. Returns the original
 * value when the input is undefined / null / unknown — the template-level
 * code is defensive about missing fields.
 */
function toDecimalLike(v: unknown): unknown {
  if (v === undefined || v === null) return v;
  if (v instanceof Decimal) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    try {
      return new Decimal(v);
    } catch {
      // Malformed decimal string — leave as-is. The template guards against
      // missing/invalid fields by using `.display` strings for visible
      // output; the rehydration is a best-effort restoration.
      return v;
    }
  }
  return v;
}

// ---------------------------------------------------------------------------
// Filename derivation
// ---------------------------------------------------------------------------

/**
 * Build the `Content-Disposition` filename for a successful PDF render.
 *
 * Format: `LSL-{family}-{date}.pdf` or `LSL-{family}-{idOrName}-{date}.pdf`
 * when an identifier is supplied. The date stamp is the UTC ISO date
 * (`YYYY-MM-DD`) — matches the legacy `/api/export-pdf` filename pattern
 * the single-employee CTA produced before this PR.
 */
function buildFilename(family: ReportFamily, identifier?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const safeId =
    identifier && identifier.length > 0
      ? identifier.replace(/[^a-zA-Z0-9._-]/g, '-')
      : undefined;
  if (safeId) {
    return `LSL-${family}-${safeId}-${date}.pdf`;
  }
  return `LSL-${family}-${date}.pdf`;
}
