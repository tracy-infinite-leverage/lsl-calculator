/**
 * posture.test.ts — wire-level posture contract test for POST /api/reports/[family].
 *
 * E6.5 Task 5.5-bis (spec §5.3 + OQ-6, impl-plan §1.3, tasks.md lines 686-700).
 *
 * ----------------------------------------------------------------------------
 * Why this file exists separately from `route.test.ts`
 * ----------------------------------------------------------------------------
 *
 * `src/app/api/reports/[family]/route.test.ts` is the UNIT test. It mocks
 * `createSupabaseServerClient` at the factory boundary and asserts
 * `.not.toHaveBeenCalled()` for public-family requests — i.e. it verifies the
 * posture branch by inspecting an internal call graph.
 *
 * THIS FILE is the WIRE-LEVEL complement. It exercises the route handler
 * EXACTLY as the Next.js runtime would: a `POST /api/reports/<family>` request
 * with NO Cookie / NO Authorization header arrives, the handler runs end-to-end,
 * and the test asserts on the OBSERVABLE response (status code + JSON body).
 *
 * The only mocks here are at the Supabase/Next.js wire boundary — `next/headers`
 * cookies() to provide an empty cookie store (no request context exists in a
 * vitest process) and `@supabase/ssr` createServerClient to model the
 * "no session → user: null" behaviour deterministically without a network call.
 * The route handler, family registry, posture branch, auth-first ordering,
 * Zod schema, and response construction all run for real.
 *
 * If a future refactor accidentally couples the public-family path to an
 * auth check — e.g. by hoisting `createSupabaseServerClient()` above the
 * family branch — the public assertions below 401 instead of 501 and this
 * test fails LOUD. That is the contract this PR locks.
 *
 * ----------------------------------------------------------------------------
 * Why this lives at `src/app/api/reports/__tests__/posture.test.ts`
 * ----------------------------------------------------------------------------
 *
 * The Task 2.11 diff-guard (docs/qa/e6-test-sanctity.md) protects four paths:
 * `website/e2e/`, `website/src/lib/lsl/engine/`, `website/src/lib/lsl/states/`,
 * and `website/src/__tests__/`. This path is OUTSIDE all four.
 *
 * vitest.config.ts has `include: ['src/**​/*.{test,spec}.ts']` so this file is
 * picked up by the CI `test` job automatically — no config change required.
 *
 * The dispatch instruction's preferred path (`website/e2e/api-reports-posture.spec.ts`)
 * is DIFF-GUARDED. The dispatch's named fallback (`website/__tests__/api/...`) is
 * OUTSIDE the vitest include glob and would not be picked up by CI. This
 * colocated path is the canonical vitest location that satisfies both
 * constraints.
 *
 * ----------------------------------------------------------------------------
 * Phase 5a flip (the "200 vs 501" assertion)
 * ----------------------------------------------------------------------------
 *
 * Today, templates have not shipped — public families return 501
 * `template-not-shipped`. Phase 5a (Tasks 6.1 + 6.2) will flip the response to
 * 200 + `application/pdf`. The assertion below accepts EITHER status with the
 * matching body shape, so this test survives the flip without modification.
 * The CRITICAL contract is that public families NEVER 401 without auth — that
 * is invariant across the flip.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Wire-boundary mocks
// ---------------------------------------------------------------------------
//
// We mock TWO things only — the surfaces a real HTTP request would hit that
// vitest cannot provide:
//
//   1. `next/headers` cookies() — there is no request context in a vitest
//      process, so the real `cookies()` from `next/headers` throws. We mock
//      it to return an empty cookie store, which is what a real
//      `POST /api/reports/<family>` request with NO Cookie header would
//      receive in production.
//
//   2. `@supabase/ssr` createServerClient — we let the route handler call the
//      REAL `createSupabaseServerClient` (from `@/lib/supabase/server`), which
//      in turn calls `createServerClient` from `@supabase/ssr`. We mock the
//      `@supabase/ssr` import so the constructed client's `auth.getUser()`
//      deterministically returns `{ data: { user: null }, error: null }`
//      when no session cookie is present. This is exactly the wire behaviour
//      supabase-ssr exhibits in production for an unauthenticated request,
//      but without the flakiness of a real network round-trip to a dummy URL.
//
// Everything else — the route handler, the family registry, the posture
// branch, the Zod schema, the response construction — runs for real.

vi.mock('next/headers', () => ({
  // Empty cookie store. A real anonymous request also carries no cookies.
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
    // The route handler does not call these directly, but supabase-ssr's
    // setAll wrapper may attempt a `cookieStore.set(name, value, options)`
    // during getUser when refreshing tokens — never the case for an
    // unauthenticated request, but we provide the no-op to be safe.
  })),
}));

vi.mock('@supabase/ssr', () => ({
  // Minimal createServerClient mock that reads its cookies callback exactly
  // as supabase-ssr does, then returns a client whose `auth.getUser()`
  // returns `user: null` when no session cookie is present.
  createServerClient: (
    _url: string,
    _anonKey: string,
    opts: {
      cookies: {
        getAll: () => Array<{ name: string; value: string }>;
        setAll: (cookies: Array<{ name: string; value: string; options?: unknown }>) => void;
      };
    },
  ) => {
    return {
      auth: {
        async getUser() {
          // Real supabase-ssr behaviour: check for the session cookie. If
          // none is present, return { user: null } without a network call.
          // Our mock follows the same contract — read the cookies callback
          // and decide based on cookie presence.
          const all = opts.cookies.getAll();
          const hasSessionCookie = all.some((c) =>
            // Match the supabase-ssr session cookie pattern. The real prefix
            // is `sb-<project-ref>-auth-token` — we accept any `sb-` cookie
            // for robustness (the test never sets one, so this is a guard).
            c.name.startsWith('sb-') && c.name.includes('auth-token'),
          );
          return {
            data: { user: hasSessionCookie ? { id: 'unreachable-in-test' } : null },
            error: null,
          };
        },
      },
    };
  },
}));

// Set the Supabase env vars BEFORE the route module is imported. The real
// `createSupabaseServerClient` throws at construction time if these are
// missing. We use unreachable placeholders — the `@supabase/ssr` mock above
// never makes a network call so the URL is never resolved.
const SUPABASE_URL_BEFORE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY_BEFORE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-mock-unreachable.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-not-real';
});

afterAll(() => {
  // Restore so we don't pollute downstream test files in the same vitest run.
  if (SUPABASE_URL_BEFORE === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL_BEFORE;
  }
  if (SUPABASE_KEY_BEFORE === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_KEY_BEFORE;
  }
});

// Import the route handler AFTER the env vars are set and the wire-boundary
// mocks are registered. The real `@/lib/supabase/server` module runs (it
// reads the env vars + calls our mocked `@supabase/ssr.createServerClient`).
const { POST } = await import('../[family]/route');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * A spec-compliant request body. The route's Zod schema enforces the
 * `context` shape; family-specific narrowing of `payload` happens inside
 * the dispatcher (E6.6a Task 6.3). The body below carries BOTH the
 * single-employee `result` AND the bulk-summary `results` so the SAME
 * fixture satisfies both public families' narrowing — the posture test
 * exercises the canonical 200/501 wire-state contract per family without
 * needing per-family fixtures.
 *
 * Decimal-valued fields are strings — the route handler rehydrates strings
 * into `Decimal` instances before invoking the template (the JSON-round-
 * trip shape a real CTA `fetch` body delivers).
 */
