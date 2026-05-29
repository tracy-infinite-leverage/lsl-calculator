import { test, expect } from '@playwright/test';
import {
  uniqueE2eEmail,
  e2eTestPassword,
  cleanupUserByEmail,
} from './_helpers/test-users';

/**
 * Task 5.8 — Playwright E2E golden path 1: signup → verify → home.
 *
 * Validates AC-AUTH-1, AC-AUTH-3, AC-AUTH-4. The browser drives the real
 * `/app/signup` form against the live `lsl-platform` Supabase project; a
 * CI-only helper route (`/api/test-helpers/confirm-user`, env-flag-guarded)
 * simulates the email-verification click without touching real SMTP. The
 * caller then signs in and asserts they land on the platform home.
 *
 * Why this test is CI-only:
 *   - The test-helper route is gated on `CI_TEST_HELPER_TOKEN`. Without it
 *     the route 404s and this test can't make progress.
 *   - The DevOps scope (Option B) and the Task 5.8 spec line 404 both
 *     specify the test-helper-route approach; running locally requires
 *     opting in by setting CI_TEST_HELPER_TOKEN in your shell.
 *
 * Per `playwright.config.ts`:
 *   - Local dev: runs against `npm run dev` on port 3000, chromium only.
 *   - CI: full browser matrix.
 */

const HELPER_TOKEN = process.env.CI_TEST_HELPER_TOKEN;

test.describe('Auth golden path 1 — signup → verify → home (Task 5.8)', () => {
  // Skip the entire suite when the helper token isn't present. The skip
  // reason is the literal CI-only marker — Playwright reports it cleanly
  // so a missing token at local-dev time doesn't masquerade as a failure.
  test.skip(
    !HELPER_TOKEN,
    'CI-only: CI_TEST_HELPER_TOKEN env var is required. Set it locally to opt in.'
  );

  test('a new signup verified via test-helper can log in and reach /app/', async ({
    page,
    baseURL,
    request,
  }) => {
    const email = uniqueE2eEmail();
    const password = e2eTestPassword();

    // ────────────────────────────────────────────────────────────────────
    // 1. Sign up at /app/signup. Form re-validates server-side; on success
    //    the action redirects to /app/verify-email.
    // ────────────────────────────────────────────────────────────────────
    await page.goto('/app/signup');
    await expect(
      page.getByRole('heading', { name: /create your account/i })
    ).toBeVisible();

    // React 19 server actions need client hydration to bind the form's
    // action handler. Without this wait the .click() can fire before the
    // action is wired, submitting empty FormData. Wait for the RSC client
    // bundles to finish loading before interacting.
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByLabel(/confirm password/i).fill(password);

    await page.getByRole('button', { name: /create account/i }).click();

    // ────────────────────────────────────────────────────────────────────
    // 2. Assert we landed on /app/verify-email and the email is shown.
    // ────────────────────────────────────────────────────────────────────
    await page.waitForURL('**/app/verify-email', { timeout: 30_000 });
    await expect(page.getByText(email)).toBeVisible();

    // ────────────────────────────────────────────────────────────────────
    // 3. Call the test-helper to mark the user confirmed. This simulates
    //    the user clicking the link in their verification email.
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
    // 4. Log out the unverified session (the signup flow auto-logged the
    //    user in with an unverified session; we sign out and back in to
    //    pick up the now-verified state). This also exercises Task 5.5's
    //    POST /app/logout handler.
    // ────────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /^log out$/i }).click();
    await page.waitForURL('**/app/login', { timeout: 30_000 });
    // Same hydration concern as signup — wait for the RSC bundle to bind
    // the login form's action handler.
    await page.waitForLoadState('networkidle');

    // ────────────────────────────────────────────────────────────────────
    // 5. Log in with the verified credentials.
    // ────────────────────────────────────────────────────────────────────
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole('button', { name: /^log in$/i }).click();

    // ────────────────────────────────────────────────────────────────────
    // 6. Assert we land on /app/ (the platform home placeholder from
    //    Task 5.6). The page renders a "Welcome" heading and a logout
    //    button — both unique enough to anchor the assertion.
    // ────────────────────────────────────────────────────────────────────
    await page.waitForURL((url) => url.pathname === '/app/', {
      timeout: 30_000,
    });
    await expect(
      page.getByRole('heading', { name: /^welcome$/i })
    ).toBeVisible();
    // The logout button is the canonical "authenticated UI element" anchor.
    await expect(page.getByRole('button', { name: /^log out$/i })).toBeVisible();

    // ────────────────────────────────────────────────────────────────────
    // 7. Cleanup — delete the test user. Best-effort; the periodic purge
    //    job is the safety net.
    // ────────────────────────────────────────────────────────────────────
    await cleanupUserByEmail(email);
  });
});
