/**
 * Unit tests for the Next.js 16 proxy (`src/proxy.ts`).
 *
 * Validates AC-AUTH-3a (the spec's load-bearing unverified-gate requirement)
 * and AC-AUTH-4 (unverified-on-login redirect path).
 *
 * Mocks the SSR helper at the module boundary so each branch can be exercised
 * with deterministic auth state. The full e2e signup→verify→home path is
 * covered by Playwright in Task 5.8.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Holders the test mutates per case before importing the proxy.
let mockUser: { email_confirmed_at: string | null } | null = null;
let mockShouldThrow = false;
let mockCookiesToReturn: { name: string; value: string }[] = [];

vi.mock('@/lib/supabase/middleware', () => ({
  createSupabaseProxyClient: () => ({
    supabase: {
      auth: {
        getUser: async () => {
          if (mockShouldThrow) {
            throw new Error('Supabase Auth outage');
          }
          return { data: { user: mockUser }, error: null };
        },
      },
    },
    getResponse: () => {
      const response = NextResponse.next();
      mockCookiesToReturn.forEach(({ name, value }) => {
        response.cookies.set(name, value);
      });
      return response;
    },
  }),
}));

// Imported AFTER the mock so the proxy picks up the stubbed helper.
const { proxy } = await import('./proxy');

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`));
}

describe('proxy — Task 5.2 (AC-AUTH-3a, AC-AUTH-4)', () => {
  beforeEach(() => {
    mockUser = null;
    mockShouldThrow = false;
    mockCookiesToReturn = [];
  });

  describe('Case 1 — no session', () => {
    it.each([
      '/app/signup',
      '/app/login',
      '/app/forgot-password',
      '/app/reset-password',
      '/app/verify-email',
    ])('passes through public-auth route %s', async (path) => {
      mockUser = null;
      const response = await proxy(makeRequest(path));
      expect(response.status).toBe(200);
    });

    it('redirects /app/foo to /app/login', async () => {
      mockUser = null;
      const response = await proxy(makeRequest('/app/foo'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost/app/login');
    });

    it('redirects /app/ (no path) to /app/login', async () => {
      mockUser = null;
      const response = await proxy(makeRequest('/app/'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost/app/login');
    });

    it('redirects /app/account to /app/login (not in public-auth list)', async () => {
      mockUser = null;
      const response = await proxy(makeRequest('/app/account'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost/app/login');
    });
  });

  describe('Case 2 — session, unverified email (email_confirmed_at IS NULL)', () => {
    beforeEach(() => {
      mockUser = { email_confirmed_at: null };
    });

    it.each(['/app/verify-email', '/app/account', '/app/logout'])(
      'passes through allow-listed route %s',
      async (path) => {
        const response = await proxy(makeRequest(path));
        expect(response.status).toBe(200);
      }
    );

    it('redirects /app/ to /app/verify-email (not in allow-list)', async () => {
      const response = await proxy(makeRequest('/app/'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost/app/verify-email');
    });

    it('redirects /app/foo to /app/verify-email', async () => {
      const response = await proxy(makeRequest('/app/foo'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost/app/verify-email');
    });

    it('redirects /app/signup to /app/verify-email (signup not relevant for verified session)', async () => {
      // Even though /app/signup is public-auth, a logged-in-but-unverified user
      // hitting it should be sent to verify-email — they have a session and the
      // unverified branch wins.
      const response = await proxy(makeRequest('/app/signup'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost/app/verify-email');
    });
  });

  describe('Case 3 — session + verified', () => {
    beforeEach(() => {
      mockUser = { email_confirmed_at: '2026-05-26T00:00:00Z' };
    });

    it.each(['/app/', '/app/foo', '/app/account', '/app/login', '/app/anything'])(
      'passes through %s',
      async (path) => {
        const response = await proxy(makeRequest(path));
        expect(response.status).toBe(200);
      }
    );
  });

  describe('Case 4 — Supabase Auth throws (outage)', () => {
    it('redirects to /app/login?error=service_unavailable on any path', async () => {
      mockShouldThrow = true;
      const response = await proxy(makeRequest('/app/foo'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'http://localhost/app/login?error=service_unavailable'
      );
    });

    it('never returns a 500 even when Supabase throws on /app/login itself', async () => {
      mockShouldThrow = true;
      const response = await proxy(makeRequest('/app/login'));
      // Even on /app/login, we still redirect with the error flag attached
      // (so the page can render a banner). Never 500.
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('error=service_unavailable');
    });
  });

  describe('Cookie preservation on redirect (dev-grill: prevents refresh-loops)', () => {
    it('preserves cookies written by the SSR helper onto the redirect response', async () => {
      mockUser = null; // triggers redirect to /app/login
      mockCookiesToReturn = [
        { name: 'sb-access-token', value: 'refreshed-access-token-value' },
        { name: 'sb-refresh-token', value: 'refreshed-refresh-token-value' },
      ];
      const response = await proxy(makeRequest('/app/foo'));
      expect(response.status).toBe(307);
      const accessCookie = response.cookies.get('sb-access-token');
      const refreshCookie = response.cookies.get('sb-refresh-token');
      expect(accessCookie?.value).toBe('refreshed-access-token-value');
      expect(refreshCookie?.value).toBe('refreshed-refresh-token-value');
    });

    it('preserves cookies on the supabase-outage redirect too', async () => {
      mockShouldThrow = true;
      mockCookiesToReturn = [{ name: 'sb-foo', value: 'bar' }];
      const response = await proxy(makeRequest('/app/foo'));
      expect(response.cookies.get('sb-foo')?.value).toBe('bar');
    });
  });

  describe('Matcher config', () => {
    it('exports the literal matcher /app/:path* (dev-grill B1 — public calc must not match)', async () => {
      const proxyModule = await import('./proxy');
      expect(proxyModule.config).toEqual({ matcher: ['/app/:path*'] });
    });
  });
});
