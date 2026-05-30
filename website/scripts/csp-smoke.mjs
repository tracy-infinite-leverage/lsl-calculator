#!/usr/bin/env node
/**
 * E6.2 Task 2.10b — Production CSP-header smoke test.
 *
 * Boots `next start` against the existing `.next/` build, fetches `/` and
 * `/app/login`, then asserts that the production response carries a CSP
 * header consistent with the LAUNCH-GUARD posture:
 *
 *   1. CSP header is present (either `Content-Security-Policy` or
 *      `Content-Security-Policy-Report-Only`).
 *   2. `script-src` does NOT contain `unsafe-inline` or `unsafe-eval`.
 *   3. `style-src` does NOT contain `unsafe-inline` or `unsafe-eval`.
 *   4. No wildcard third-party origins (`*` outside `'self'` or a scheme).
 *
 * Exit codes:
 *   0 — all assertions pass.
 *   1 — one or more assertions fail (printed with the failing directive).
 *   2 — pre-flight failure (no .next build, or server failed to start).
 *
 * Why a shell script and not Playwright / Vitest: the assertion surface is
 * tiny (one HTTP request, four substring checks per directive). A Playwright
 * test would add a 30-second browser-launch tax for zero additional signal.
 * Vitest + supertest would need a Next-server adapter we don't have. Plain
 * Node fetch + child_process keeps the smoke test in the same family as the
 * existing `scripts/audit-bundle.mjs` postbuild check.
 *
 * Spec ref: `.specify/features/006-ui-design-system/spec.md` §5.7 +
 *           `docs/qa/e6-csp-audit.md` (CSP header smoke test section).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WEBSITE_ROOT = resolve(__dirname, '..');
const NEXT_BUILD_DIR = resolve(WEBSITE_ROOT, '.next');
const PORT = process.env.CSP_SMOKE_PORT ? Number(process.env.CSP_SMOKE_PORT) : 3210;
const BASE = `http://127.0.0.1:${PORT}`;
// Two routes are checked to confirm the CSP applies app-wide. We deliberately
// avoid any `/app/*` route here because those depend on `NEXT_PUBLIC_SUPABASE_*`
// env vars at module init — if a CI run doesn't have them wired (and the smoke
// test does NOT require them, by design), the `/app/*` page returns 500 and
// has no CSP header. `/` and `/privacy` are both prerendered static routes
// and exercise the same `headers()` config from `next.config.ts`.
const PATHS_TO_CHECK = ['/', '/privacy'];
// Wider window in CI — cold start on GitHub runners is ~3-5s, give us slack.
const SERVER_BOOT_TIMEOUT_MS = 30_000;

// Allowed third-party-looking patterns that are first-party per the audit doc.
// See docs/qa/e6-csp-audit.md → "Expected request origins".
const FIRST_PARTY_HOSTS = [
  'vitals.vercel-insights.com',
  '*.vercel-analytics.com',
  '*.supabase.co',
];

function fail(message) {
  console.error(`[csp-smoke] FAIL — ${message}`);
  process.exitCode = 1;
}

function preflightFail(message) {
  console.error(`[csp-smoke] PRE-FLIGHT — ${message}`);
  process.exit(2);
}

if (!existsSync(NEXT_BUILD_DIR)) {
  preflightFail(`.next/ build directory missing. Run \`npm run build\` first.`);
}

/**
 * Find a directive line in the CSP value string and return its source list
 * (everything after the directive name). Returns null if the directive
 * isn't present. Directives are semicolon-separated and may have arbitrary
 * whitespace around the boundary.
 */
function getDirective(csp, name) {
  for (const raw of csp.split(';')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.indexOf(' ');
    const head = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    if (head === name) {
      return spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
    }
  }
  return null;
}

/**
 * Returns an array of source-list tokens for a directive, or null if not present.
 */
function getDirectiveTokens(csp, name) {
  const value = getDirective(csp, name);
  if (value == null) return null;
  return value.split(/\s+/).filter(Boolean);
}

/**
 * Apply the four assertions to a single CSP header value.
 * Returns the number of failures encountered.
 */
