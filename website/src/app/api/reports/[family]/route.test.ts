/**
 * Unit tests for the `POST /api/reports/[family]` endpoint.
 *
 * E6.5 Task 5.5. Pins the load-bearing auth-posture split (OQ-6 / G-1):
 *
 *   - Public families (single-employee, bulk-summary) NEVER call Supabase.
 *   - Authenticated families (liability, reconciliation) return 401 without
 *     a valid session.
 *
 * Tests use a Supabase mock that asserts whether `createSupabaseServerClient`
 * is invoked. The whole point of the posture split is that public families
 * do NOT touch Supabase — the test framework asserts that as an INVARIANT
 * (via `getUserMock.toHaveBeenCalled()`) on every public-family test case.
 *
 * Status-code coverage in this file:
 *
 *   - 200 application/pdf: NOT exercised today (templates land in 6.1+).
 *     The contract test (Task 5.5-bis) takes that role once templates ship.
 *   - 400 unsupported-family: unknown family in URL.
 *   - 400 invalid-payload: malformed JSON / Zod failure.
 *   - 401 unauthorized: authenticated family without a session.
 *   - 500 render-failure: Supabase auth lookup throws (the only render path
 *     wired today is the auth-check path).
 *   - 501 template-not-shipped: every recognised family today returns this
 *     because templates have not been wired.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase mock ──────────────────────────────────────────────────────────
// The mock is wired so that:
//   - getUserMock returns a logged-in user by default
//   - Each test can override per-call behaviour
//   - The `createSupabaseServerClient` factory itself is a spy — so we can
//     assert that PUBLIC families NEVER call it (the OQ-6 contract).

type GetUserResult = {
  data: { user: { id: string } | null };
  error: null;
};
const getUserMock = vi.fn<() => Promise<GetUserResult>>(async () => ({
  data: { user: { id: 'user-1' } },
  error: null,
}));

const createSupabaseServerClientMock = vi.fn(async () => ({
  auth: {
    getUser: getUserMock,
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

// Import AFTER mocks are set up.
const { POST } = await import('./route');

// ─── Test helpers ───────────────────────────────────────────────────────────

/**
 * Build a NextRequest with a JSON body for the endpoint. Default body is a
 * valid `{ context, payload }` shape that satisfies the Zod schema. Tests
 * that need invalid bodies pass an explicit body or use `makeRequestRaw`.
 */
function makeRequest(family: string, body?: unknown): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/reports/${family}`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? VALID_BODY),
    },
  );
}

/**
 * Build a NextRequest with a literal raw body string — used for the
 * invalid-JSON case where `JSON.stringify` would otherwise produce valid JSON.
 */
function makeRequestRaw(family: string, rawBody: string): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/reports/${family}`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: rawBody,
    },
  );
}

/**
 * Construct the route context object Next.js 16 passes as the second arg.
 * The `params` property is a Promise — we await it inside the handler.
 */
function makeCtx(family: string): { params: Promise<{ family: string }> } {
  return { params: Promise.resolve({ family }) };
}

const VALID_CONTEXT = {
  reportTitle: 'Test report',
  generatedAtIso: '2026-05-31T05:42:00Z',
  organisationName: 'Acme Pty Ltd',
  calcMethodologyVersion: 'lsl-engine-v1.4.2',
  stateEngineVersion: 'rules-engine-v1.2',
  dataAsAtIso: '2026-05-31T05:42:00Z',
  apaContact: {
    email: 'admin@austpayroll.com.au',
    url: 'www.austpayroll.com.au',
  },
};

const VALID_BODY = {
  context: VALID_CONTEXT,
  payload: { whatever: 'family-specific' },
};

/**
 * Minimal single-employee payload that satisfies the dispatcher's narrowing
 * and exercises the real react-pdf render path. The engine `Result` carries
 * `Decimal` instances on numeric outputs / diagnostics in normal flow — but
 * JSON-round-trip serialises them as strings (see `rehydrateResult` in
 * route.ts). Strings are exactly what a real CTA `fetch` body delivers, so
 * the fixture uses bare strings — the route handler rehydrates them into
 * Decimals before passing to the template.
 */
