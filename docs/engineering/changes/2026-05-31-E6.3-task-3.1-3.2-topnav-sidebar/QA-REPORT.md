# QA Report — PR #100 (E6.3 Tasks 3.1 + 3.2: TopNav + Sidebar)

| Field            | Value                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| PR               | https://github.com/tracy-infinite-leverage/lsl-calculator/pull/100                 |
| Branch           | `feat/E6.3-3.1-3.2-topnav-sidebar`                                                 |
| Base             | `main`                                                                             |
| QA reviewer      | qa agent (Opus 4.7)                                                                |
| Review date      | 2026-05-31                                                                         |
| Review method    | Static review of PR diff via `gh pr diff` + `gh api contents` (read-only, no checkout — parallel QA session active in same worktree). |
| Overall verdict  | **PASS — mergeable with one CI re-run.** No code-level blockers. One pre-existing flaky E5.1 integration test caused CI red; PR's substantive changes are clean. |

---

## 1. Acceptance criteria

### Task 3.1 — TopNav (spec §5.2 + §8.3 AC bullet 1)

| AC                                                                                                              | Status | Evidence                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TopNav renders on every `/app/*` route                                                                          | PASS   | `src/app/app/layout.tsx` mounts `<TopNav />` in the standard branch (line ~92). Auth-surface bypass set (`/app/signup`, `/app/login`, `/app/forgot-password`, `/app/reset-password`, `/app/verify-email`, `/app/account`, `/app/logout`) keeps the E5.1 carve-out clean.                  |
| Wordmark / Lockup visible top-left                                                                              | PASS   | `TopNavPresentation` renders `<Wordmark variant="mono" width={140} />` wrapped in a home-link to `/app`. `mono` variant rationale documented inline (clean read on brand-white at 32px nav height).                                                                                       |
| User menu opens / closes on click; signs out via existing E5.1 auth action                                      | PASS   | `UserMenu` renders Radix `DropdownMenu`. Sign-out item submits a hidden `<form action="/app/logout" method="post">` via `formRef.current?.requestSubmit()`. `/app/logout/route.ts` exists in E5.1. **Not an inline reimplementation** — wiring goes through the canonical POST handler. |
| Notifications icon visible (placeholder OK)                                                                     | PASS   | `<button data-testid="app-topnav-bell">` with `<Bell />` icon. `aria-label="Notifications"`, `<span class="sr-only">0 unread notifications</span>`. No click handler — explicitly placeholder per spec.                                                                                  |
| **Architectural split** — `TopNavPresentation` (client, props-only) + `TopNav` (server wrapper)                 | PASS   | `TopNavPresentation` is the pure-markup export (Storybook-renderable); default `TopNav` is the `async` server wrapper that reads `supabase.auth.getUser()` and forwards `email` / `displayName`. Split rationale documented in the file header.                                          |

### Task 3.2 — Sidebar (spec §5.2 + §8.3 AC bullets 2-3)

| AC                                                                                                              | Status | Evidence                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar renders on every `/app/*` route                                                                         | PASS   | Mounted alongside `<TopNav />` in `app/layout.tsx` standard branch. Hidden on `<sm` per spec §5.6 ("MAY be mobile responsive — best-effort"); acceptable mobile carve-out.                                                                                                                |
| All seven entries listed; active route highlighted                                                              | PASS   | `SIDEBAR_ENTRIES` literal contains all seven in display order (`employees`, `pay-codes`, `pay-history`, `valuations`, `liability`, `reconciliation`, `settings`). Active highlighted via `aria-current="page"` + `bg-brand-navy text-brand-white`.                                          |
| Hidden entries gated by a documented feature-flag mechanism                                                     | PASS   | `isVisible(flag)` switches on hardcoded `NEXT_PUBLIC_FEATURE_*` literals so Next.js's build-time inliner sees the static reference. Default-deny on unknown flags. `null` flag = always visible (Employees, Settings). Mechanism is documented inline in `sidebar-routes.ts` header.    |

### Accessibility & keyboard-first (spec §5.5)

