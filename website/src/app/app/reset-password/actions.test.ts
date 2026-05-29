/**
 * Unit tests for the `/app/reset-password` server action — Task 6.3
 * (AC-AUTH-9, AC-AUTH-10).
 *
 * Boundaries mocked at the Supabase + admin client. The "expired/used
 * token" property is covered at the page level (Supabase's
 * `exchangeCodeForSession` is the gatekeeper); this file scopes itself
 * to the action's own validation + sign-out + audit contract.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockUser: { id: string } | null = null;
let mockUpdateError: { message: string; code?: string } | null = null;
let mockAdminAvailable = true;

const updateMock = vi.fn();
const signOutMock = vi.fn(async () => ({ error: null }));
const auditInsertMock = vi.fn(async (_row: unknown) => ({ error: null }));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: mockUser ? null : { message: 'no session' },
      }),
      updateUser: (args: { password: string }) => {
        updateMock(args);
        return Promise.resolve({ data: {}, error: mockUpdateError });
      },
      signOut: signOutMock,
    },
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () =>
    mockAdminAvailable
      ? {
          from: () => ({
            insert: (row: unknown) => auditInsertMock(row),
          }),
        }
      : null,
  readClientFingerprint: () => ({ ip: '203.0.113.1', userAgent: 'vitest' }),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
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

const { resetPasswordAction, RESET_INITIAL_STATE } = await import('./actions');

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe('resetPasswordAction — Task 6.3 (AC-AUTH-9, AC-AUTH-10)', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1' };
    mockUpdateError = null;
    mockAdminAvailable = true;
    updateMock.mockReset();
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({ error: null });
    auditInsertMock.mockReset();
    auditInsertMock.mockResolvedValue({ error: null });
  });

  it('rejects passwords shorter than 12 chars without calling Supabase', async () => {
    const result = await resetPasswordAction(
      RESET_INITIAL_STATE,
      buildFormData({ password: 'short', confirm_password: 'short' })
    );
    expect(result.error).toMatch(/at least 12 characters/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords without calling Supabase', async () => {
    const result = await resetPasswordAction(
      RESET_INITIAL_STATE,
      buildFormData({
        password: 'pw-12-chars-aaa',
        confirm_password: 'pw-12-chars-bbb',
      })
    );
    expect(result.error).toMatch(/do not match/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('redirects to /app/login?reset=success on a successful update', async () => {
    await expect(
      resetPasswordAction(
        RESET_INITIAL_STATE,
        buildFormData({
          password: 'pw-12-chars-aaa',
          confirm_password: 'pw-12-chars-aaa',
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT: /app/login?reset=success');
    expect(updateMock).toHaveBeenCalledWith({ password: 'pw-12-chars-aaa' });
  });

  it('invalidates all OTHER sessions on success (AC-AUTH-9)', async () => {
    await expect(
      resetPasswordAction(
        RESET_INITIAL_STATE,
        buildFormData({
          password: 'pw-12-chars-aaa',
          confirm_password: 'pw-12-chars-aaa',
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT');
    // One call with { scope: 'others' } and one with default scope (local).
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'others' });
    expect(signOutMock).toHaveBeenCalledWith();
  });

  it('writes a password_reset_complete audit row on success', async () => {
    await expect(
      resetPasswordAction(
        RESET_INITIAL_STATE,
        buildFormData({
          password: 'pw-12-chars-aaa',
          confirm_password: 'pw-12-chars-aaa',
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(auditInsertMock).toHaveBeenCalledTimes(1);
    const row = auditInsertMock.mock.calls[0]?.[0] as {
      user_id: string;
      event_type: string;
    };
    expect(row.user_id).toBe('user-1');
    expect(row.event_type).toBe('password_reset_complete');
  });

  it('returns the generic error when no session exists', async () => {
    mockUser = null;
    const result = await resetPasswordAction(
      RESET_INITIAL_STATE,
      buildFormData({
        password: 'pw-12-chars-aaa',
        confirm_password: 'pw-12-chars-aaa',
      })
    );
    expect(result.error).toMatch(/could not reset/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns a breach-list message on weak_password error', async () => {
    mockUpdateError = {
      message: 'Password is known to be compromised',
      code: 'weak_password',
    };
    const result = await resetPasswordAction(
      RESET_INITIAL_STATE,
      buildFormData({
        password: 'password1234',
        confirm_password: 'password1234',
      })
    );
    expect(result.error).toMatch(/breach list/i);
    expect(signOutMock).not.toHaveBeenCalled();
    expect(auditInsertMock).not.toHaveBeenCalled();
  });

  it('returns a same-password message on same_password error', async () => {
    mockUpdateError = {
      message: 'New password should be different from the old one',
      code: 'same_password',
    };
    const result = await resetPasswordAction(
      RESET_INITIAL_STATE,
      buildFormData({
        password: 'pw-12-chars-aaa',
        confirm_password: 'pw-12-chars-aaa',
      })
    );
    expect(result.error).toMatch(/different from your previous one/i);
  });

  it('returns the generic error for any other Supabase error', async () => {
    mockUpdateError = { message: 'network' };
    const result = await resetPasswordAction(
      RESET_INITIAL_STATE,
      buildFormData({
        password: 'pw-12-chars-aaa',
        confirm_password: 'pw-12-chars-aaa',
      })
    );
    expect(result.error).toMatch(/could not reset/i);
  });
});
