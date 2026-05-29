/**
 * Unit tests for the `/app/login` server action — Task 5.4
 * (AC-AUTH-4, AC-AUTH-5).
 *
 * The action is mocked at the Supabase boundary so we can exercise every
 * branch deterministically without a network call. The proxy
 * verified/unverified redirect (AC-AUTH-4 "unverified user attempting to
 * log in is auto-redirected to /app/verify-email") is covered by
 * `src/proxy.test.ts`, not here — this file scopes itself to the action's
 * own contract.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock state — each test mutates these, then imports the action so the
// stubbed Supabase client takes effect.
let mockSignInError: { message: string } | null = null;
const signInMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: (args: { email: string; password: string }) => {
        signInMock(args);
        return Promise.resolve({
          data: { user: null, session: null },
          error: mockSignInError,
        });
      },
    },
  })),
}));

// `redirect` from `next/navigation` throws a special error in production
// (NEXT_REDIRECT) to abort the action. We capture the destination via the
// thrown value so we can assert on the redirect target without booting
// the full Next.js runtime.
class RedirectError extends Error {
  constructor(public destination: string) {
    super(`NEXT_REDIRECT: ${destination}`);
  }
}
vi.mock('next/navigation', () => ({
  redirect: (destination: string) => {
    throw new RedirectError(destination);
  },
}));

const { loginAction } = await import('./actions');
const { LOGIN_INITIAL_STATE } = await import('./state');

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe('loginAction — Task 5.4 (AC-AUTH-4, AC-AUTH-5)', () => {
  beforeEach(() => {
    mockSignInError = null;
    signInMock.mockReset();
  });

  it('trims the email before passing to Supabase Auth (dev-grill B4)', async () => {
    await expect(
      loginAction(
        LOGIN_INITIAL_STATE,
        buildFormData({ email: '  alice@example.com  ', password: 'pw-12-chars!' })
      )
    ).rejects.toThrow('NEXT_REDIRECT: /app/');
    expect(signInMock).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'pw-12-chars!',
    });
  });

  it('does NOT trim the password (ASVS V2.1.4/V2.1.5 — passphrases keep whitespace)', async () => {
    await expect(
      loginAction(
        LOGIN_INITIAL_STATE,
        buildFormData({ email: 'alice@example.com', password: '  spaced phrase  ' })
      )
    ).rejects.toThrow('NEXT_REDIRECT: /app/');
    expect(signInMock).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: '  spaced phrase  ',
    });
  });

  it('redirects to /app/ on a successful signIn (proxy handles verified vs. unverified)', async () => {
    await expect(
      loginAction(
        LOGIN_INITIAL_STATE,
        buildFormData({ email: 'alice@example.com', password: 'pw-12-chars!' })
      )
    ).rejects.toThrow('NEXT_REDIRECT: /app/');
  });

  it('returns the generic error message on auth failure (AC-AUTH-5 — no enumeration)', async () => {
    mockSignInError = { message: 'Invalid login credentials' };
    const result = await loginAction(
      LOGIN_INITIAL_STATE,
      buildFormData({ email: 'alice@example.com', password: 'wrong-password!' })
    );
    expect(result.error).toBe('Email or password incorrect.');
    expect(result.email).toBe('alice@example.com');
  });

  it('uses IDENTICAL wording for unknown-email vs. wrong-password (AC-AUTH-5)', async () => {
    // Same generic message regardless of which Supabase error code came back —
    // unknown email, wrong password, locked-out, rate-limited all collapse
    // into one user-facing string. The action does NOT branch on error code.
    mockSignInError = { message: 'User not found' };
    const unknown = await loginAction(
      LOGIN_INITIAL_STATE,
      buildFormData({ email: 'ghost@example.com', password: 'pw-12-chars!' })
    );

    mockSignInError = { message: 'Invalid login credentials' };
    const wrong = await loginAction(
      LOGIN_INITIAL_STATE,
      buildFormData({ email: 'alice@example.com', password: 'wrong-password!' })
    );

    expect(unknown.error).toBe(wrong.error);
  });

  it('rejects empty fields without calling Supabase', async () => {
    const result = await loginAction(
      LOGIN_INITIAL_STATE,
      buildFormData({ email: '', password: '' })
    );
    expect(result.error).toBe('Email or password incorrect.');
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only email without calling Supabase', async () => {
    const result = await loginAction(
      LOGIN_INITIAL_STATE,
      buildFormData({ email: '   ', password: 'pw-12-chars!' })
    );
    expect(result.error).toBe('Email or password incorrect.');
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('echoes the submitted email back on failure so the form does not clear', async () => {
    mockSignInError = { message: 'Invalid login credentials' };
    const result = await loginAction(
      LOGIN_INITIAL_STATE,
      buildFormData({ email: 'alice@example.com', password: 'wrong-password!' })
    );
    expect(result.email).toBe('alice@example.com');
  });

  it('echoes the TRIMMED email back, not the raw input', async () => {
    mockSignInError = { message: 'Invalid login credentials' };
    const result = await loginAction(
      LOGIN_INITIAL_STATE,
      buildFormData({ email: '  alice@example.com  ', password: 'wrong-password!' })
    );
    expect(result.email).toBe('alice@example.com');
  });

  it('handles mixed-case emails identically to lowercase (dev-grill round-trip test)', async () => {
    // Supabase normalises to lowercase server-side; this test confirms our
    // action does not block mixed-case input before it ever reaches Supabase.
    await expect(
      loginAction(
        LOGIN_INITIAL_STATE,
        buildFormData({ email: 'ALICE@example.com', password: 'pw-12-chars!' })
      )
    ).rejects.toThrow('NEXT_REDIRECT: /app/');
    expect(signInMock).toHaveBeenCalledWith({
      email: 'ALICE@example.com',
      password: 'pw-12-chars!',
    });
  });
});
