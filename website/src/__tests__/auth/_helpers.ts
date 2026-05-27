// Test helpers for Phase 4 auth-slice integration tests.
//
// These tests run against the remote `lsl-platform` Supabase project (per
// DEV-AUTH-4 resolution — no local Docker stack). Each test creates a fresh
// auth.users row via the service-role admin API, then cleans up by deleting
// the user (FK ON DELETE CASCADE removes the org + membership; the audit-log
// row's user_id is nulled but the row is preserved).
//
// Required environment variables (in website/.env.local for local runs and as
// CI secrets for the GitHub Actions runner):
//   • NEXT_PUBLIC_SUPABASE_URL       — the lsl-platform API URL
//   • SUPABASE_SERVICE_ROLE_KEY      — service-role key (bypasses RLS)
//   • NEXT_PUBLIC_SUPABASE_ANON_KEY  — anon key (used for RLS-as-user assertions)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load `.env.local` at module-init. We don't use `@next/env`'s loadEnvConfig
// here because it intentionally skips `.env.local` when NODE_ENV === 'test'
// (Next.js's convention to keep test runs deterministic), and vitest sets
// NODE_ENV=test by default — silently leaving our Supabase keys unset.
//
// Instead, a minimal `.env.local` parser: KEY=VALUE per line, ignore comments
// and blank lines, strip surrounding double-quotes only. We do NOT overwrite
// values already present in process.env (CI secrets / shell exports win).
const ENV_LOCAL_PATH = resolve(process.cwd(), '.env.local');
if (existsSync(ENV_LOCAL_PATH)) {
  const raw = readFileSync(ENV_LOCAL_PATH, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// True when all three Supabase env vars are present. Use with `describe.skipIf`
// so local `npm test` skips Phase 4 integration suites cleanly when the dev
// hasn't populated `.env.local`, while CI still runs them (and fails) when the
// secrets are missing — see `supabaseEnvMissingInCI`.
export function supabaseEnvConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);
}

// True when env is missing AND we're running in CI. CI must hard-fail rather
// than silently skip when secrets aren't wired.
export function supabaseEnvMissingInCI(): boolean {
  return !supabaseEnvConfigured() && process.env.CI === 'true';
}

export function requireSupabaseEnv(): {
  url: string;
  serviceRoleKey: string;
  anonKey: string;
} {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (missing.length > 0) {
    throw new Error(
      `Phase 4 integration tests require these env vars: ${missing.join(', ')}. ` +
        `Populate website/.env.local (see website/.env.example) or set them ` +
        `as CI secrets pointing at the lsl-platform Supabase project.`
    );
  }
  return {
    url: SUPABASE_URL as string,
    serviceRoleKey: SERVICE_ROLE_KEY as string,
    anonKey: ANON_KEY as string,
  };
}

// Service-role client — bypasses RLS. Use for admin operations + cleanup.
export function adminClient(): SupabaseClient {
  const { url, serviceRoleKey } = requireSupabaseEnv();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Anon client — subject to RLS. Use with sign-in to assert as-user reads.
export function anonClient(): SupabaseClient {
  const { url, anonKey } = requireSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Build a unique, identifiable test email so cleanup is unambiguous and
// nothing is delivered to a real recipient. The TLD `.test` is RFC-2606
// reserved and never resolves on the public internet.
export function testEmail(prefix = 'phase4'): string {
  const rand = randomBytes(6).toString('hex');
  return `${prefix}-${Date.now()}-${rand}@e2e.lslcalculator.test`;
}

// Strong test password — meets the spec §6 ≥12-char requirement and avoids
// any common password list. Different per test invocation to defend against
// any accidental Supabase HIBP rejection.
export function testPassword(): string {
  return `Phase4-Test-${randomBytes(8).toString('hex')}!Aa9`;
}

// Sign up a fresh user via the service-role admin API and return the user id.
// Uses email_confirm: true so the user is verified — most Phase 4 tests don't
// care about the verification gate (that's tested in Phase 5).
export async function createTestUser(
  admin: SupabaseClient,
  opts: { email?: string; password?: string; emailConfirm?: boolean } = {}
): Promise<{ id: string; email: string; password: string }> {
  const email = opts.email ?? testEmail();
  const password = opts.password ?? testPassword();
  const emailConfirm = opts.emailConfirm ?? true;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: emailConfirm,
  });

  if (error) throw new Error(`createTestUser failed: ${error.message}`);
  if (!data.user) throw new Error('createTestUser returned no user');

  return { id: data.user.id, email, password };
}

// Delete a test user via the service-role admin API. ON DELETE CASCADE handles
// the org_members + organisations rows; auth_audit_log retains the row with
// user_id set to NULL (intentional — see migration 4.3).
export async function deleteTestUser(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    // Log but don't throw — cleanup-failure shouldn't fail an already-passing test.
    console.warn(`deleteTestUser(${userId}) returned error: ${error.message}`);
  }
}
