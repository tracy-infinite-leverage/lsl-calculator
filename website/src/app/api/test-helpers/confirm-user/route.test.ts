/**
 * Unit tests for `/api/test-helpers/confirm-user` — Task 5.8.
 *
 * Hard-gate is the load-bearing thing. The test surface mirrors the gate's
 * branches one-for-one:
 *
 *   1. VERCEL_ENV=production → 404 (even with valid token)
 *   2. CI_TEST_HELPER_TOKEN unset → 404
 *   3. missing Authorization → 404
 *   4. wrong Authorization → 404
 *   5. valid token + valid body + user found → 204
 *   6. valid token + valid body + user NOT found → 404 (different reason)
 *   7. valid token + malformed body → 400
 *   8. valid token + missing email field → 400
 *   9. valid token + invalid email → 400
 *  10. non-POST verbs (GET/HEAD/PUT/DELETE/PATCH/OPTIONS) → 404
 *  11. supabase admin env missing → 500 (server misconfig, NOT 404 — we want
 *      this to be loud since the gate has already accepted the request)
 *  12. audit row insert failure → still 204 (best-effort)
 *  13. successful path also writes an event_type='test_helper_confirm_user' row
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks ---------------------------------------------------------------------

const listUsersMock = vi.fn();
const updateUserByIdMock = vi.fn();
const auditInsertMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        listUsers: listUsersMock,
        updateUserById: updateUserByIdMock,
      },
    },
    from: () => ({ insert: auditInsertMock }),
  })),
}));

const TEST_TOKEN = 'ci-test-helper-secret-value-32bytes-hex';
const TEST_EMAIL = 'e2e-test-user@playwright.test.lslcalculator.com.au';
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';

// Env helpers ---------------------------------------------------------------

function setBaseEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  process.env.CI_TEST_HELPER_TOKEN = TEST_TOKEN;
  delete process.env.VERCEL_ENV;
}

function clearEnv() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.CI_TEST_HELPER_TOKEN;
  delete process.env.VERCEL_ENV;
}

function makeRequest(opts: {
  method?: string;
  authHeader?: string | null;
  body?: unknown;
} = {}): NextRequest {
  const method = opts.method ?? 'POST';
  const headers = new Headers();
  if (opts.authHeader !== null && opts.authHeader !== undefined) {
    headers.set('authorization', opts.authHeader);
  }
  headers.set('user-agent', 'vitest');

  let bodyInit: string | undefined;
  if (opts.body !== undefined) {
    bodyInit =
      typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    headers.set('content-type', 'application/json');
  }

  // NextRequest's typed `RequestInit` differs from the global one (signal
  // can't be null). The minimal escape hatch is to cast the init bag — we
  // only ever pass shapes the Next type happily accepts.
  const init = {
    method,
    headers,
    ...(bodyInit !== undefined ? { body: bodyInit, duplex: 'half' } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return new NextRequest(
    new URL('http://localhost/api/test-helpers/confirm-user'),
    init
  );
}

// Tests ---------------------------------------------------------------------

describe('/api/test-helpers/confirm-user — Task 5.8 gate + behaviour', () => {
  beforeEach(() => {
    listUsersMock.mockReset();
    updateUserByIdMock.mockReset();
    auditInsertMock.mockReset();
    // Default happy-path: user exists, update succeeds, audit succeeds.
    listUsersMock.mockResolvedValue({
      data: {
        users: [
          {
            id: TEST_USER_ID,
            email: TEST_EMAIL,
          },
        ],
      },
      error: null,
    });
    updateUserByIdMock.mockResolvedValue({ data: { user: {} }, error: null });
    auditInsertMock.mockResolvedValue({ error: null });
    setBaseEnv();
  });

  describe('Gate refusals (always return 404 — no acknowledgment)', () => {
    it('returns 404 when VERCEL_ENV=production, even with valid token', async () => {
      process.env.VERCEL_ENV = 'production';
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { email: TEST_EMAIL },
        })
      );
      expect(res.status).toBe(404);
      // Side effects must NOT fire.
      expect(listUsersMock).not.toHaveBeenCalled();
      expect(updateUserByIdMock).not.toHaveBeenCalled();
      expect(auditInsertMock).not.toHaveBeenCalled();
    });

    it('returns 404 when CI_TEST_HELPER_TOKEN is unset, regardless of header', async () => {
      delete process.env.CI_TEST_HELPER_TOKEN;
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: 'Bearer anything-at-all',
          body: { email: TEST_EMAIL },
        })
      );
      expect(res.status).toBe(404);
      expect(listUsersMock).not.toHaveBeenCalled();
    });

    it('returns 404 when Authorization header is missing', async () => {
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({ authHeader: null, body: { email: TEST_EMAIL } })
      );
      expect(res.status).toBe(404);
      expect(listUsersMock).not.toHaveBeenCalled();
    });

    it('returns 404 when Authorization header has wrong token', async () => {
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: 'Bearer not-the-right-token',
          body: { email: TEST_EMAIL },
        })
      );
      expect(res.status).toBe(404);
      expect(listUsersMock).not.toHaveBeenCalled();
    });

    it('returns 404 when Authorization scheme is not Bearer (raw token)', async () => {
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: TEST_TOKEN, // missing "Bearer " prefix
          body: { email: TEST_EMAIL },
        })
      );
      expect(res.status).toBe(404);
    });
  });

  describe('Body validation (caller is authorised — honest 400s)', () => {
    it('returns 400 on malformed JSON', async () => {
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: 'not-json{{',
        })
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when body lacks an email field', async () => {
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { something_else: true },
        })
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when email is not a string', async () => {
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { email: 123 },
        })
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when email is empty / no @', async () => {
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { email: 'no-at-sign' },
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe('Success path', () => {
    it('returns 204 on successful confirm + writes audit row', async () => {
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { email: TEST_EMAIL },
        })
      );
      expect(res.status).toBe(204);
      expect(updateUserByIdMock).toHaveBeenCalledWith(TEST_USER_ID, {
        email_confirm: true,
      });
      expect(auditInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: TEST_USER_ID,
          event_type: 'test_helper_confirm_user',
        })
      );
    });

    it('matches the user by case-insensitive email (round-trip safety)', async () => {
      listUsersMock.mockResolvedValueOnce({
        data: { users: [{ id: TEST_USER_ID, email: TEST_EMAIL }] },
        error: null,
      });
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { email: TEST_EMAIL.toUpperCase() },
        })
      );
      expect(res.status).toBe(204);
      expect(updateUserByIdMock).toHaveBeenCalledWith(TEST_USER_ID, {
        email_confirm: true,
      });
    });

    it('still returns 204 when audit insert fails (best-effort audit)', async () => {
      auditInsertMock.mockResolvedValueOnce({
        error: { message: 'audit-table-down' },
      });
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { email: TEST_EMAIL },
        })
      );
      expect(res.status).toBe(204);
    });
  });

  describe('Error path', () => {
    it('returns 404 when the user does not exist (different reason from gate-404)', async () => {
      listUsersMock.mockResolvedValueOnce({
        data: { users: [] },
        error: null,
      });
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { email: 'nobody@example.com' },
        })
      );
      expect(res.status).toBe(404);
      expect(updateUserByIdMock).not.toHaveBeenCalled();
    });

    it('returns 500 when admin.updateUserById fails', async () => {
      updateUserByIdMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'auth-api-down' },
      });
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { email: TEST_EMAIL },
        })
      );
      expect(res.status).toBe(500);
    });

    it('returns 500 when Supabase admin env vars are missing (loud failure, gate already passed)', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { email: TEST_EMAIL },
        })
      );
      expect(res.status).toBe(500);
    });
  });

  describe('Method handling', () => {
    it.each(['GET', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const)(
      '%s returns 404 (route-existence-denial pattern)',
      async (verb) => {
        const mod = await import('./route');
        const handler = (mod as unknown as Record<string, () => Promise<Response> | Response>)[verb];
        expect(handler).toBeDefined();
        const res = await handler();
        expect(res.status).toBe(404);
      }
    );
  });

  describe('Cleanup — env state', () => {
    it('clearing env keeps the gate closed', async () => {
      clearEnv();
      const { POST } = await import('./route');
      const res = await POST(
        makeRequest({
          authHeader: `Bearer ${TEST_TOKEN}`,
          body: { email: TEST_EMAIL },
        })
      );
      expect(res.status).toBe(404);
    });
  });
});
