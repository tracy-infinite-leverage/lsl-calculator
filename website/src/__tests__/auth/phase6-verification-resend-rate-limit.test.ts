// Phase 6 / Task 6.6 — verification-resend rate-limit integration tests.
//
// Validates AC-AUTH-3a (rate limit half): the application-side 5-per-24h
// cap on verification-email resends. The 1-per-60s cap is enforced by
// Supabase Auth itself (no app code path to test); the 5-per-24h cap lives
// in `src/lib/auth/rate-limit.ts` and uses `public.auth_audit_log` as the
// counter (one `event_type='verification_resend'` row per successful resend).
//
// Strategy:
//   1. Create a test user via the admin API.
//   2. Insert N `verification_resend` audit rows for that user with
//      `created_at` inside the 24h window.
//   3. Call `checkVerificationResendQuota` and assert the decision against
//      the spec contract:
//        - N=0  → allowed, remaining=5
//        - N=4  → allowed, remaining=1
//        - N=5  → DENIED (daily cap exceeded)
//        - N=6  → DENIED (still over)
//   4. Insert one row OUTSIDE the 24h window and assert it doesn't count.
//
// Why this complements the unit tests at
// `website/src/app/app/verify-email/actions.test.ts`:
//   The action tests mock `checkVerificationResendQuota` and assert the
//   action's branching. THIS file tests the helper itself against a real
//   PostgreSQL/PostgREST query — so a regression in the row-count predicate
//   (wrong column name, wrong interval, wrong event_type literal) surfaces
//   here even when the action tests pass.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseEnvConfigured,
  supabaseEnvMissingInCI,
} from './_helpers';
import {
  checkVerificationResendQuota,
  VERIFICATION_RESEND_DAILY_CAP,
  VERIFICATION_RESEND_EVENT,
  recordVerificationResend,
} from '@/lib/auth/rate-limit';

if (supabaseEnvMissingInCI()) {
  throw new Error(
    'Phase 6 rate-limit integration tests are required in CI but the Supabase ' +
      'env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL, ' +
      'SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SUPABASE_ANON_KEY as CI ' +
      'secrets pointing at the lsl-platform project.'
  );
}

/**
 * Insert `n` `verification_resend` audit rows for the given user with the
 * supplied `created_at` timestamp. Service-role only — `auth_audit_log`
 * has no client policies (spec §9.4).
 */
async function seedResendAuditRows(
  admin: SupabaseClient,
  userId: string,
  n: number,
  createdAt: Date
): Promise<void> {
  if (n === 0) return;
  const rows = Array.from({ length: n }, (_, i) => ({
    user_id: userId,
    event_type: VERIFICATION_RESEND_EVENT,
    ip: '203.0.113.1',
    user_agent: `phase6-rate-limit-test-${i}`,
    metadata: { seeded: true, idx: i },
    created_at: createdAt.toISOString(),
  }));
  const { error } = await admin.from('auth_audit_log').insert(rows);
  if (error) throw new Error(`seedResendAuditRows insert failed: ${error.message}`);
}

/**
 * Wipe ALL `verification_resend` audit rows for the user — keeps tests
 * isolated when they share a single createTestUser fixture would cost an
 * extra signup. We don't share, but this keeps the cleanup explicit.
 */
async function clearResendAuditRows(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  await admin
    .from('auth_audit_log')
    .delete()
    .eq('user_id', userId)
    .eq('event_type', VERIFICATION_RESEND_EVENT);
}

