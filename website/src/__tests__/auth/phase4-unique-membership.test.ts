// Phase 4 / Task 4.7 — UNIQUE(user_id) on org_members.
//
// Validates AC-AUTH-14: a user cannot be a member of two orgs. A second
// `org_members` insert for the same user_id fails with Postgres error code
// 23505 (unique_violation).
//
// The signup trigger (Task 4.4) already creates one membership per user; this
// test exercises the constraint by attempting to insert a SECOND membership
// directly via the service role (bypassing RLS — we're testing the column
// constraint, not RLS).
//
// Tests run against the remote `lsl-platform` Supabase project (DEV-AUTH-4).

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
const createdOrgIds: string[] = [];

beforeAll(() => {
  admin = adminClient();
});

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await deleteTestUser(admin, id);
  }
  // Any orgs we created directly (without an auth.users insert via the
  // trigger) need explicit cleanup. The trigger-created orgs are removed via
  // FK ON DELETE CASCADE when their user is deleted above.
  while (createdOrgIds.length > 0) {
    const orgId = createdOrgIds.pop()!;
    await admin.from('organisations').delete().eq('id', orgId);
  }
});

describe.skipIf(!supabaseEnvConfigured())('Phase 4 / Task 4.7 — org_members.user_id UNIQUE (AC-AUTH-14)', () => {
  it('rejects a second org_members row for the same user_id with Postgres 23505', async () => {
    const user = await createTestUser(admin);
    createdUserIds.push(user.id);

    // Create a SECOND, independent organisation to attempt the duplicate
    // membership against. (Avoids inserting into the trigger-created org —
    // we want to prove the user_id UNIQUE constraint, not org_id collision.)
    const { data: secondOrg, error: orgErr } = await admin
      .from('organisations')
      .insert({ name: 'Test-only second org' })
      .select('id')
      .single();
    expect(orgErr).toBeNull();
    expect(secondOrg?.id).toBeDefined();
    createdOrgIds.push(secondOrg!.id);

    const { error: dupErr } = await admin.from('org_members').insert({
      org_id: secondOrg!.id,
      user_id: user.id,
      role: 'admin',
      joined_at: new Date().toISOString(),
    });

    expect(dupErr).not.toBeNull();
    // PostgrestError surfaces Postgres SQLSTATE in the `code` field.
    expect(dupErr!.code).toBe('23505');
  });

  it('allows the original trigger-created membership to remain intact after a rejected duplicate', async () => {
    const user = await createTestUser(admin);
    createdUserIds.push(user.id);

    const { data: secondOrg } = await admin
      .from('organisations')
      .insert({ name: 'Test-only second org (post-rejection)' })
      .select('id')
      .single();
    createdOrgIds.push(secondOrg!.id);

    // Attempt and expect failure.
    const { error: dupErr } = await admin.from('org_members').insert({
      org_id: secondOrg!.id,
      user_id: user.id,
      role: 'admin',
    });
    expect(dupErr!.code).toBe('23505');

    // The original membership is still exactly one row, unchanged.
    const { data: memberships } = await admin
      .from('org_members')
      .select('id, org_id, role')
      .eq('user_id', user.id);
    expect(memberships).toHaveLength(1);
    expect(memberships![0].role).toBe('admin');
    expect(memberships![0].org_id).not.toBe(secondOrg!.id);
  });
});