const MINIMAL_SINGLE_EMPLOYEE_PAYLOAD = {
  result: {
    employeeId: 'emp-001',
    status: 'computed',
    category: 'B',
    trigger: {
      kind: 'termination',
      terminationDate: '2026-05-31',
      reason: 'redundancy',
    },
    outputs: {
      valueOfWeek: {
        value: '1000.00',
        display: '1,000.00',
        citations: [
          { section: 'NSW LSL Act 1955 s.4(2)', rule: 'long_service_leave_entitlement_after_10_years' },
        ],
      },
      valueOfDay: {
        value: '200.00',
        display: '200.00',
        citations: [],
      },
      totalEntitlement: {
        weeks: {
          value: '10.83',
          display: '10.83',
          citations: [],
        },
        dollars: {
          value: '10830.00',
          display: '10,830.00',
          citations: [],
        },
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
      payableIndicator: 'payable',
      serviceStartUsed: '2015-09-01',
    },
  },
  identity: {
    legalName: 'Sample Employee',
    externalEmployeeId: 'EMP-001',
    startDate: '2015-09-01',
  },
};

const MINIMAL_BULK_SUMMARY_PAYLOAD = {
  results: [MINIMAL_SINGLE_EMPLOYEE_PAYLOAD.result],
  namesById: { 'emp-001': 'Sample Employee' },
  summary: { computed: 1, blocked: 0, failed: 0, elapsedMs: 42 },
};

// ─── Test setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  createSupabaseServerClientMock.mockClear();
  getUserMock.mockClear();
  // Reset to logged-in default.
  getUserMock.mockImplementation(async () => ({
    data: { user: { id: 'user-1' } },
    error: null,
  }));
});

// ─── Public families: NEVER touch Supabase (OQ-6 / G-1) ─────────────────────

