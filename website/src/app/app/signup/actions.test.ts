/**
 * Unit tests for the `/app/signup` server action — Task 5.3
 * (AC-AUTH-1, AC-AUTH-2).
 *
 * Mocks Supabase Auth + Next.js redirect at the module boundary. The
 * atomic-org-creation behaviour belongs to the `handle_new_user` trigger
 * (Task 4.4) — those invariants are covered by
 * `src/__tests__/auth/phase4-trigger-atomicity.test.ts`. This file scopes
 * itself to the action's own contract: input handling, validation,
 * redirect, error wording.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockSignUpError: { message: string } | null = null;
const signUpMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      signUp: (args: { email: string; password: string }) => {
        signUpMock(args);
        return Promise.resolve({
          data: { user: null, session: null },
          error: mockSignUpError,
        });
      },
    },
  })),
}));

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

const { signupAction } = await import('./actions');
const { SIGNUP_INITIAL_STATE } = await import('./state');

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe('signupAction — Task 5.3 (AC-AUTH-1, AC-AUTH-2)', () => {
  beforeEach(() => {
    mockSignUpError = null;
    signUpMock.mockReset();
  });

  it('trims the email before passing to Supabase Auth (dev-grill B4)', async () => {
    await expect(
      signupAction(
        SIGNUP_INITIAL_STATE,
        buildFormData({
          email: '  alice@example.com  ',
          password: 'super-secret-12',
          confirm_password: 'super-secret-12',
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT: /app/verify-email');
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'super-secret-12',
    });
  });

  it('rejects passwords shorter than 12 characters with no Supabase call', async () => {
    const result = await signupAction(
      SIGNUP_INITIAL_STATE,
      buildFormData({
        email: 'alice@example.com',
        password: 'short',
        confirm_password: 'short',
      })
    );
    expect(result.error).toBe('Password must be at least 12 characters.');
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched confirm-password with no Supabase call', async () => {
    const result = await signupAction(
      SIGNUP_INITIAL_STATE,
      buildFormData({
        email: 'alice@example.com',
        password: 'super-secret-12',
        confirm_password: 'super-secret-13',
      })
    );
    expect(result.error).toBe('Passwords do not match.');
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('rejects obviously-malformed emails without calling Supabase', async () => {
    const result = await signupAction(
      SIGNUP_INITIAL_STATE,
      buildFormData({
        email: 'no-at-sign',
        password: 'super-secret-12',
        confirm_password: 'super-secret-12',
      })
    );
    expect(result.error).toBe('Please enter a valid email address.');
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('redirects to /app/verify-email on a successful signUp', async () => {
    await expect(
      signupAction(
        SIGNUP_INITIAL_STATE,
        buildFormData({
          email: 'alice@example.com',
          password: 'super-secret-12',
          confirm_password: 'super-secret-12',
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT: /app/verify-email');
  });

  it('redirects to /app/verify-email on the obfuscated duplicate-email branch (AC-AUTH-2)', async () => {
    // Supabase Auth applies built-in obfuscation when Confirm Email is on:
    // a duplicate signup returns no error and a fake user object. The
    // action must redirect to the same destination as a fresh signup so
    // the response is indistinguishable.
    mockSignUpError = null;
    await expect(
      signupAction(
        SIGNUP_INITIAL_STATE,
        buildFormData({
          email: 'existing@example.com',
          password: 'super-secret-12',
          confirm_password: 'super-secret-12',
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT: /app/verify-email');
  });

  it('returns a generic error if Supabase rejects (no leak of failure reason)', async () => {
    mockSignUpError = { message: 'password compromised — see HIBP' };
    const result = await signupAction(
      SIGNUP_INITIAL_STATE,
      buildFormData({
        email: 'alice@example.com',
        password: 'super-secret-12',
        confirm_password: 'super-secret-12',
      })
    );
    expect(result.error).toBe('We could not create your account. Please try again.');
    expect(result.email).toBe('alice@example.com');
  });

  it('echoes the trimmed email back on validation failure so the form does not clear', async () => {
    const result = await signupAction(
      SIGNUP_INITIAL_STATE,
      buildFormData({
        email: '  alice@example.com  ',
        password: 'short',
        confirm_password: 'short',
      })
    );
    expect(result.email).toBe('alice@example.com');
    expect(result.error).toBe('Password must be at least 12 characters.');
  });

  it('preserves a password containing spaces (ASVS V2.1.4/V2.1.5)', async () => {
    await expect(
      signupAction(
        SIGNUP_INITIAL_STATE,
        buildFormData({
          email: 'alice@example.com',
          password: 'correct horse battery staple',
          confirm_password: 'correct horse battery staple',
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT: /app/verify-email');
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'correct horse battery staple',
    });
  });
});
