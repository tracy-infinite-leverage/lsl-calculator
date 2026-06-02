// E5.3 Phase 1 / Task T1.8 — cross-tenant RLS denial for pay-code mapping tables.
//
// Validates AC-MAP-11: postgres RLS prevents any logged-in user from
// SELECTing, INSERTing, or UPDATEing rows belonging to an org they are not
// a member of, across the four org-scoped E5.3 v0.2 tables:
//   - pay_code_mappings
//   - pay_code_mapping_versions
//   - value_normalisation_aliases (org-scoped subset; system rows have
//     org_id IS NULL and are globally readable — explicitly NOT tested here)
//   - value_normalisation_aliases_versions
//
// `pay_code_aliases` is intentionally excluded: it's a system-managed
// read-only knowledge base with no org scope (write blocked at policy level
// for all non-service-role roles).
//
// Strategy mirrors the E5.1 `phase4-cross-tenant-rls.test.ts` pattern:
// create two users in two orgs via the signup trigger; as service-role
// admin, seed each org with one mapping/alias row; sign each user in via
// the anon client (subject to RLS); assert every cross-tenant query path
// returns zero rows or is denied.
//
// Tests run against the remote `lsl-platform` Supabase project (DEV-AUTH-4
// precedent — no local Docker stack). When this PR merges, the operator
// applies the E5.3 migrations to production via MCP before CI runs against
// the merge commit; the same convention used for E5.2 migration suites.

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  supabaseEnvConfigured,
  supabaseEnvMissingInCI,
} from '../auth/_helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

