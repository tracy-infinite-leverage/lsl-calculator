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
import {
  FAMILY_POSTURE,
  isKnownFamily,
  type ReportFamily,
} from '@/lib/pdf/families';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

  // Validated. The narrowed `context` is available below for template
  // dispatch when Tasks 6.1 / 6.2 / E5.5 / E5.6 land. We deliberately
  // mark it as used via a void expression so the strict TS unused-locals
  // setting doesn't fire while the dispatch is still TODO.
  const { context: _context, payload: _payload } = parseResult.data;
  void _context;
  void _payload;

  // 5. Template dispatch.
  //
  // TODO Task 6.1 / 6.2 / E5.5 / E5.6: wire template lookup here.
  //   const Template = FAMILY_TEMPLATE[family]; // (context, payload) => ReactElement
  //   const element = Template(_context, _payload);
  //   const buffer = await renderToBuffer(element);
  //   logReportRequest({ event: 'report-rendered', family, requestId, posture, outcome: 'ok' });
  //   return new NextResponse(new Uint8Array(buffer), {
  //     status: 200,
  //     headers: {
  //       'Content-Type': 'application/pdf',
  //       'Content-Disposition': `attachment; filename="${family}.pdf"`,
  //       'Cache-Control': 'no-store',
  //     },
  //   });
  //
  // Until then, return 501 — the family is recognised but no renderer is
  // wired. The contract test (Task 5.5-bis) verifies posture using this
  // status without needing a real PDF to exist yet.
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