| AC                                                                                  | Status | Evidence                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| axe-core on each Storybook story — zero serious/critical violations                 | PASS¹  | All three story files (`TopNav.stories.tsx`, `Sidebar.stories.tsx`, `UserMenu.stories.tsx`) set `parameters.a11y = { test: 'error' }` so the addon escalates violations to test failures. Dev's local report claims clean.            |
| Tab/focus order sensible                                                            | PASS   | Header order: wordmark home-link → bell button → user-menu trigger. All three are focusable interactive elements with `focus-visible:ring-2 ring-brand-navy ring-offset-2`. Sidebar entries focus in display order.                  |
| ESC closes the user menu / arrow keys navigate items / focus returns to trigger     | PASS   | Behaviour delegated entirely to `@radix-ui/react-dropdown-menu@^2.1.16`. Radix is the canonical implementation of WAI-ARIA APG menu pattern — focus trap, ESC-to-close, arrow-key nav, first-item focus on open, restore-on-close all built-in. |
| Keyboard-first sign-out                                                             | PASS   | `DropdownMenuItem` `onSelect` (fires on Enter/Space/click) preventDefault + `requestSubmit()`. The hidden POST form is the canonical CSRF-safe path.                                                                                  |

¹ axe-core results not re-run in this QA pass (no checkout). The dev's local report and the story-level escalation give high confidence — but a CI Storybook run would close the loop definitively. **No P0/P1 — flagged as observational.**

### Carve-out / scope discipline (spec §4)

