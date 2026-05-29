import { test, expect } from '@playwright/test';
import {
  uniqueE2eEmail,
  e2eTestPassword,
  createUnverifiedE2eUser,
  deleteE2eUserById,
} from './_helpers/test-users';

/**
 * Task 5.8 — Playwright E2E golden path 1: verify → log in → home.
 *
 * Validates AC-AUTH-3 + AC-AUTH-4. The browser does NOT drive the `/app/signup`
 * form here — the signup server action is fully covered by Vitest (mocked) and
 * by the live-Supabase Phase 5 proxy gating suite, so re-exercising it via the
 * browser per CI run × per browser project × per retry is pure overhead.
 *
 * Why re-exercising signup is harmful:
 *   - Supabase Auth SMTP rate-limit is 3/hr (free) / 30/hr (Pro). The CI matrix
 *     is 4 browsers × up to 3 retries = up to 16 verification emails per push.
 *     PR #74's first live run timed out on `waitForURL('**\/app/verify-email')`
 *     for exactly this reason — the cap was hit, the redirect never fired.
 *   - Even when the cap isn't hit, the test-helper route 404 followed by a
 *     long verify-email timeout is a noisy, flaky failure mode that hides the
 *     real bugs E2E is supposed to surface.
 *
 * The new contract (rate-limit-safe):
 *   1. `beforeAll`: pre-create an UNVERIFIED user via the admin SDK. This
 *      uses `auth.admin.createUser({ email_confirm: false })`, which is a
 *      direct DB insert — NO email is sent, NO rate-limit cost.
 *   2. In-browser: hit `/api/test-helpers/confirm-user` to simulate the
 *      email-link click → go to `/app/login` → sign in with email + password
 *      → assert landing on `/app/` and that an authenticated UI element
 *      (the Log out button) renders.
 *   3. `afterAll`: delete the user via `admin.deleteUser(userId)`. No stray
 *      `auth.users` rows left in the project.
 *
 * What this still covers vs. what is moved elsewhere:
 *   - Cookie / session round-trip after login                     → COVERED here
 *   - Proxy-driven `/app/login` → `/app/` redirect for verified   → COVERED here
 *   - Authenticated UI renders post-login                          → COVERED here
 *   - Email validation, password rules, signup form UI            → covered by
 *     Vitest (`src/app/app/signup/actions.test.ts`) + Storybook a11y suite
 *   - Verify-email page UI + resend rate limit                    → covered by
 *     Vitest (`src/app/app/verify-email/actions.test.ts`) +
 *     `src/__tests__/auth/phase6-verification-resend-rate-limit.test.ts`
 *   - Unverified gate redirects                                   → covered by
 *     `src/__tests__/auth/phase5-proxy-gating.test.ts`
 *
 * Spec refs:
 *   - `.specify/features/005-lsl-platform/sub-specs/auth-tasks.md` Task 5.8
 *   - `docs/engineering/changes/2026-05-29-e51-auth-phase-6/DEVOPS-task-5.8-scope.md` Option B
 *   - PR #74 analysis comment (rate-limit diagnosis, redesign mandate)
 *
 * Per `playwright.config.ts`:
 *   - Local dev: runs against `npm run dev` on port 3000, chromium only.
 *   - CI: full browser matrix.
 */

const HELPER_TOKEN = process.env.CI_TEST_HELPER_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Skip when either the helper token OR the admin env is missing. Both are
// required for the new design — the admin SDK pre-creates the user, the
// helper route confirms it. Either gap means the test cannot make progress;
// reporting a clear skip is preferable to a misleading failure.
const SKIP_REASON =
  !HELPER_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY
    ? 'CI-only: requires CI_TEST_HELPER_TOKEN + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Set them locally to opt in.'
    : null;