if (supabaseEnvMissingInCI()) {
  throw new Error(
    'E5.3 RLS integration tests are required in CI but the Supabase env vars ' +
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

/**
 * Resolve the auto-provisioned org_id for a given user_id by querying
 * org_members as service-role (bypasses RLS). The signup trigger creates
 * exactly one org per new auth.users insert.
 */
async function getOrgIdForUser(userId: string): Promise<string> {
  const { data, error } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .single();
  if (error) throw new Error(`getOrgIdForUser failed: ${error.message}`);
  if (!data?.org_id) throw new Error(`no org_member row for user ${userId}`);
  return data.org_id;
}

describe.skipIf(!supabaseEnvConfigured())(
  'E5.3 T1.8 — cross-tenant RLS denial (AC-MAP-11)',
  () => {
    // 10s headroom for the 95th-percentile Supabase response on CI runners,
    // matching the E5.1 phase4 RLS suite precedent.
    vi.setConfig({ testTimeout: 10_000 });

    describe('pay_code_mappings', () => {
      it('user A cannot SELECT / INSERT / UPDATE org B rows', async () => {
        const userA = await createTestUser(admin);
        const userB = await createTestUser(admin);
        createdUserIds.push(userA.id, userB.id);

        const orgAId = await getOrgIdForUser(userA.id);
        const orgBId = await getOrgIdForUser(userB.id);
        expect(orgAId).not.toBe(orgBId);

        // Admin-seed one mapping row per org.
        const { error: insAErr } = await admin
          .from('pay_code_mappings')
          .insert({
            org_id: orgAId,
            raw_code: 'ORD_A',
            bucket: 'ordinary_time',
          });
        expect(insAErr).toBeNull();
        const { error: insBErr } = await admin
          .from('pay_code_mappings')
          .insert({
            org_id: orgBId,
            raw_code: 'ORD_B',
            bucket: 'ordinary_time',
          });
        expect(insBErr).toBeNull();

        const sessionA = await signInAsUser(userA.email, userA.password);

        // SELECT — user A sees own row only.
        const { data: visible, error: selErr } = await sessionA
          .from('pay_code_mappings')
          .select('id, org_id, raw_code');
        expect(selErr).toBeNull();
        expect(visible).toHaveLength(1);
        expect(visible![0].org_id).toBe(orgAId);
        expect(visible![0].raw_code).toBe('ORD_A');

        // INSERT — user A tries to write a row for org B → denied by RLS.
        const { error: crossInsErr } = await sessionA
          .from('pay_code_mappings')
          .insert({
            org_id: orgBId,
            raw_code: 'ORD_B_HIJACK',
            bucket: 'ordinary_time',
          });
        expect(crossInsErr).not.toBeNull();

        // UPDATE — user A tries to update org B's row → zero rows affected.
        const { data: updRows, error: updErr } = await sessionA
          .from('pay_code_mappings')
          .update({ bucket: 'overtime_regular' })
          .eq('org_id', orgBId)
          .select('id');
        expect(updErr).toBeNull();
        expect(updRows).toHaveLength(0);

        // Verify org B's row is unchanged via admin.
        const { data: postUpd } = await admin
          .from('pay_code_mappings')
          .select('bucket')
          .eq('org_id', orgBId)
          .eq('raw_code', 'ORD_B')
          .single();
        expect(postUpd?.bucket).toBe('ordinary_time');
      });
    });

    describe('pay_code_mapping_versions', () => {
      it('user A cannot SELECT / INSERT / UPDATE org B rows', async () => {
        const userA = await createTestUser(admin);
        const userB = await createTestUser(admin);
        createdUserIds.push(userA.id, userB.id);

        const orgAId = await getOrgIdForUser(userA.id);
        const orgBId = await getOrgIdForUser(userB.id);

        // Insert a mapping for each org and capture its current_version_id
        // — the trigger that maintains exactly-one-current-row writes a
        // versions row implicitly. Read it back as admin.
        const { data: mapA } = await admin
          .from('pay_code_mappings')
          .insert({ org_id: orgAId, raw_code: 'PCV_A', bucket: 'ordinary_time' })
          .select('id, current_version_id')
          .single();
        const { data: mapB } = await admin
          .from('pay_code_mappings')
          .insert({ org_id: orgBId, raw_code: 'PCV_B', bucket: 'ordinary_time' })
          .select('id, current_version_id')
          .single();
        expect(mapA?.current_version_id).toBeDefined();
        expect(mapB?.current_version_id).toBeDefined();

        const sessionA = await signInAsUser(userA.email, userA.password);

        // SELECT — only org A's version row visible.
        const { data: visible, error: selErr } = await sessionA
          .from('pay_code_mapping_versions')
          .select('id, org_id, mapping_id');
        expect(selErr).toBeNull();
        expect(visible).toHaveLength(1);
        expect(visible![0].org_id).toBe(orgAId);

        // INSERT — user A tries to insert a version row referencing org B's mapping → denied.
        const { error: crossInsErr } = await sessionA
          .from('pay_code_mapping_versions')
          .insert({
            mapping_id: mapB!.id,
            org_id: orgBId,
            raw_code: 'PCV_B',
            bucket: 'overtime_regular',
            source: 'manual',
            created_by: userA.id,
          });
        expect(crossInsErr).not.toBeNull();

        // UPDATE — user A tries to update org B's version row → zero rows affected.
        const { data: updRows, error: updErr } = await sessionA
          .from('pay_code_mapping_versions')
          .update({ change_reason: 'hijack-attempt' })
          .eq('org_id', orgBId)
          .select('id');
        expect(updErr).toBeNull();
        expect(updRows).toHaveLength(0);
      });
    });

    describe('value_normalisation_aliases (org-scoped subset)', () => {
      it('user A cannot SELECT / INSERT / UPDATE org B rows', async () => {
        const userA = await createTestUser(admin);
        const userB = await createTestUser(admin);
        createdUserIds.push(userA.id, userB.id);

        const orgAId = await getOrgIdForUser(userA.id);
        const orgBId = await getOrgIdForUser(userB.id);

        // Admin-seed one ORG-SCOPED alias per org (not a system row).
        const { error: insAErr } = await admin
          .from('value_normalisation_aliases')
          .insert({
            org_id: orgAId,
            target_field: 'employment_type',
            surface_form: 'A-PT - Part Time',
            canonical_value: 'part_time',
            confidence: 0.95,
            source: 'org_manual',
            created_by: userA.id,
          });
        expect(insAErr).toBeNull();
        const { error: insBErr } = await admin
          .from('value_normalisation_aliases')
          .insert({
            org_id: orgBId,
            target_field: 'employment_type',
            surface_form: 'B-PT - Part Time',
            canonical_value: 'part_time',
            confidence: 0.95,
            source: 'org_manual',
            created_by: userB.id,
          });
        expect(insBErr).toBeNull();

        const sessionA = await signInAsUser(userA.email, userA.password);

        // SELECT — user A sees own ORG-SCOPED row, and ALSO the global
        // system seeds (org_id IS NULL). We assert org B's row is NOT in
        // the result by filtering on org_id = orgBId.
        const { data: orgBVisible, error: selErr } = await sessionA
          .from('value_normalisation_aliases')
          .select('id, org_id')
          .eq('org_id', orgBId);
        expect(selErr).toBeNull();
        expect(orgBVisible).toHaveLength(0);

        // INSERT — user A tries to write a row for org B → denied by RLS.
        const { error: crossInsErr } = await sessionA
          .from('value_normalisation_aliases')
          .insert({
            org_id: orgBId,
            target_field: 'employment_type',
            surface_form: 'B-HIJACK',
            canonical_value: 'casual',
            confidence: 0.95,
            source: 'org_manual',
            created_by: userA.id,
          });
        expect(crossInsErr).not.toBeNull();

        // UPDATE — user A tries to update org B's row → zero rows affected.
        const { data: updRows, error: updErr } = await sessionA
          .from('value_normalisation_aliases')
          .update({ canonical_value: 'casual' })
          .eq('org_id', orgBId)
          .select('id');
        expect(updErr).toBeNull();
        expect(updRows).toHaveLength(0);

        // Verify org B's row is unchanged via admin.
        const { data: postUpd } = await admin
          .from('value_normalisation_aliases')
          .select('canonical_value')
          .eq('org_id', orgBId)
          .eq('surface_form', 'B-PT - Part Time')
          .single();
        expect(postUpd?.canonical_value).toBe('part_time');
      });
    });

    describe('value_normalisation_aliases_versions', () => {
      it('user A cannot SELECT / INSERT / UPDATE org B rows', async () => {
        const userA = await createTestUser(admin);
        const userB = await createTestUser(admin);
        createdUserIds.push(userA.id, userB.id);

        const orgAId = await getOrgIdForUser(userA.id);
        const orgBId = await getOrgIdForUser(userB.id);

        // Seed an ORG-SCOPED alias for each org; the maintenance trigger
        // writes a corresponding versions row.
        const { data: aliasA } = await admin
          .from('value_normalisation_aliases')
          .insert({
            org_id: orgAId,
            target_field: 'employment_type',
            surface_form: 'VNAV_A',
            canonical_value: 'part_time',
            confidence: 0.95,
            source: 'org_manual',
            created_by: userA.id,
          })
          .select('id, current_version_id')
          .single();
        const { data: aliasB } = await admin
          .from('value_normalisation_aliases')
          .insert({
            org_id: orgBId,
            target_field: 'employment_type',
            surface_form: 'VNAV_B',
            canonical_value: 'part_time',
            confidence: 0.95,
            source: 'org_manual',
            created_by: userB.id,
          })
          .select('id, current_version_id')
          .single();
        expect(aliasA?.current_version_id).toBeDefined();
        expect(aliasB?.current_version_id).toBeDefined();

        const sessionA = await signInAsUser(userA.email, userA.password);

        // SELECT — only org A's version row visible.
        const { data: orgBVisible, error: selErr } = await sessionA
          .from('value_normalisation_aliases_versions')
          .select('id, org_id')
          .eq('org_id', orgBId);
        expect(selErr).toBeNull();
        expect(orgBVisible).toHaveLength(0);

        // INSERT — user A tries to insert a version row for org B → denied.
        const { error: crossInsErr } = await sessionA
          .from('value_normalisation_aliases_versions')
          .insert({
            alias_id: aliasB!.id,
            org_id: orgBId,
            target_field: 'employment_type',
            surface_form: 'VNAV_B_HIJACK',
            canonical_value: 'casual',
            confidence: 0.95,
            source: 'org_manual',
            created_by: userA.id,
          });
        expect(crossInsErr).not.toBeNull();

        // UPDATE — user A tries to update org B's version row → zero rows affected.
        const { data: updRows, error: updErr } = await sessionA
          .from('value_normalisation_aliases_versions')
          .update({ change_reason: 'hijack-attempt' })
          .eq('org_id', orgBId)
          .select('id');
        expect(updErr).toBeNull();
        expect(updRows).toHaveLength(0);
      });
    });
  }
);
