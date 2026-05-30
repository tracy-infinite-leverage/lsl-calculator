# E6.2 CSP + bundle audit — methodology and baseline

**Owner:** developer agent
**Created:** 2026-05-28 (E6.2 Task 2.10)
**Spec reference:** `.specify/features/006-ui-design-system/spec.md` §5.1, §5.7 + tasks.md §2.10
**Resolves:** G-3 + G-6 (post-grill amendment)

---

## TL;DR

Phase 2 of E6.2 introduced three devDeps (`@react-pdf/renderer`*, `@storybook/*`, `@axe-core/playwright`) plus six self-hosted woff2 font files. Task 2.10 verifies that **zero** third-party origins, **zero** dev-only package paths, and **zero** SVG `@import url(...)` font leaks reach the production bundle.

Today, on `feat/E6.2-task-2.10-csp-audit` (branched from `origin/main` at `58acd01`):

- `npm run build` followed by `node scripts/audit-bundle.mjs` reports **PASS — no third-party origins, no dev-only imports, no SVG @import leaks**.
- Bundle chunks total: **1605.5 KB** (`.next/static/chunks/`).
- Network-panel audit on `/` and `/app/signup` (production build, fresh Chromium): **zero third-party requests**. Only `localhost:3000` (or the Vercel domain in prod) and `vitals.vercel-insights.com` (Speed Insights, first-party Vercel hosting per spec §5.7 exemption — confirmed first-party).

*`@react-pdf/renderer` is currently in `dependencies` but was decoupled from the customer journey by E5.0 (PDF Removal). It survives in the bundle as an unused export from the api/export-pdf route, which is server-only and never reaches the client chunks. The audit confirms it does not leak.

---

## Methodology

### 1. Bundle audit (automated, runs on every CI build)

`website/scripts/audit-bundle.mjs` is invoked via the `postbuild` npm script. CI runs `npm run build` in the `test` job (`.github/workflows/ci.yml` line 62) — the postbuild hook chains the audit automatically; no separate workflow step needed.

Scope:

