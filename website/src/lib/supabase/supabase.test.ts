/**
 * Unit tests for the three Supabase client factories.
 *
 * Validates Task 5.1 acceptance criteria:
 *   - Three helpers exist with the canonical `@supabase/ssr` shape.
 *   - All env-var reads go through `process.env.NEXT_PUBLIC_SUPABASE_*`.
 *   - Each helper returns a Supabase client instance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_URL = 'https://test-project.supabase.co';
const TEST_ANON = 'test-anon-key';

describe('supabase helpers — Task 5.1', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = TEST_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = TEST_ANON;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('createSupabaseBrowserClient', () => {
    it('returns a SupabaseClient instance with an auth surface', async () => {
      const { createSupabaseBrowserClient } = await import('./client');
      const client = createSupabaseBrowserClient();
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      // The auth surface is what every auth-related task uses; the gate at
      // AC-AUTH-3a leans on `getUser()` specifically.
      expect(typeof client.auth.getUser).toBe('function');
    });

    it('throws a clear error when env vars are missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const { createSupabaseBrowserClient } = await import('./client');
      expect(() => createSupabaseBrowserClient()).toThrow(/Supabase environment variables/);
    });
  });

  describe('createSupabaseServerClient', () => {
    it('returns a SupabaseClient instance using Next.js async cookies()', async () => {
      vi.doMock('next/headers', () => ({
        cookies: async () => ({
          getAll: () => [],
          set: () => undefined,
        }),
      }));

      const { createSupabaseServerClient } = await import('./server');
      const client = await createSupabaseServerClient();
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      expect(typeof client.auth.getUser).toBe('function');

      vi.doUnmock('next/headers');
    });

    it('throws a clear error when env vars are missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      vi.doMock('next/headers', () => ({
        cookies: async () => ({ getAll: () => [], set: () => undefined }),
      }));
      const { createSupabaseServerClient } = await import('./server');
      await expect(createSupabaseServerClient()).rejects.toThrow(/Supabase environment variables/);
      vi.doUnmock('next/headers');
    });
  });

  describe('createSupabaseProxyClient', () => {
    /**
     * Construct a minimal NextRequest-like object that satisfies the proxy
     * helper's cookie reads. NextRequest is a Web Fetch Request subclass; we
     * provide the shape, not the full implementation.
     */
    function makeFakeRequest() {
      const cookieJar = new Map<string, string>();
      return {
        cookies: {
          getAll: () =>
            Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value })),
          set: (name: string, value: string) => {
            cookieJar.set(name, value);
          },
        },
        // Properties NextResponse.next() pokes at when given the request.
        headers: new Headers(),
        nextUrl: new URL(TEST_URL),
        url: TEST_URL,
      };
    }

    it('returns a SupabaseClient instance and a response accessor', async () => {
      const { createSupabaseProxyClient } = await import('./middleware');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { supabase, getResponse } = createSupabaseProxyClient(makeFakeRequest() as any);
      expect(supabase).toBeDefined();
      expect(supabase.auth).toBeDefined();
      expect(typeof supabase.auth.getUser).toBe('function');
      expect(typeof getResponse).toBe('function');
      const response = getResponse();
      // NextResponse extends the standard Response, so it carries `headers`.
      expect(response).toBeDefined();
      expect(response.headers).toBeDefined();
    });

    it('throws a clear error when env vars are missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const { createSupabaseProxyClient } = await import('./middleware');
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createSupabaseProxyClient(makeFakeRequest() as any)
      ).toThrow(/Supabase environment variables/);
    });
  });
});
