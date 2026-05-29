/**
 * Unit tests for the `/app/verify-email` resend server action — Task 6.1
 * (AC-AUTH-3a resend branch).
 *
 * Boundaries mocked:
 *   - `@/lib/supabase/server`         — server SSR client (getUser, resend)
 *   - `@/lib/supabase/admin`          — service-role client + fingerprint reader
 *   - `@/lib/auth/rate-limit`         — quota check + audit-log writer
 *   - `next/headers`                  — returns an empty Headers
 *
 * The Phase 4 / Phase 6 integration tests in __tests__/auth/ exercise the
 * real Supabase boundary; this file scopes itself to the action's branching
 * contract: verified short-circuit, missing-user fail-safe, daily-cap hit,
 * Supabase cooldown hit, success path.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────────────────
// Mock state — mutated per test before importing the action.
// ───────────────────────────────────────────────────────────────────────────
let mockUser: { id: string; email: string; email_confirmed_at: string | null } | null = null;
let mockGetUserError: { message: string } | null = null;
let mockResendError: { message: string; status?: number; code?: string } | null = null;
let mockQuotaAllowed = true;
let mockQuotaRetryAfter: number | null = null;
let mockAdminAvailable = true;

const resendMock = vi.fn();
const recordResendMock = vi.fn(async () => {});

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: mockGetUserError,
      }),
      resend: (args: {
        type: string;
        email: string;
        options?: { emailRedirectTo?: string };
      }) => {
        resendMock(args);
        return Promise.resolve({ data: {}, error: mockResendError });
      },
    },
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => (mockAdminAvailable ? { sentinel: 'admin' } : null),
  readClientFingerprint: () => ({ ip: '203.0.113.1', userAgent: 'vitest' }),
}));

vi.mock('@/lib/auth/rate-limit', () => ({
  checkVerificationResendQuota: vi.fn(async () => {
    if (mockQuotaAllowed) return { allowed: true, remaining: 4 };
    return {
      allowed: false,
      reason: 'daily_cap_exceeded' as const,
      retryAfterSeconds: mockQuotaRetryAfter,
    };
  }),
  recordVerificationResend: recordResendMock,
  formatRetryAfter: (seconds: number) => {
    if (seconds < 60) return `in ${seconds} seconds`;
    if (seconds < 3600) return `in ${Math.ceil(seconds / 60)} minutes`;
    return `in ${Math.ceil(seconds / 3600)} hours`;
  },
  VERIFICATION_RESEND_DAILY_CAP: 5,
  VERIFICATION_RESEND_EVENT: 'verification_resend',
}));

// The resend action reads `headers().get('origin')` to build the
// `emailRedirectTo` URL. Provide a stable origin in tests so the assertion
// on the resend call args is deterministic.
const TEST_ORIGIN = 'https://test.lslcalculator.com.au';
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ origin: TEST_ORIGIN }),
}));

const { resendVerificationAction } = await import('./actions');
const { RESEND_INITIAL_STATE } = await import('./state');

function emptyFormData(): FormData {
  return new FormData();
}

describe('resendVerificationAction — Task 6.1 (AC-AUTH-3a)', () => {
  beforeEach(() => {
    mockUser = {
      id: 'user-1',
      email: 'alice@example.com',
      email_confirmed_at: null,
    };
    mockGetUserError = null;
    mockResendError = null;
    mockQuotaAllowed = true;
    mockQuotaRetryAfter = null;
    mockAdminAvailable = true;
    resendMock.mockReset();
    recordResendMock.mockReset();
    recordResendMock.mockImplementation(async () => {});
  });

  it('returns a success status when Supabase accepts the resend', async () => {
    const result = await resendVerificationAction(RESEND_INITIAL_STATE, emptyFormData());
    expect(result.status?.kind).toBe('success');
    expect(resendMock).toHaveBeenCalledWith({
      type: 'signup',
      email: 'alice@example.com',
      options: { emailRedirectTo: `${TEST_ORIGIN}/app/` },
    });
  });

  it('records a verification_resend audit row on success', async () => {
    await resendVerificationAction(RESEND_INITIAL_STATE, emptyFormData());
    expect(recordResendMock).toHaveBeenCalledTimes(1);
    expect(recordResendMock).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { ip: '203.0.113.1', userAgent: 'vitest' }
    );
  });

  it('short-circuits when the user is already verified (no Supabase resend call)', async () => {
    mockUser = {
      id: 'user-1',
      email: 'alice@example.com',
      email_confirmed_at: '2026-05-26T00:00:00Z',
    };
    const result = await resendVerificationAction(RESEND_INITIAL_STATE, emptyFormData());
    expect(result.status?.kind).toBe('success');
    expect(result.status?.message).toMatch(/already verified/i);
    expect(resendMock).not.toHaveBeenCalled();
    expect(recordResendMock).not.toHaveBeenCalled();
  });

  it('returns a generic error when getUser() returns no user', async () => {
    mockUser = null;
    const result = await resendVerificationAction(RESEND_INITIAL_STATE, emptyFormData());
    expect(result.status?.kind).toBe('error');
    expect(resendMock).not.toHaveBeenCalled();
  });

  it('returns the daily-cap message when quota is exceeded — does NOT call Supabase', async () => {
    mockQuotaAllowed = false;
    mockQuotaRetryAfter = 24 * 60 * 60;
    const result = await resendVerificationAction(RESEND_INITIAL_STATE, emptyFormData());
    expect(result.status?.kind).toBe('error');
    expect(result.status?.message).toMatch(/daily limit/i);
    expect(resendMock).not.toHaveBeenCalled();
    expect(recordResendMock).not.toHaveBeenCalled();
  });

  it('maps Supabase 429 / over_email_send_rate_limit to a cooldown message', async () => {
    mockResendError = {
      message: 'For security purposes, you can only request this after 60 seconds.',
      status: 429,
      code: 'over_email_send_rate_limit',
    };
    const result = await resendVerificationAction(RESEND_INITIAL_STATE, emptyFormData());
    expect(result.status?.kind).toBe('error');
    expect(result.status?.message).toMatch(/another verification email/i);
    // The formatter rounds 60s up to "1 minute" — both are acceptable as
    // cooldown wording per spec §7.5.
    expect(result.status?.message).toMatch(/(60 seconds|1 minute)/);
    // Audit row must NOT be written on failure — that would skew the daily count.
    expect(recordResendMock).not.toHaveBeenCalled();
  });

  it('returns a generic error for any other Supabase error', async () => {
    mockResendError = { message: 'SMTP failure', status: 500 };
    const result = await resendVerificationAction(RESEND_INITIAL_STATE, emptyFormData());
    expect(result.status?.kind).toBe('error');
    expect(result.status?.message).toMatch(/could not send/i);
    expect(recordResendMock).not.toHaveBeenCalled();
  });

  it('falls through gracefully when the admin client is unavailable (no service-role key)', async () => {
    // Quota check is skipped, audit insert is skipped, but the resend still
    // happens — degrade gracefully so a misconfigured local env doesn't break
    // signup. Supabase's 1-per-60s cap is still in force.
    mockAdminAvailable = false;
    const result = await resendVerificationAction(RESEND_INITIAL_STATE, emptyFormData());
    expect(result.status?.kind).toBe('success');
    expect(resendMock).toHaveBeenCalled();
    expect(recordResendMock).not.toHaveBeenCalled();
  });
});
