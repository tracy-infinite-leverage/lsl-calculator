/**
 * Unit tests for the `/app/logout` route — Task 5.5 (AC-AUTH-7).
 *
 * Mocks both Supabase clients (SSR helper + service-role admin) at module
 * boundary. Asserts:
 *   - POST → 303 redirect to /app/login (canonical POST→GET pattern).
 *   - GET / HEAD / PUT / DELETE / PATCH / OPTIONS → 405 + Allow: POST.
 *   - signOut is called.
 *   - Audit row insertion uses event_type='logout' and event flows through
 *     even when getUser() fails (defence in depth).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const signOutMock = vi.fn(async () => ({ error: null }));
type GetUserResult = {
  data: { user: { id: string } | null };
  error: null;
};
const getUserMock = vi.fn<() => Promise<GetUserResult>>(async () => ({
  data: { user: { id: 'user-1' } },
  error: null,
}));
const insertMock = vi.fn(async () => ({ error: null }));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
      signOut: signOutMock,
    },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({ insert: insertMock }),
  })),
}));

// Ensure env vars are set so the service-role audit branch fires; the
// values are dummies — the mock above intercepts before any real call.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-test-key';

const { POST, GET, HEAD, PUT, DELETE, PATCH, OPTIONS } = await import('./route');

function makeRequest(method: string): NextRequest {
  return new NextRequest(new URL('http://localhost/app/logout'), { method });
}

describe('/app/logout — Task 5.5 (AC-AUTH-7)', () => {
  beforeEach(() => {
    signOutMock.mockClear();
    getUserMock.mockClear();
    insertMock.mockClear();
    // Reset to default-success implementations
    getUserMock.mockImplementation(async () => ({
      data: { user: { id: 'user-1' } },
      error: null,
    }));
    signOutMock.mockImplementation(async () => ({ error: null }));
    insertMock.mockImplementation(async () => ({ error: null }));
  });

  describe('POST', () => {
    it('returns 303 redirect to /app/login', async () => {
      const response = await POST(makeRequest('POST'));
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('http://localhost/app/login');
    });

    it('calls supabase.auth.signOut()', async () => {
      await POST(makeRequest('POST'));
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });

    it('writes an auth_audit_log row with event_type=logout for the current user', async () => {
      await POST(makeRequest('POST'));
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          event_type: 'logout',
        })
      );
    });

    it('still returns 303 even when signOut() throws (logout must never fail)', async () => {
      signOutMock.mockImplementationOnce(async () => {
        throw new Error('Supabase outage');
      });
      const response = await POST(makeRequest('POST'));
      expect(response.status).toBe(303);
    });

    it('still returns 303 when getUser() throws (defence in depth)', async () => {
      getUserMock.mockImplementationOnce(async () => {
        throw new Error('Supabase outage');
      });
      const response = await POST(makeRequest('POST'));
      expect(response.status).toBe(303);
      // No audit row written when user id is unknown.
      expect(insertMock).not.toHaveBeenCalled();
    });

    it('skips the audit insert when no user is logged in (no user_id to attribute)', async () => {
      getUserMock.mockImplementationOnce(async () => ({
        data: { user: null },
        error: null,
      }));
      const response = await POST(makeRequest('POST'));
      expect(response.status).toBe(303);
      expect(insertMock).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ['GET', GET],
    ['HEAD', HEAD],
    ['PUT', PUT],
    ['DELETE', DELETE],
    ['PATCH', PATCH],
    ['OPTIONS', OPTIONS],
  ])('%s', (method, handler) => {
    it(`returns 405 with Allow: POST header`, async () => {
      const response = await handler();
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
    });
  });
});
