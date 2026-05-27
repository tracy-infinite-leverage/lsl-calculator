// Phase 4 / Task 4.5 — signup trigger atomicity.
//
// Validates AC-AUTH-1: creating an `auth.users` row atomically creates exactly
// one `organisations` row, one `org_members` row (role='admin'), and one
// `auth_audit_log` row (event_type='signup'). Also asserts the invariant
//   count(organisations alive) == count(org_members where role='admin')
// after multiple signups.
//
// Tests run against the remote `lsl-platform` Supabase project (DEV-AUTH-4).
// Each test creates and tears down its own users; failures here block merge.

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseEnvConfigured,
  supabaseEnvMissingInCI,
} from './_helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

if (supabaseEnvMissingInCI()) {
  throw new Error(
    'Phase 4 integration tests are required in CI but the Supabase env vars ' +
      'are not set. Configure NEXT_PUBLIC_SUPABASE_URL, ' +
      'SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SUPABASE_ANON_KEY as CI ' +
      'secrets pointing at the lsl-platform project.'
  );
}

let admin: SupabaseClient;
const createdUserIds: string[] = [];

beforeAll(() => {
  admin = adminClient();
});

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await deleteTestUser(admin, id);
  }
});

describe.skipIf(!supabaseEnvConfigured())('Phase 4 / Task 4.5 — handle_new_user trigger atomicity (AC-AUTH-1)', () => {
  it('creates exactly one organisation + one admin membership + one signup audit row', async () => {
    const user = await createTestUser(admin);
    createdUserIds.push(user.id);

    const { data: members, error: memErr } = await admin
      .from('org_members')
      .select('id, org_id, user_id, role, joined_at')
      .eq('user_id', user.id);
    expect(memErr).toBeNull();
    expect(members).toHaveLength(1);
    const membership = members![0];
    expect(membership.role).toBe('admin');
    expect(membership.joined_at).not.toBeNull();

    const { data: orgs, error: orgErr } = await admin
      .from('organisations')
      .select('id, name, deleted_at, delete_scheduled_at')
      .eq('id', membership.org_id);
    expect(orgErr).toBeNull();
    expect(orgs).toHaveLength(1);
    const org = orgs![0];

    // Default org name derives from the email local-part per plan §2.2.4.
    const localPart = user.email.split('@')[0];
    expect(org.name).toBe(`${localPart}'s Organisation`);
    expect(org.deleted_at).toBeNull();
    expect(org.delete_scheduled_at).toBeNull();

    const { data: auditRows, error: auditErr } = await admin
      .from('auth_audit_log')
      .select('user_id, event_type, metadata')
      .eq('user_id', user.id)
      .eq('event_type', 'signup');
    expect(auditErr).toBeNull();
    expect(auditRows).toHaveLength(1);
    expect(auditRows![0].metadata).toMatchObject({ org_id: org.id });
  });

  it('preserves the invariant count(orgs) == count(admin members) across multiple signups', async () => {
    const SIGNUP_COUNT = 3;
    const users = await Promise.all(
      Array.from({ length: SIGNUP_COUNT }, () => createTestUser(admin))
    );
    users.forEach((u) => createdUserIds.push(u.id));

    const userIds = users.map((u) => u.id);

    const { data: members, error: memErr } = await admin
      .from('org_members')
      .select('user_id, org_id, role')
      .in('user_id', userIds);
    expect(memErr).toBeNull();
    expect(members).toHaveLength(SIGNUP_COUNT);
    expect(members!.every((m) => m.role === 'admin')).toBe(true);

    const orgIds = members!.map((m) => m.org_id);
    const uniqueOrgIds = new Set(orgIds);
    expect(uniqueOrgIds.size).toBe(SIGNUP_COUNT);

    const { data: orgs, error: orgErr } = await admin
      .from('organisations')
      .select('id')
      .in('id', [...uniqueOrgIds]);
    expect(orgErr).toBeNull();
    expect(orgs).toHaveLength(SIGNUP_COUNT);
  });

  it('writes the signup audit row with the correct org_id in metadata', async () => {
    const user = await createTestUser(admin);
    createdUserIds.push(user.id);

    const { data: member } = await admin
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();
    expect(member).not.toBeNull();

    const { data: audit } = await admin
      .from('auth_audit_log')
      .select('metadata')
      .eq('user_id', user.id)
      .eq('event_type', 'signup')
      .single();
    expect(audit).not.toBeNull();
    expect((audit!.metadata as { org_id: string }).org_id).toBe(member!.org_id);
  });
});
