// Phase 4 / Task 4.6 — cross-tenant RLS denial.
//
// Validates AC-AUTH-13: postgres RLS prevents any logged-in user from reading
// any `organisations` or `org_members` row not their own. This is the single
// most security-critical test in the auth slice; failure blocks merge.
//
// Strategy: create two users in two orgs via the signup trigger, sign each
// one in via the anon client (subject to RLS), and assert every cross-tenant
// query path returns zero rows.
//
// Tests run against the remote `lsl-platform` Supabase project (DEV-AUTH-4).

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import {
  adminClient,
  anonClient,
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

// Sign in via password against a fresh anon client and return both the client
// (now carrying the user's JWT — subject to RLS) and the resolved user id.
async function signInAsUser(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(`signInWithPassword failed: ${error.message}`);
  if (!data.session) throw new Error('signInWithPassword returned no session');
  return client;
}

describe.skipIf(!supabaseEnvConfigured())('Phase 4 / Task 4.6 — cross-tenant RLS denial (AC-AUTH-13)', () => {
  // Each test in this describe creates 1-2 test users via Supabase Auth
  // (network round-trip) plus runs RLS queries. The default 5s vitest
  // timeout is too tight for the slow tail of Supabase response times on
  // CI runners and produced consistent flakes on PRs #55 and #56.
  // 10s gives comfortable headroom for the 95th-percentile setup.
  vi.setConfig({ testTimeout: 10_000 });

  it('user A cannot read user B\'s org or membership rows', async () => {
    const userA = await createTestUser(admin);
    const userB = await createTestUser(admin);
    createdUserIds.push(userA.id, userB.id);

    const { data: memA } = await admin
      .from('org_members')
      .select('org_id')
      .eq('user_id', userA.id)
      .single();
    const { data: memB } = await admin
      .from('org_members')
      .select('org_id')
      .eq('user_id', userB.id)
      .single();
    expect(memA?.org_id).toBeDefined();
    expect(memB?.org_id).toBeDefined();
    expect(memA!.org_id).not.toBe(memB!.org_id);

    const orgAId = memA!.org_id;
    const orgBId = memB!.org_id;

    const sessionA = await signInAsUser(userA.email, userA.password);

    // As user A, SELECT * FROM organisations: only org-A visible.
    const { data: orgsAseesAll, error: orgsAseesAllErr } = await sessionA
      .from('organisations')
      .select('id');
    expect(orgsAseesAllErr).toBeNull();
    expect(orgsAseesAll).toHaveLength(1);
    expect(orgsAseesAll![0].id).toBe(orgAId);

    // As user A, targeted query for org-B: zero rows (NOT an error — RLS
    // filters silently).
    const { data: orgsAseesB, error: orgsAseesBErr } = await sessionA
      .from('organisations')
      .select('id')
      .eq('id', orgBId);
    expect(orgsAseesBErr).toBeNull();
    expect(orgsAseesB).toHaveLength(0);

    // As user A, SELECT * FROM org_members: only user-A's membership visible.
    const { data: memsAseesAll, error: memsAseesAllErr } = await sessionA
      .from('org_members')
      .select('user_id, org_id');
    expect(memsAseesAllErr).toBeNull();
    expect(memsAseesAll).toHaveLength(1);
    expect(memsAseesAll![0].user_id).toBe(userA.id);

    // As user A, targeted query for user-B's membership row: zero rows.
    const { data: memsAseesB, error: memsAseesBErr } = await sessionA
      .from('org_members')
      .select('id')
      .eq('user_id', userB.id);
    expect(memsAseesBErr).toBeNull();
    expect(memsAseesB).toHaveLength(0);
  });

  it('user B cannot read user A\'s org or membership rows (symmetric)', async () => {
    const userA = await createTestUser(admin);
    const userB = await createTestUser(admin);
    createdUserIds.push(userA.id, userB.id);

    const { data: memA } = await admin
      .from('org_members')
      .select('org_id')
      .eq('user_id', userA.id)
      .single();
    const orgAId = memA!.org_id;

    const sessionB = await signInAsUser(userB.email, userB.password);

    const { data: orgsBseesA } = await sessionB
      .from('organisations')
      .select('id')
      .eq('id', orgAId);
    expect(orgsBseesA).toHaveLength(0);

    const { data: memsBseesA } = await sessionB
      .from('org_members')
      .select('id')
      .eq('user_id', userA.id);
    expect(memsBseesA).toHaveLength(0);
  });

  it('anonymous (unauthenticated) clients cannot read any rows from either table', async () => {
    const userA = await createTestUser(admin);
    createdUserIds.push(userA.id);

    const anon = anonClient();

    const { data: orgs } = await anon.from('organisations').select('id');
    expect(orgs).toHaveLength(0);

    const { data: members } = await anon.from('org_members').select('id');
    expect(members).toHaveLength(0);
  });

  it('authenticated user cannot read any rows from auth_audit_log (service-role-only)', async () => {
    const user = await createTestUser(admin);
    createdUserIds.push(user.id);

    const session = await signInAsUser(user.email, user.password);

    // No policy → SELECT returns zero rows for non-service roles.
    const { data, error } = await session
      .from('auth_audit_log')
      .select('id, user_id, event_type');
    // RLS returns 0 rows rather than an error for missing-policy reads.
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