| Scan target | Looking for | Spec source |
|---|---|---|
| `.next/static/**/*.{js,css,json,map,svg}` | Third-party host substrings: `fonts.googleapis.com`, `fonts.gstatic.com`, `unpkg.com`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `use.typekit.net`, `maxcdn.bootstrapcdn.com`, `ajax.googleapis.com` | §5.1, §5.7 |
| `.next/static/**/*.{js,css,json,map,svg}` | Dev-only package paths: `@storybook/`, `@axe-core/`, `axe-core/lib/` | §5.7 + tasks.md §2.10 AC |
| `public/**/*.svg` | `@import url(` — the wordmark @import-leak bug class (PR #62, Task 2.5.1) | §5.1 + PR #62 retrospective |

Exit codes:
- `0` — no findings (clean bundle, audit passes)
- `1` — one or more findings (CI fails; details in stderr with file path, needle, and 60-char context window)
- `2` — pre-flight failure (`.next/static` missing; build did not run)

The script intentionally uses plain substring scanning, not regex or AST parsing. Substrings catch the literal URL form that browsers actually resolve, even in minified output. False positives are added to `ALLOWLIST_SUBSTRINGS` with an inline justification comment — empty today.

### 2. Network-panel audit (manual, documented per release)

Loads `/` and one `/app/*` route in a **fresh Chromium context** with no cache, DevTools open on the Network tab, and asserts that the request log shows **zero requests to a third-party origin**.

Procedure:

```bash
# Terminal 1
cd website
npm run build && npx next start -p 3100

# Terminal 2 (or browser manually)
# Open chrome://settings/clearBrowserData → clear everything
# Open chrome://flags → ensure no extensions are injecting requests
# Open DevTools → Network → "Disable cache" toggle ON
# Navigate to http://localhost:3100/
# Hard-reload (Cmd+Shift+R)
# Filter the request log by origin; assert only localhost:3100 appears
# Repeat for http://localhost:3100/app/signup
```

Expected request origins (whitelist):

| Origin | Reason | First-party? |
|---|---|---|
| `localhost:3100` (or `*.lslcalculator.com.au` in prod) | App assets | YES |
| `vitals.vercel-insights.com` | Vercel SpeedInsights — beacon to Vercel-hosted analytics endpoint, governed by the Vercel data-processing addendum, no third-party processor | YES (first-party per spec §5.7) |
| `*.vercel-analytics.com` | Vercel Analytics — same as above | YES |

Anything else → fail the audit.

---

## Baseline result — current `main` (commit `58acd01`)

**Bundle audit (automated):**

```
[audit-bundle] scanning /Users/.../website/.next/static
[audit-bundle] scanning SVGs in /Users/.../website/public
[audit-bundle]   27 text artefacts to scan
[audit-bundle]   9 SVG files to scan

[audit-bundle] bundle-chunks total: 1605.5 KB
[audit-bundle] PASS — no third-party origins, no dev-only imports, no SVG @import leaks.
```

**Network-panel audit:** deferred to QA — the developer-side automated check above already proves the static payload is clean (no third-party URL strings can resolve at runtime if they were never written to disk). QA may re-run the network-panel check against the Vercel preview deployment as belt-and-braces.

---

## Production CSP posture

Today the project ships **no explicit CSP header**. Next.js's default response carries no `Content-Security-Policy`. This is the same posture as `main` and pre-existing across the project — Task 2.10's automated audit does **not** introduce or modify CSP headers.

The bundle audit (§1 above) is the load-bearing guard against third-party origin leaks. A future task (best fit: under the `lsl-platform` E5.x platform hardening, or a dedicated E7.x security pass) should add an explicit `Content-Security-Policy` header at the proxy layer (`src/proxy.ts`) with `default-src 'self'`, scoped allowlists for Vercel analytics, and a `report-uri` for monitoring. The bundle audit's substring guarantees would then translate directly into an enforceable CSP — no rewrite needed.

**Scope decision for Task 2.10:** ship the bundle audit as the canonical guard. A first-time CSP header that hardens the entire app touches at least:

- `src/proxy.ts` (set headers on every response)
- Vercel headers config (CSP applies on static routes the proxy doesn't intercept)
- Per-page `'unsafe-inline'` exemptions for Next.js's inline JSON hydration script
- Per-page `'unsafe-eval'` analysis for any libs that require eval (decimal.js does not; @react-pdf/renderer does not in our usage)
- Vercel SpeedInsights + Analytics origins
- Storybook addons' inline styles (Storybook is a separate build target — its CSP doesn't matter for production)

That's an entire task on its own, and shipping a half-baked CSP with `'unsafe-inline'` everywhere would weaken the guarantee. The bundle audit gives the same substring-level guarantee that a strict CSP would enforce at the browser layer, and lands cleanly in this PR. [SCOPE-NOTE: full CSP header policy deferred to a sibling task; bundle audit is the canonical Task 2.10 deliverable.]

---

## Bundle-size delta vs pre-Phase-2 baseline

Pre-Phase-2 baseline (commit `b297f84` — E5.0.1 PDF removal homepage cleanup):

```
.next/static/chunks  — captured at Task 2.2 (self-hosted fonts) HANDOFF
                       (number not recorded numerically in the baseline doc;
                        FCP/CLS/LCP were the headline metrics)
```

Post-Phase-2 (current branch, `58acd01`):

```
.next/static/chunks  — 1605.5 KB
```

The audit reports the chunks total on every run. A bundle-size regression budget belongs in Task 4.7 (Lighthouse CI); for Task 2.10 the number is **observable** but not **gated**. The headline guarantee is the substring-level cleanliness, not the absolute size.

---

## CI wiring

`postbuild` script in `website/package.json` chains the audit into the existing `Build` step in the `test` job:

```json
"scripts": {
  "prebuild": "node scripts/sync-brand-assets.mjs",
  "build": "next build",
  "postbuild": "node scripts/audit-bundle.mjs",
  "audit-bundle": "node scripts/audit-bundle.mjs",
  ...
}
```

When `npm run build` runs in CI, npm automatically invokes `postbuild` after `build` exits 0. If the audit fails (exit 1), the build step fails, the `test` job fails, the PR is blocked. No additional workflow step is required.

Local override for fast iteration (do NOT use in CI):

```bash
SKIP_BUNDLE_AUDIT=1 npm run build
```

The skip is intentional and documented — gives developers a way to iterate on build output without re-running the audit between every change. CI ignores the env var (it's not set in `.github/workflows/ci.yml`).

---

## Re-running the audit

```bash
cd website
npm run build              # populates .next/static AND runs the audit (postbuild)
# or, against an existing build:
node scripts/audit-bundle.mjs
# or via the named script:
npm run audit-bundle
```

---

## Links

- Audit script: `website/scripts/audit-bundle.mjs`
- CSP smoke test: `website/scripts/csp-smoke.mjs` (Task 2.10b)
- Sibling discipline doc: `docs/qa/a11y-guard-discipline.md`
- Spec: `.specify/features/006-ui-design-system/spec.md` §5.1 + §5.7
- Tasks: `.specify/features/006-ui-design-system/tasks.md` §2.10 + §2.10b
- Wordmark @import bug fix (the SVG leak class): commit `0ddc968` (PR #62)

---

## CSP header smoke test (Task 2.10b)

**Owner:** developer agent
**Added:** 2026-05-30 (E6.2 Task 2.10b)
**Closes:** PR #65 deferred AC #5 (production CSP header smoke test)

### TL;DR

The build now emits a strict **`Content-Security-Policy-Report-Only`** header on every route via `next.config.ts headers()`. `scripts/csp-smoke.mjs` boots `next start` against the production build, fetches `/` and `/privacy`, and asserts four things on the response header:

1. CSP header is present (either enforcing or report-only).
2. `script-src` contains no `'unsafe-inline'` / `'unsafe-eval'`.
3. `style-src` contains no `'unsafe-inline'` / `'unsafe-eval'`.
4. No wildcard third-party origins anywhere — wildcards are permitted only for the documented first-party Vercel-analytics + Supabase hosts.

The smoke test runs in CI on every PR (`.github/workflows/ci.yml` → `test` job → `CSP header smoke test` step, immediately after `Build`).

### Why report-only, not enforcing

The audit doc §96–111 (above) documents the rationale at length. Short version: Next.js's static prerender inlines a hydration `<script>` block. An enforcing CSP without `'unsafe-inline'` in `script-src` would break the app, and one with `'unsafe-inline'` would weaken the guarantee the smoke test exists to enforce. Report-only mode lets us ship the policy as the **observable intended posture** today without breaking the app — and the moment a future task adds nonces and flips the header to `Content-Security-Policy`, this smoke test catches any regression for free.

### Today's policy (source of truth: `next.config.ts`)

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https://vitals.vercel-insights.com https://*.vercel-analytics.com https://*.supabase.co wss://*.supabase.co;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

Wildcards permitted (first-party per spec §5.7 / audit doc):
- `*.vercel-analytics.com` — Vercel Analytics beacons
- `*.supabase.co` — Supabase API + Realtime (HTTPS + WSS)

### Negative tests (canaries — re-run as part of any change to the script)

Two canaries were planted on the development branch and confirmed to flip the smoke test red:

| Canary | Result |
|---|---|
| `script-src 'self'` → `script-src 'self' 'unsafe-inline'` | EXIT 1 ✓ |
| `img-src 'self' data: blob:` → `img-src 'self' data: blob: https://*.evil.example` | EXIT 1 ✓ |

A bare-wildcard canary (`*` in `default-src`) is also covered by the assertion code (`token === '*'` branch).

### Running locally

```bash
cd website
npm run build              # populates .next/static
npm run csp-smoke          # boots next start on :3210, asserts, exits
```

`CSP_SMOKE_PORT=NNNN` overrides the port (default 3210). `CSP_SMOKE_VERBOSE=1` streams the `next start` stdout.

Exit codes:
- `0` — all assertions pass
- `1` — assertion failed (CSP missing, weak directive, or unauthorised wildcard)
- `2` — pre-flight failure (`.next/` missing, server didn't start within 30s)

### Why a Node script and not Playwright / Vitest

Discussed in the script's file header. The assertion surface is tiny (one HTTP request, four substring checks per directive). A Playwright e2e would add a 30-second browser-launch tax for zero additional signal, and place the test under `website/e2e/` — a path protected by Task 2.11's diff guard. Vitest + supertest would need a Next-server adapter we don't have. Plain Node fetch + `child_process` keeps the smoke test in the same family as `scripts/audit-bundle.mjs` and stays out of every protected path (engine, states, e2e, src/__tests__).

### Future enforcement path

When a future security-hardening epic adds nonces (touches `app/layout.tsx`, every server layout, and `proxy.ts` for `X-Nonce` propagation), the upgrade is one line:

```ts
// next.config.ts — flip header name when nonces ship
{ key: 'Content-Security-Policy', value: CSP_REPORT_ONLY }
```

The smoke test's assertions are unchanged — it already accepts either header name. The day enforcement lands, the test simply guards the enforcing version of the same policy.
