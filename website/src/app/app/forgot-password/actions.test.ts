/**
 * Unit tests for the `/app/forgot-password` server action — Task 6.2
 * (AC-AUTH-8).
 *
 * The load-bearing property is enumeration-resistance: the response must
 * be identical for registered and unregistered emails. These tests
 * exercise both branches at the Supabase boundary and assert the action's
 * returned shape is byte-equal.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const resetMock = vi.fn();
const auditInsertMock = vi.fn(async (_row: unknown) => ({ error: null }));

let mockResetError: { message: string } | null = null;
let mockShouldThrowReset = false;
let mockAdminAvailable = true;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      resetPasswordForEmail: (email: string, opts: { redirectTo: string }) => {
        resetMock(email, opts);
        if (mockShouldThrowReset) {
          return Promise.reject(new Error('network down'));
        }
        return Promise.resolve({ data: {}, error: mockResetError });
      },
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
  headers: async () =>
    new Headers({
      origin: 'https://www.lslcalculator.com.au',
    }),
}));

const { forgotPasswordAction, FORGOT_INITIAL_STATE } = await import('./actions');

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const ENUMERATION_SAFE =
  'If that email is registered, we sent a link with instructions to reset your password.';

describe('forgotPasswordAction — Task 6.2 (AC-AUTH-8)', () => {
  beforeEach(() => {
    resetMock.mockReset();
    auditInsertMock.mockReset();
    auditInsertMock.mockResolvedValue({ error: null });
    mockResetError = null;
    mockShouldThrowReset = false;
    mockAdminAvailable = true;
  });

  it('returns the enumeration-safe message on a happy path', async () => {
    const result = await forgotPasswordAction(
      FORGOT_INITIAL_STATE,
      buildFormData({ email: 'alice@example.com' })
    );
    expect(result.message).toBe(ENUMERATION_SAFE);
    expect(result.email).toBe('alice@example.com');
  });

  it('trims the email server-side (dev-grill B4 — Supabase does not trim)', async () => {
    await forgotPasswordAction(
      FORGOT_INITIAL_STATE,
      buildFormData({ email: '  alice@example.com  ' })
    );
    expect(resetMock).toHaveBeenCalledWith(
      'alice@example.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/app/reset-password') })
    );
  });

  it('builds the redirectTo from the origin header', async () => {
    await forgotPasswordAction(
      FORGOT_INITIAL_STATE,
      buildFormData({ email: 'alice@example.com' })
    );
    expect(resetMock).toHaveBeenCalledWith(
      'alice@example.com',
      { redirectTo: 'https://www.lslcalculator.com.au/app/reset-password' }
    );
  });

  it('returns the same shape for a Supabase error (no enumeration via timing/branch)', async () => {
    mockResetError = { message: 'User not found' };
    const result = await forgotPasswordAction(
      FORGOT_INITIAL_STATE,
      buildFormData({ email: 'unknown@example.com' })
    );
    expect(result.message).toBe(ENUMERATION_SAFE);
  });

  it('returns the same shape even if Supabase throws', async () => {
    mockShouldThrowReset = true;
    const result = await forgotPasswordAction(
      FORGOT_INITIAL_STATE,
      buildFormData({ email: 'alice@example.com' })
    );
    expect(result.message).toBe(ENUMERATION_SAFE);
  });

  it('writes a password_reset_request audit row with user_id NULL and a hashed email', async () => {
    await forgotPasswordAction(
      FORGOT_INITIAL_STATE,
      buildFormData({ email: 'alice@example.com' })
    );
    expect(auditInsertMock).toHaveBeenCalledTimes(1);
    const row = auditInsertMock.mock.calls[0]?.[0] as {
      user_id: string | null;
      event_type: string;
      ip: string | null;
      user_agent: string | null;
      metadata: { email_hash: string };
    };
    expect(row.user_id).toBeNull();
    expect(row.event_type).toBe('password_reset_request');
    expect(row.ip).toBe('203.0.113.1');
    expect(row.metadata.email_hash).toMatch(/^[0-9a-f]{64}$/);
    // Hash must be deterministic + lowercase-stable.
    const { createHash } = await import('node:crypto');
    const expected = createHash('sha256').update('alice@example.com').digest('hex');
    expect(row.metadata.email_hash).toBe(expected);
  });

  it('hashes the email case-insensitively (ALICE@ === alice@)', async () => {
    await forgotPasswordAction(
      FORGOT_INITIAL_STATE,
      buildFormData({ email: 'ALICE@example.com' })
    );
    const row = auditInsertMock.mock.calls[0]?.[0] as {
      metadata: { email_hash: string };
    };
    const { createHash } = await import('node:crypto');
    const expected = createHash('sha256').update('alice@example.com').digest('hex');
    expect(row.metadata.email_hash).toBe(expected);
  });

  it('returns the same shape when the email is empty', async () => {
    const result = await forgotPasswordAction(
      FORGOT_INITIAL_STATE,
      buildFormData({ email: '' })
    );
    expect(result.message).toBe(ENUMERATION_SAFE);
    // No Supabase call on empty input — saves a wasted round-trip.
    expect(resetMock).not.toHaveBeenCalled();
  });

  it('skips the audit insert when the admin client is unavailable', async () => {
    mockAdminAvailable = false;
    const result = await forgotPasswordAction(
      FORGOT_INITIAL_STATE,
      buildFormData({ email: 'alice@example.com' })
    );
    expect(result.message).toBe(ENUMERATION_SAFE);
    expect(auditInsertMock).not.toHaveBeenCalled();
  });
});