describe.skipIf(!supabaseEnvConfigured())(
  'Phase 6 / Task 6.6 — verification-resend rate limit (AC-AUTH-3a)',
  () => {
    let admin: SupabaseClient;
    const userIdsToCleanup: string[] = [];

    beforeAll(() => {
      admin = adminClient();
    });

    afterEach(async () => {
      while (userIdsToCleanup.length > 0) {
        const id = userIdsToCleanup.pop()!;
        await deleteTestUser(admin, id);
      }
    });

    it('exposes the spec-defined daily cap as a typed constant', () => {
      // Defends against an accidental tweak to the cap that desyncs from
      // the spec (spec §7.5 — 5 per 24h per user). If we ever ship a v1.1
      // with a different cap, this test forces the spec doc + this constant
      // to move together.
      expect(VERIFICATION_RESEND_DAILY_CAP).toBe(5);
    });

    it('allows a resend when the user has zero audit rows in the last 24h', async () => {
      const user = await createTestUser(admin, { emailConfirm: false });
      userIdsToCleanup.push(user.id);
      await clearResendAuditRows(admin, user.id);

      const decision = await checkVerificationResendQuota(admin, user.id);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        expect(decision.remaining).toBe(VERIFICATION_RESEND_DAILY_CAP);
      }
    });

    it('allows a resend at N=4 (one below the cap), reports remaining=1', async () => {
      const user = await createTestUser(admin, { emailConfirm: false });
      userIdsToCleanup.push(user.id);
      await clearResendAuditRows(admin, user.id);
      await seedResendAuditRows(admin, user.id, 4, new Date());

      const decision = await checkVerificationResendQuota(admin, user.id);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        expect(decision.remaining).toBe(1);
      }
    });

    it('DENIES a resend at N=5 (at the cap)', async () => {
      const user = await createTestUser(admin, { emailConfirm: false });
      userIdsToCleanup.push(user.id);
      await clearResendAuditRows(admin, user.id);
      await seedResendAuditRows(admin, user.id, 5, new Date());

      const decision = await checkVerificationResendQuota(admin, user.id);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toBe('daily_cap_exceeded');
        expect(decision.retryAfterSeconds).toBe(24 * 60 * 60);
      }
    });

    it('DENIES a resend at N=6 (over the cap)', async () => {
      const user = await createTestUser(admin, { emailConfirm: false });
      userIdsToCleanup.push(user.id);
      await clearResendAuditRows(admin, user.id);
      await seedResendAuditRows(admin, user.id, 6, new Date());

      const decision = await checkVerificationResendQuota(admin, user.id);
      expect(decision.allowed).toBe(false);
    });

    it('ignores audit rows older than 24h (rolling window, not calendar day)', async () => {
      const user = await createTestUser(admin, { emailConfirm: false });
      userIdsToCleanup.push(user.id);
      await clearResendAuditRows(admin, user.id);

      // 25 hours ago — outside the 24h window.
      const outsideWindow = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await seedResendAuditRows(admin, user.id, 10, outsideWindow);

      const decision = await checkVerificationResendQuota(admin, user.id);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        expect(decision.remaining).toBe(VERIFICATION_RESEND_DAILY_CAP);
      }
    });

    it('counts only the current user — other users do not contribute', async () => {
      const userA = await createTestUser(admin, { emailConfirm: false });
      userIdsToCleanup.push(userA.id);
      const userB = await createTestUser(admin, { emailConfirm: false });
      userIdsToCleanup.push(userB.id);

      await clearResendAuditRows(admin, userA.id);
      await clearResendAuditRows(admin, userB.id);

      // Saturate user B's window. User A should be unaffected.
      await seedResendAuditRows(admin, userB.id, 10, new Date());

      const decisionA = await checkVerificationResendQuota(admin, userA.id);
      expect(decisionA.allowed).toBe(true);
      if (decisionA.allowed) {
        expect(decisionA.remaining).toBe(VERIFICATION_RESEND_DAILY_CAP);
      }

      const decisionB = await checkVerificationResendQuota(admin, userB.id);
      expect(decisionB.allowed).toBe(false);
    });

    it('counts only the verification_resend event_type — signup / logout rows do not count', async () => {
      const user = await createTestUser(admin, { emailConfirm: false });
      userIdsToCleanup.push(user.id);
      await clearResendAuditRows(admin, user.id);

      // Create 5 unrelated audit rows of varying event types. The trigger
      // already wrote one `event_type='signup'` row for this user; that
      // alone is enough to test the event_type filter. Add a couple more
      // unrelated types to be thorough.
      const { error } = await admin.from('auth_audit_log').insert([
        { user_id: user.id, event_type: 'logout' },
        { user_id: user.id, event_type: 'password_reset_request' },
        { user_id: user.id, event_type: 'password_reset_complete' },
      ]);
      expect(error).toBeNull();

      const decision = await checkVerificationResendQuota(admin, user.id);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        expect(decision.remaining).toBe(VERIFICATION_RESEND_DAILY_CAP);
      }
    });

    it('recordVerificationResend writes exactly one row with the expected shape', async () => {
      const user = await createTestUser(admin, { emailConfirm: false });
      userIdsToCleanup.push(user.id);
      await clearResendAuditRows(admin, user.id);

      await recordVerificationResend(admin, user.id, {
        ip: '198.51.100.7',
        userAgent: 'phase6-rate-limit-test-record',
      });

      const { data, error } = await admin
        .from('auth_audit_log')
        .select('event_type, ip, user_agent, metadata')
        .eq('user_id', user.id)
        .eq('event_type', VERIFICATION_RESEND_EVENT);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      const row = data?.[0];
      expect(row?.event_type).toBe(VERIFICATION_RESEND_EVENT);
      expect(row?.ip).toBe('198.51.100.7');
      expect(row?.user_agent).toBe('phase6-rate-limit-test-record');

      // After the record, the next quota check should report remaining=4.
      const decision = await checkVerificationResendQuota(admin, user.id);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        expect(decision.remaining).toBe(VERIFICATION_RESEND_DAILY_CAP - 1);
      }
    });
  }
);