const _MINIMAL_RESULT = {
  employeeId: 'emp-posture',
  status: 'computed' as const,
  category: 'B' as const,
  trigger: {
    kind: 'termination' as const,
    terminationDate: '2026-05-31',
    reason: 'redundancy',
  },
  outputs: {
    valueOfWeek: { value: '1000.00', display: '1,000.00', citations: [] },
    valueOfDay: { value: '200.00', display: '200.00', citations: [] },
    totalEntitlement: {
      weeks: { value: '10.83', display: '10.83', citations: [] },
      dollars: { value: '10830.00', display: '10,830.00', citations: [] },
    },
  },
  warnings: [],
  diagnostics: {
    yearsOfContinuousService: '10.83',
    daysOfContinuousService: 3954,
    daysNotCountedInService: 0,
    daysNotCountedInLookback: { window12mo: 0, window5yr: 0 },
    weeklyAvg12mo: '1000.00',
    weeklyAvg5yr: '950.00',
    payableIndicator: 'payable' as const,
    serviceStartUsed: '2015-09-01',
  },
};

const VALID_BODY = {
  context: {
    reportTitle: 'Posture contract test',
    generatedAtIso: '2026-06-02T00:00:00Z',
    organisationName: 'Austpayroll',
    calcMethodologyVersion: 'lsl-engine-v1.4.2',
    stateEngineVersion: 'rules-engine-v1.2',
    dataAsAtIso: '2026-06-02T00:00:00Z',
    apaContact: {
      email: 'admin@austpayroll.com.au',
      url: 'www.austpayroll.com.au',
    },
  },
  // Carries BOTH the single-employee `{ result, identity }` slice AND the
  // bulk-summary `{ results }` slice so this single fixture passes the per-
  // family narrowing for either public-family target. Authenticated-family
  // tests 401 before the body is touched so the unused fields are harmless
  // for those paths.
  payload: {
    result: _MINIMAL_RESULT,
    identity: { legalName: 'Posture Test', externalEmployeeId: 'POSTURE-1', startDate: '2015-09-01' },
    results: [_MINIMAL_RESULT],
  },
};