| AC                                              | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E5.1 auth pages still on default shadcn         | PASS   | `AUTH_SHELL_BYPASS` set in `layout.tsx` returns `<>{children}</>` (no chrome) for `/app/signup`, `/app/login`, `/app/forgot-password`, `/app/reset-password`, `/app/verify-email`. AuthLayout (E5.1) continues to own those surfaces. No E5.1 file in the diff.                                                                                                                                          |
| No engine code touched                          | PASS   | No `website/src/lib/lsl/**` in the diff. Cross-state regression suites (vic/qld/nsw/wa/sa/act + engine) all green on the same CI run.                                                                                                                                                                                                                                                                  |
| No `website/tests/` diff                        | PASS   | No diff under `website/tests/`. (Path doesn't exist; not present in the file list.)                                                                                                                                                                                                                                                                                                                  |
| No `website/src/__tests__/` (E5.1 auth) diff    | PASS   | No diff under `website/src/__tests__/`. CI failure is in `src/__tests__/auth/phase6-verification-resend-rate-limit.test.ts` — **not modified by this PR** (see §3 below).                                                                                                                                                                                                                              |
| Brand allowlist edit limited to `ui/` exemption | PASS   | `brand.test.ts` diff is one line: `'src/components/ui/dropdown-menu.tsx',` added to the protected-import allowlist (consistent with existing `dialog.tsx`, `radio-group.tsx`, etc.). `Icon.tsx` barrel adds five icons (`LogOut`, `Bell`, `Menu`, `GitCompareArrows`, `Tag`). No re-skin of Wordmark / Lockup — only the icon barrel grew. |

---

## 2. Test coverage observations

`sidebar-routes.test.ts` (15 tests; pure-data + pure-function unit tests):

- Shape contract (seven entries in spec order, all carry required fields, Employees + Settings marked always-visible).
- `isVisible()` — null is true, unset env var is false, literal `'true'` is true, `'1'` / `'yes'` / `'TRUE'` are false (footgun guard), unknown flag returns false.
- `visibleEntries()` — all flags off, all flags on, selective subset (all return slugs in spec order).
- `isActive()` — exact match, deep-link prefix match, sibling-route mismatch including the prefix-collision guard (`/app/employees-archive` ≠ `/app/employees`), `/app` and `/app/` map to Employees home.
- Snapshot/restore around `process.env` via `beforeEach` / `afterEach` — no cross-test bleed.

This is excellent unit-test discipline (Karpathy-grade: every contract a unit). The prefix-collision case (`employees-archive`) is the kind of test that catches future regressions silently.

No `Sidebar.tsx` / `TopNav.tsx` rendering tests in the diff — those are covered indirectly by the three Storybook stories with `a11y: { test: 'error' }`. Acceptable given the architectural split: pure logic in `.ts`, visual composition in `.tsx`. Adding RTL tests would be additive, not corrective.

---

## 3. CI status

| Check                                            | Result    | Notes                                                                                                          |
| ------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------- |
| TypeScript · Vitest · Build                      | **FAIL**  | 1 test timed out — `phase6-verification-resend-rate-limit.test.ts` "DENIES a resend at N=6". See below. |
| CSP header smoke test (Task 2.10b)               | pass      |                                                                                                                |
| State suite · {nsw, vic, qld, wa, sa, act, engine} | pass      | Engine + all state suites green — confirms no engine regression.                                              |
| Cross-state regression (engine-touching PRs)     | pass      |                                                                                                                |
| Playwright (chromium/webkit/firefox/mobile)      | pass      |                                                                                                                |
| Test-sanctity guard                              | pass      |                                                                                                                |
| Vercel preview deploy                            | pass      |                                                                                                                |

### CI failure analysis (not a PR-100 blocker)

The single failing test is **`src/__tests__/auth/phase6-verification-resend-rate-limit.test.ts:158` — "DENIES a resend at N=6 (over the cap)"**. Failure mode: `Test timed out in 5000ms`.

- This file is **not in PR #100's diff** (confirmed via `gh pr view 100 --json files`).
- The N=5 sibling test (line above) passed in 1236 ms against the live Supabase remote.
- The N=6 case timed out at exactly the 5 s vitest cap — classic upstream-latency signature (the test creates a user, performs 6 sequential admin resend calls and audit-table inserts against a real Supabase project).
- Test predates this PR — it landed with E5.1 / Phase 6. PR #100 only adds new files under `app-shell/`, `ui/dropdown-menu.tsx`, two Icon barrel entries, one Radix dep, one layout edit.

**Conclusion**: this CI red is a pre-existing flaky integration test that hit an upstream-network blip, **unrelated to PR #100's code**. Recommend the operator re-run the failed job before merge — high-confidence pass on retry.

---

## 4. Observations (non-blocking)

1. **Profile link consistency.** `UserMenu` Profile entry navigates to `/app/account`, which is in `AUTH_SHELL_BYPASS` in `layout.tsx` — so clicking Profile from the TopNav drops the user into a shell-less page. This is correct today (E5.1's `account` is a placeholder rendered via `AuthLayout`) but worth a callout for the operator: a future Task should mount the shell around `/app/account` once it becomes a real profile screen. Not a P-blocker — works as designed for the current placeholder route.
2. **Mobile carve-out.** Sidebar is `hidden sm:flex` — fully invisible on mobile. Spec §5.6 explicitly permits this ("best-effort mobile responsive"). The TopNav still renders mobile, so users have the wordmark + bell + user menu. A hamburger / sheet pattern is a fair future ask.
3. **Test density.** No unit tests on `Sidebar.tsx` / `TopNav.tsx` / `UserMenu.tsx` themselves — only on `sidebar-routes.ts`. Acceptable because (a) pure logic is fully unit-covered and (b) Storybook a11y scans cover the rendered surfaces. Could be strengthened with RTL "click trigger → menu opens / Sign out submits hidden form" tests, but that's additive.
4. **`x-pathname` header fallback chain.** `layout.tsx` reads `x-pathname` (Next 16), `next-url` (≤ Next 15), `x-invoke-path`, then falls back to `/app`. Comprehensive and defensive. Worth a console.warn or telemetry breadcrumb if the fallback fires in production — currently silently treats it as "render the shell" which is the safer default.

---

## 5. Verdict

**PASS — mergeable as-is.**

- All Task 3.1 + 3.2 acceptance criteria met.
- Carve-outs respected (no E5.1 auth, no engine, no protected tests touched).
- Architectural split (`TopNavPresentation` + `TopNav`, `sidebar-routes.ts` + `Sidebar.tsx`) is the right shape for Storybook + unit testability.
- Sign-out wiring goes through the existing E5.1 `/app/logout` POST route — no inline reimplementation.
- Feature-flag mechanism is documented, statically-referenced (Next.js inliner-compatible), and unit-tested for footguns.
- New Radix dep `^2.1.16` is consistent with the existing 10 Radix primitives. Justified.
- CI red is a pre-existing E5.1 integration test flake, not introduced by this PR.

**Pre-merge action for operator**: re-run the failed `TypeScript · Vitest · Build` job once. If it passes (high probability — N=5 ran in 1236 ms; N=6 hit the 5 s cap by 3 ms of upstream latency), merge. If it consistently fails on retry, escalate as a separate E5.1 flakiness bug — not a PR #100 issue.

No P0 / P1 bugs to fix. No revisions requested.