test.describe('Auth golden path 1 — verify → log in → home (Task 5.8)', () => {
  // Skip the entire suite when any required env is absent. The skip reason is
  // the literal CI-only marker — Playwright reports it cleanly, so a missing
  // token at local-dev time doesn't masquerade as a failure.
  test.skip(SKIP_REASON !== null, SKIP_REASON ?? '');

  // Per-test (not per-suite) credentials: each test run gets a fresh email +
  // password so re-runs and parallel workers never collide. Created in
  // `beforeAll`, torn down in `afterAll`. Because this `describe` block has a
  // single test, `beforeAll` and `beforeEach` are equivalent — `beforeAll` is
  // used to make the create-once-per-test-file intent explicit and to keep
  // the door open for a sibling test (e.g. logout round-trip) reusing the
  // same fixture without paying the create cost twice.
  let email: string;
  let password: string;
  let userId: string;

  test.beforeAll(async () => {
    email = uniqueE2eEmail();
    password = e2eTestPassword();

    const created = await createUnverifiedE2eUser(email, password);
    if (!created) {
      // Should be unreachable given the SKIP_REASON gate above, but guard
      // anyway so a future refactor that loosens the gate fails loudly.
      throw new Error(
        'createUnverifiedE2eUser returned null — Supabase admin env missing.'
      );
    }
    userId = created.userId;
  });

  test.afterAll(async () => {
    // Tear down the test user. Best-effort — `deleteE2eUserById` swallows and
    // logs errors so a cleanup glitch doesn't fail an already-passing test.
    // The user has the `playwright.test.lslcalculator.com.au` domain, so even
    // a missed cleanup is recoverable by domain-match purge.
    if (userId) {
      await deleteE2eUserById(userId);
    }
  });

  test('a pre-created user, confirmed via test-helper, can log in and reach /app/', async ({
    page,
    baseURL,
    request,
  }) => {
    // ────────────────────────────────────────────────────────────────────
    // 1. Call the test-helper to mark the user confirmed. This simulates
    //    the user clicking the link in their verification email. No email
    //    was ever sent — this is the rate-limit-safe path.
    //    The route 404s in any env without CI_TEST_HELPER_TOKEN set, so
    //    failing here means CI env wiring is missing.
    // ────────────────────────────────────────────────────────────────────
    const helperResponse = await request.post(
      `${baseURL}/api/test-helpers/confirm-user`,
      {
        headers: {
          Authorization: `Bearer ${HELPER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        data: { email },
      }
    );
    expect(helperResponse.status()).toBe(204);

    // ────────────────────────────────────────────────────────────────────
    // 2. Go to /app/login. The browser starts with no session cookie, so
    //    the proxy lets the public-auth route through and the form renders.
    // ────────────────────────────────────────────────────────────────────
    await page.goto('/app/login');
    await expect(page.getByRole('heading', { name: /^log in$/i })).toBeVisible();

    // React 19 server actions need client hydration to bind the form's
    // action handler. Without this wait the .click() can fire before the
    // action is wired, submitting empty FormData. Wait for the RSC client
    // bundles to finish loading before interacting.
    await page.waitForLoadState('networkidle');

    // ────────────────────────────────────────────────────────────────────
    // 3. Log in with the now-verified credentials.
    // ────────────────────────────────────────────────────────────────────
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole('button', { name: /^log in$/i }).click();

    // ────────────────────────────────────────────────────────────────────
    // 4. Assert we land on /app (the platform home placeholder from
    //    Task 5.6). The page renders a "Welcome" heading and a logout
    //    button — both unique enough to anchor the assertion.
    //
    //    The login action issues `redirect('/app/')` but Next.js 16
    //    normalises trailing slashes (no `trailingSlash` config set), so
    //    the browser-side URL settles to `/app`. Accept either form to
    //    keep this resilient to future trailing-slash config changes.
    // ────────────────────────────────────────────────────────────────────
    await page.waitForURL(
      (url) => url.pathname === '/app' || url.pathname === '/app/',
      { timeout: 30_000 }
    );
    await expect(
      page.getByRole('heading', { name: /^welcome$/i })
    ).toBeVisible();
    // The logout button is the canonical "authenticated UI element" anchor.
    await expect(page.getByRole('button', { name: /^log out$/i })).toBeVisible();
  });
});