function assertCsp(pathLabel, csp) {
  let failures = 0;

  // (1) Header presence is asserted by the caller (we only get here when set).

  // (2) + (3) — script-src / style-src must not contain unsafe-inline / unsafe-eval.
  for (const directive of ['script-src', 'style-src']) {
    const tokens = getDirectiveTokens(csp, directive);
    if (tokens == null) {
      // If the directive isn't set, default-src governs it. Re-check default-src.
      const defaultTokens = getDirectiveTokens(csp, 'default-src');
      if (defaultTokens == null) {
        fail(`${pathLabel}: neither ${directive} nor default-src present in CSP`);
        failures++;
        continue;
      }
      if (defaultTokens.includes("'unsafe-inline'")) {
        fail(`${pathLabel}: default-src (governing ${directive}) contains 'unsafe-inline'`);
        failures++;
      }
      if (defaultTokens.includes("'unsafe-eval'")) {
        fail(`${pathLabel}: default-src (governing ${directive}) contains 'unsafe-eval'`);
        failures++;
      }
      continue;
    }
    if (tokens.includes("'unsafe-inline'")) {
      fail(`${pathLabel}: ${directive} contains 'unsafe-inline'`);
      failures++;
    }
    if (tokens.includes("'unsafe-eval'")) {
      fail(`${pathLabel}: ${directive} contains 'unsafe-eval'`);
      failures++;
    }
  }

  // (4) No wildcard third-party origins. A bare '*' or an origin starting
  // with '*.' that isn't in the first-party allow-list fails. Schemes like
  // `data:` and `blob:` are not wildcards. `'self'` is not a wildcard.
  // We scan every directive that names sources (everything except numeric
  // and policy-only directives).
  const sourceDirectives = [
    'default-src',
    'script-src',
    'style-src',
    'img-src',
    'font-src',
    'connect-src',
    'media-src',
    'frame-src',
    'child-src',
    'worker-src',
    'manifest-src',
  ];
  for (const directive of sourceDirectives) {
    const tokens = getDirectiveTokens(csp, directive);
    if (!tokens) continue;
    for (const token of tokens) {
      if (token === '*') {
        fail(`${pathLabel}: ${directive} contains bare wildcard '*'`);
        failures++;
        continue;
      }
      // Wildcard origins come in two shapes:
      //   - `*.example.com`            (bare host, no scheme)
      //   - `https://*.example.com`    (scheme + wildcard host)
      // Strip the scheme (and any `://`) so the check works for both.
      const schemeStripped = token.replace(/^[a-z]+:\/\//i, '');
      if (schemeStripped.startsWith('*.')) {
        const allowed = FIRST_PARTY_HOSTS.some(
          (h) => h === schemeStripped || `*.${h}` === schemeStripped
        );
        if (!allowed) {
          fail(
            `${pathLabel}: ${directive} contains wildcard third-party origin '${token}'`
          );
          failures++;
        }
      }
    }
  }

  return failures;
}

async function probe(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { redirect: 'manual' });
  // Pull either the enforcing or the report-only CSP header; assertions
  // apply to both. (Production today ships report-only — see next.config.ts.)
  const enforcing = res.headers.get('content-security-policy');
  const reportOnly = res.headers.get('content-security-policy-report-only');
  const csp = enforcing ?? reportOnly;
  return { url, status: res.status, csp, headerName: enforcing ? 'Content-Security-Policy' : reportOnly ? 'Content-Security-Policy-Report-Only' : null };
}

async function waitForServer(child) {
  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      preflightFail(`next start exited early (code ${child.exitCode})`);
    }
    try {
      const res = await fetch(`${BASE}/`, { redirect: 'manual' });
      // Any 2xx/3xx/4xx is fine — it means the server is responding. 5xx is
      // a startup race; keep polling. Only network-down should fall through.
      if (res.status < 500) return;
    } catch {
      // server not up yet
    }
    await sleep(500);
  }
  preflightFail(`next start did not respond within ${SERVER_BOOT_TIMEOUT_MS}ms`);
}

async function main() {
  console.log(`[csp-smoke] starting next start on port ${PORT}`);
  const child = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: WEBSITE_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  // Capture stderr so a real boot failure surfaces in CI logs.
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[next start] ${chunk}`);
  });
  child.stdout.on('data', (chunk) => {
    if (process.env.CSP_SMOKE_VERBOSE) {
      process.stdout.write(`[next start] ${chunk}`);
    }
  });

  try {
    await waitForServer(child);

    for (const path of PATHS_TO_CHECK) {
      const { url, status, csp, headerName } = await probe(path);

      if (!csp) {
        fail(`${url} (status ${status}) — no Content-Security-Policy header present`);
        continue;
      }

      const fails = assertCsp(url, csp);
      if (fails === 0) {
        console.log(`[csp-smoke] PASS — ${url} (status ${status}) — ${headerName}`);
        console.log(`           ${csp}`);
      }
    }
  } finally {
    // Remove stdio listeners before killing — lingering `data` listeners on the
    // child's piped stderr/stdout keep libuv stream handles open, which can
    // prevent this Node process from exiting promptly after the child dies.
    // Observed on Linux CI runners as a workflow timeout cancellation despite
    // assertions passing.
    child.stdout.removeAllListeners();
    child.stderr.removeAllListeners();
    child.kill('SIGTERM');
    // Give it a moment to clean up, but don't hang CI.
    await sleep(500);
    if (child.exitCode == null) child.kill('SIGKILL');
  }

  if (process.exitCode === 1) {
    console.error('[csp-smoke] one or more CSP assertions failed.');
  } else {
    console.log('[csp-smoke] PASS — all CSP assertions satisfied.');
  }

  // Belt-and-braces: force-exit on the success path. Even with stdio listeners
  // removed above, residual handles can occasionally keep the loop alive on
  // CI. Honour any exitCode already set by `fail()`.
  process.exit(process.exitCode ?? 0);
}

main().catch((err) => {
  console.error('[csp-smoke] UNCAUGHT ERROR', err);
  process.exit(2);
});