/**
 * Build a NextRequest with NO Cookie and NO Authorization header — the
 * load-bearing precondition for this test. A real anonymous browser fetch
 * to `POST /api/reports/<family>` would carry the same headers.
 */
function makeAnonymousRequest(family: string): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/reports/${family}`),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // INTENTIONAL: NO `Cookie` header. NO `Authorization` header.
      },
      body: JSON.stringify(VALID_BODY),
    },
  );
}

function makeCtx(family: string): { params: Promise<{ family: string }> } {
  return { params: Promise.resolve({ family }) };
}

// Reset mock state between tests — important because vi.mock factory results
// are shared across the file, but call counts on mocked functions can leak.
beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// The four wire-level posture contract assertions
// ---------------------------------------------------------------------------
//
// One assertion per family. Each one fires the real route handler against a
// real (anonymous) NextRequest and asserts on the observable response.

describe('Wire-level posture contract: POST /api/reports/[family]', () => {
  // ─── Public families (OQ-6 — never 401 without auth) ────────────────────

  describe('PUBLIC families return 501 today (Phase 5a will flip to 200)', () => {
    it('single-employee with NO auth header → 501 template-not-shipped (Phase 5a: 200 application/pdf)', async () => {
      const response = await POST(
        makeAnonymousRequest('single-employee'),
        makeCtx('single-employee'),
      );

      // The CRITICAL invariant: a public family with no auth must NEVER 401.
      expect(response.status).not.toBe(401);

      // Today's expected wire state: 501 template-not-shipped. Once Task 6.1
      // lands, the same request will return 200 + `application/pdf`. Both
      // outcomes preserve OQ-6 (no 401 without auth), so we accept either.
      const allowedStatuses = [200, 501];
      expect(allowedStatuses).toContain(response.status);

      if (response.status === 501) {
        const json = (await response.json()) as { error: string };
        expect(json.error).toBe('template-not-shipped');
      } else {
        // Phase 5a fallthrough — verify the wire shape matches the public-PDF contract.
        expect(response.headers.get('content-type')).toMatch(/application\/pdf/);
      }
    });

    it('bulk-summary with NO auth header → 501 template-not-shipped (Phase 5a: 200 application/pdf)', async () => {
      const response = await POST(
        makeAnonymousRequest('bulk-summary'),
        makeCtx('bulk-summary'),
      );

      expect(response.status).not.toBe(401);

      const allowedStatuses = [200, 501];
      expect(allowedStatuses).toContain(response.status);

      if (response.status === 501) {
        const json = (await response.json()) as { error: string };
        expect(json.error).toBe('template-not-shipped');
      } else {
        expect(response.headers.get('content-type')).toMatch(/application\/pdf/);
      }
    });
  });

  // ─── Authenticated families (must 401 without a session) ─────────────────

  describe('AUTHENTICATED families return 401 without a Supabase session', () => {
    it('liability with NO auth header → 401 unauthorized', async () => {
      const response = await POST(
        makeAnonymousRequest('liability'),
        makeCtx('liability'),
      );

      expect(response.status).toBe(401);
      const json = (await response.json()) as { error: string };
      expect(json.error).toBe('unauthorized');
    });

    it('reconciliation with NO auth header → 401 unauthorized', async () => {
      const response = await POST(
        makeAnonymousRequest('reconciliation'),
        makeCtx('reconciliation'),
      );

      expect(response.status).toBe(401);
      const json = (await response.json()) as { error: string };
      expect(json.error).toBe('unauthorized');
    });
  });

  // ─── The OQ-6 invariant pinned for the record ───────────────────────────

  describe('The OQ-6 wire invariant', () => {
    it('public families NEVER return 401 — they return 200 or 501', async () => {
      // The single most important contract this file locks. If a future
      // refactor accidentally couples a public family to the auth check
      // (e.g. by hoisting `createSupabaseServerClient()` above the family
      // branch), this assertion fails.
      for (const family of ['single-employee', 'bulk-summary'] as const) {
        const response = await POST(
          makeAnonymousRequest(family),
          makeCtx(family),
        );
        expect(
          [200, 501],
          `family=${family} status=${response.status} body=${await response.clone().text()}`,
        ).toContain(response.status);
      }
    });

    it('authenticated families ALWAYS return 401 with no session — they NEVER return 200/501', async () => {
      // The companion contract: an authed family must NEVER leak a 200 or
      // 501 to an unauthenticated caller. 401 is the only correct outcome.
      for (const family of ['liability', 'reconciliation'] as const) {
        const response = await POST(
          makeAnonymousRequest(family),
          makeCtx(family),
        );
        expect(response.status).toBe(401);
      }
    });
  });
});