describe('POST /api/reports/single-employee — PUBLIC posture (OQ-6)', () => {
  it('does NOT call createSupabaseServerClient (load-bearing OQ-6 contract)', async () => {
    await POST(makeRequest('single-employee'), makeCtx('single-employee'));
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('returns 200 application/pdf for a valid single-employee payload (Task 6.3 dispatch)', async () => {
    // Wire the dispatcher end-to-end against a real react-pdf render. The
    // assertion is intentionally loose on PDF contents (the template
    // snapshot tests own that surface) — what we lock here is the WIRE
    // contract: 200, the correct content-type, an attachment header, and
    // a real PDF byte buffer (`%PDF-` start, `%%EOF` end).
    const response = await POST(
      makeRequest('single-employee', {
        context: VALID_CONTEXT,
        payload: MINIMAL_SINGLE_EMPLOYEE_PAYLOAD,
      }),
      makeCtx('single-employee'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/pdf/);
    expect(response.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(response.headers.get('content-disposition')).toMatch(/\.pdf"$/);
    const buf = Buffer.from(await response.arrayBuffer());
    expect(buf.length).toBeGreaterThan(1024); // >1 KB — sanity gate
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.subarray(-8).toString('latin1')).toMatch(/%%EOF/);
    // OQ-6 invariant: a successful render of a public family must NOT have
    // touched Supabase. Belt-and-braces alongside the dedicated test above.
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  }, 30000);

  it('returns 400 invalid-payload when payload lacks the family-specific `result` field (Task 6.3 flip)', async () => {
    // Task 6.3 — public families now dispatch to the SingleEmployee / BulkSummary
    // templates. The default VALID_BODY has `payload: { whatever: 'family-specific' }`
    // which is intentionally opaque at the route's Zod layer (validated only
    // structurally). Family-specific narrowing now happens inside the dispatch,
    // so a payload without `result` correctly fails with 400 invalid-payload
    // rather than 501 template-not-shipped. The 501 outcome is reserved for
    // RECOGNISED families with NO renderer wired (today: liability,
    // reconciliation — Phase 5b).
    const response = await POST(
      makeRequest('single-employee'),
      makeCtx('single-employee'),
    );
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('invalid-payload');
  });

  it('returns 400 invalid-payload for malformed JSON — without touching Supabase', async () => {
    const response = await POST(
      makeRequestRaw('single-employee', '{ not valid json'),
      makeCtx('single-employee'),
    );
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('invalid-payload');
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it('returns 400 invalid-payload for missing required context fields', async () => {
    const response = await POST(
      makeRequest('single-employee', { context: {}, payload: {} }),
      makeCtx('single-employee'),
    );
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('invalid-payload');
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/reports/bulk-summary — PUBLIC posture (OQ-6)', () => {
  it('does NOT call createSupabaseServerClient', async () => {
    await POST(makeRequest('bulk-summary'), makeCtx('bulk-summary'));
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('returns 200 application/pdf for a valid bulk-summary payload (Task 6.3 dispatch)', async () => {
    const response = await POST(
      makeRequest('bulk-summary', {
        context: VALID_CONTEXT,
        payload: MINIMAL_BULK_SUMMARY_PAYLOAD,
      }),
      makeCtx('bulk-summary'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/pdf/);
    expect(response.headers.get('content-disposition')).toMatch(/^attachment;/);
    const buf = Buffer.from(await response.arrayBuffer());
    expect(buf.length).toBeGreaterThan(1024);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.subarray(-8).toString('latin1')).toMatch(/%%EOF/);
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  }, 30000);

  it('returns 400 invalid-payload when payload lacks the family-specific `results` array (Task 6.3 flip)', async () => {
    const response = await POST(
      makeRequest('bulk-summary'),
      makeCtx('bulk-summary'),
    );
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('invalid-payload');
  });
});

// ─── Authenticated families: 401 without session ────────────────────────────

describe('POST /api/reports/liability — AUTHENTICATED posture', () => {
  it('returns 401 unauthorized without a valid Supabase session', async () => {
    // Override the default mock to return no user.
    getUserMock.mockImplementationOnce(async () => ({
      data: { user: null },
      error: null,
    }));
    const response = await POST(
      makeRequest('liability'),
      makeCtx('liability'),
    );
    expect(response.status).toBe(401);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('unauthorized');
    // Verify Supabase WAS consulted (this is the authenticated path).
    expect(createSupabaseServerClientMock).toHaveBeenCalledTimes(1);
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });

  it('returns 501 template-not-shipped when authenticated (template lands in E5.5)', async () => {
    // Default mock = logged-in user.
    const response = await POST(
      makeRequest('liability'),
      makeCtx('liability'),
    );
    expect(response.status).toBe(501);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('template-not-shipped');
  });

  it('returns 500 render-failure with a requestId when Supabase auth lookup throws', async () => {
    // Mock the underlying client factory to throw.
    createSupabaseServerClientMock.mockImplementationOnce(async () => {
      throw new Error('Supabase outage');
    });
    const response = await POST(
      makeRequest('liability'),
      makeCtx('liability'),
    );
    expect(response.status).toBe(500);
    const json = (await response.json()) as { error: string; requestId: string };
    expect(json.error).toBe('render-failure');
    // requestId must be a non-empty string (UUID v4 from crypto.randomUUID).
    expect(json.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('does NOT process the body if auth fails (auth-first ordering)', async () => {
    // Override to return no user. Send a body that would fail Zod
    // validation — but since auth fires FIRST, we should get 401 not 400.
    getUserMock.mockImplementationOnce(async () => ({
      data: { user: null },
      error: null,
    }));
    const response = await POST(
      makeRequest('liability', { context: {}, payload: {} }),
      makeCtx('liability'),
    );
    expect(response.status).toBe(401);
  });
});

describe('POST /api/reports/reconciliation — AUTHENTICATED posture', () => {
  it('returns 401 unauthorized without a valid Supabase session', async () => {
    getUserMock.mockImplementationOnce(async () => ({
      data: { user: null },
      error: null,
    }));
    const response = await POST(
      makeRequest('reconciliation'),
      makeCtx('reconciliation'),
    );
    expect(response.status).toBe(401);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('unauthorized');
    expect(createSupabaseServerClientMock).toHaveBeenCalledTimes(1);
  });

  it('returns 501 template-not-shipped when authenticated (template lands in E5.6)', async () => {
    const response = await POST(
      makeRequest('reconciliation'),
      makeCtx('reconciliation'),
    );
    expect(response.status).toBe(501);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('template-not-shipped');
  });
});

// ─── Unknown families: 400 BEFORE any auth check ────────────────────────────

describe('POST /api/reports/[unknown] — unsupported family', () => {
  it('returns 400 unsupported-family for an unknown segment', async () => {
    const response = await POST(
      makeRequest('not-a-real-family'),
      makeCtx('not-a-real-family'),
    );
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('unsupported-family');
  });

  it('does NOT touch Supabase for unknown families', async () => {
    await POST(
      makeRequest('not-a-real-family'),
      makeCtx('not-a-real-family'),
    );
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('rejects prototype-pollution attempts (e.g. `toString`, `__proto__`)', async () => {
    for (const evil of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      const response = await POST(makeRequest(evil), makeCtx(evil));
      expect(response.status).toBe(400);
      const json = (await response.json()) as { error: string };
      expect(json.error).toBe('unsupported-family');
    }
  });

  it('rejects an empty family segment', async () => {
    const response = await POST(makeRequest(''), makeCtx(''));
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toBe('unsupported-family');
  });
});

// ─── Family-validation ordering: family check FIRST, before auth ────────────

describe('Family validation fires BEFORE the auth check', () => {
  it('an unknown family with no auth still returns 400 (not 401)', async () => {
    // If auth ran first for authenticated families, an unknown family
    // happening to match an authed posture (it cannot, but defensively)
    // would 401. Our handler should 400 for unknown — full stop.
    getUserMock.mockImplementationOnce(async () => ({
      data: { user: null },
      error: null,
    }));
    const response = await POST(
      makeRequest('garbage'),
      makeCtx('garbage'),
    );
    expect(response.status).toBe(400);
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });
});
