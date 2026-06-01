# E6.3 Task 3.5 — ConfirmDestructiveDialog

**Date:** 2026-05-31
**Branch:** `feat/E6.3-3.5-confirm-destructive` (off `main`)
**Worktree:** `/Users/tracyangwin/code-projects/lsl-e6-3`
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.5 §5.2 + §8.3 + R-5
**Task:** `.specify/features/006-ui-design-system/tasks.md` Task 3.5 (size S, lines 389–405)

---

## What shipped

A wrapper component that fronts any destructive write action (delete
employee, hard-reset pay-code mapping, delete saved valuation, etc.) and:

- **Reads `isActingNonHome` from `TenantContext`** via the
  `useTenantContext` hook landed by PR #102 (Task 3.3).
- **When acting on a non-home tenant:** opens a confirm dialog whose title
  is amended with the active tenant name (`<title> — confirming on
  <tenant>`) and whose body leads with `You are acting on <tenant>.` The
  user must explicitly click Confirm to proceed.
- **When acting on the home org:** SKIPS the dialog entirely. The click
  on the trigger fires `onConfirm` directly via a transparent
  `<span display:contents>` wrapper. **This is the operator's locked
  decision** — recorded inline in the component file header AND the
  spec/PR per dispatch instruction.

## Operator decision (locked at task kickoff)

**SKIP on home org.** Per spec §5.2 the dialog is only MANDATED for
non-home-tenant context. R-5 (success criterion 4 — zero mis-tenant write
incidents) is bounded by the non-home case: a mis-tenant write can only
happen OFF home org. Per tasks.md G-8: same confirm friction on every
home-org destructive action is hostile UX — caller signed in to their
own org clicks "delete" → already confirmed by clicking the destructive
button.

The home-org branch is a single boolean below the file header; if any
pilot user reports a near-miss in home-org context, flipping the default
is a one-line change.

## API shape — component wrapper

Chose a **component** (not a hook). Rationale captured in
`ConfirmDestructiveDialog.tsx` file header:

1. **Composability with E6.2 Dialog primitives.** The shadcn / Radix
   Dialog is component-based (`<Dialog>` + `<DialogTrigger asChild>`);
   wrapping it keeps the same composition as existing modal consumers
   (`unblock-jurisdiction-modal.tsx`, `classifier-confirm-modal.tsx`).
2. **Memberships prop bag.** The dialog needs the human-readable active
   tenant name — which lives in `memberships` (same source as
   `ActingAsBanner`). A hook would force every call site to thread
   memberships through React context or props anyway.
3. **Presentation / live split.** The established Phase 3a pattern
   (`TenantSwitcher`, `ActingAsBanner`) splits a Storybook-renderable
   `*Presentation` from a hook-consuming live wrapper. That only
   composes cleanly with a component.
4. **Async + error state.** Easier to surface loading + error state via
   component lifecycle than via an imperative hook that has to manage
   its own portal.

Usage:

```tsx
<ConfirmDestructiveDialog
  memberships={memberships}
  trigger={<Button variant="destructive">Delete employee</Button>}
  title="Delete employee"
  description="This permanently removes Sarah Connor and all pay history."
  confirmLabel="Delete employee"
  onConfirm={async () => {
    await deleteEmployee(id);
  }}
/>
```

On non-home tenant context the title becomes:

> "Delete employee — confirming on Bondi Bookkeeping"

…and the body leads with:

> "You are acting on Bondi Bookkeeping."

## Files touched

NEW:

- `website/src/components/app-shell/ConfirmDestructiveDialog.tsx`
  `'use client'` Client Component — exports `ConfirmDestructiveDialog`
  (live, hook-consuming) and `ConfirmDestructiveDialogPresentation`
  (pure-prop, Storybook-renderable).
- `website/src/components/app-shell/ConfirmDestructiveDialog.stories.tsx`
  Five stories: ActingOnClient, LongTenantName, FallbackToId,
  HardResetMapping, HomeOrgSkipsDialog. axe `'error'` mode.
- `website/src/components/app-shell/ConfirmDestructiveDialog.test.ts`
  27 source-level structural tests covering: the locked operator
  decision (skip on home org), R-5 tenant identification in title +
  body, Dialog primitive composition (brand-destructive variant, asChild
  trigger forwarding, ARIA wiring), async + error semantics (close on
  resolve / stay-open + surface error on reject, block-close-while-pending,
  re-throw on home-org skip path), Presentation / live split, context
  consumption, spec/tasks discoverability.

MODIFIED: none. This task is purely additive — the dialog is a wrapper
that other features (delete employee, hard-reset mapping, delete saved
valuation) will mount when they ship.

## Mount strategy

The dialog is **not mounted in the app-shell layout** — it's a wrapper
each destructive-action call site uses individually. The first
consumers will be (out of scope for this task):

- Delete-employee button on `/app/employees/<id>` — Phase 3b territory,
  closed; lands when E5.2 ships the delete server action.
- Hard-reset pay-code mapping on `/app/pay-codes/<id>` — Phase 3b
  territory, closed.
- Delete-saved-valuation on `/app/valuations/<id>` — E5.2+ surface.

The dialog file lives in `components/app-shell/` (next to
`TenantSwitcher` and `ActingAsBanner`) because it consumes the same
`TenantContext` + `memberships` prop bag as those siblings. The
co-location keeps the multi-tenant primitives discoverable in one folder.

## Behaviour matrix

| State | Click → | Dialog | onConfirm |
|---|---|---|---|
| `isActingNonHome === true`, idle | Open dialog | rendered | not called |
| `isActingNonHome === true`, user clicks Confirm | (already open) | rendered | `await onConfirm()` |
| `isActingNonHome === true`, `onConfirm` resolves | — | closes | resolved |
| `isActingNonHome === true`, `onConfirm` rejects | — | STAYS OPEN, surfaces error inline | rejected (caller-controlled retry) |
| `isActingNonHome === false`, click trigger | bypass | NOT rendered | `await onConfirm()` immediately |
| `isActingNonHome === false`, `onConfirm` rejects | — | (no dialog) | re-thrown to caller |

The asymmetric error-handling (surface inline vs re-throw) is
deliberate:

- **Non-home dialog branch:** the user is mid-confirmation, the dialog
  is on screen, the natural surface for an error message is inside the
  dialog. Closing it on reject would silently swallow the failure —
  exactly the wrong outcome for a destructive action.
- **Home-org bypass branch:** no dialog is mounted, no place to render
  an error message. Re-throwing lets the caller's existing error
  boundary (or toast surface) handle it. Same UX the caller's button
  would have if there were no dialog wrapper at all.

## Accessibility notes

- **Focus management** — handled by Radix UI Dialog: focus trap on
  open, focus restoration to trigger on close, Escape-to-close,
  `aria-modal`. The dialog wrapper only composes; no focus wiring needed.
- **First focus on open** — Radix focuses the first focusable
  descendant by default, which is the **Cancel** button. This is the
  safe default for a destructive action: pressing Enter immediately
  cancels rather than confirms. The user has to deliberately tab to
  the Confirm button.
- **DialogTitle** is the accessible name → screen reader announces
  `"Delete employee — confirming on Bondi Bookkeeping, dialog"` on open.
- **DialogDescription** is wired via Radix's `aria-describedby` →
  screen reader reads the body copy automatically.
- **Error surface** carries `role="alert"` + `aria-live="assertive"` so
  failures are announced immediately. (Body description was already
  announced on open; the error is a follow-up state change that
  warrants assertive interruption.)
- **Home-org branch** wraps the trigger in `<span display:contents>` —
  zero layout impact, no role/tab-index added. The underlying button
  keeps its native focus + keyboard semantics; we only intercept the
  click event in the bubble phase. `aria-busy` is set on the wrapper
  while a confirm is pending so assistive tech announces the busy
  state.

## R-5 alignment markers

The literal phrase **"confirming on"** in the dialog title and **"You
are acting on"** in the body are load-bearing R-5 markers (success
criterion 4 — zero mis-tenant write incidents). The test suite greps
for both so a future copy-edit that drops either marker fails CI.

The tenant label structure mirrors `ActingAsBanner`'s `"Acting as:
<name>"` — the user gets the same visual + textual mapping in both
surfaces. One less thing to interpret in the moment that matters most.

The fall-back-to-ID safety net also matches `ActingAsBanner`: if the
membership name lookup misses (e.g. memberships fetch races the
cookie), the dialog falls back to the bare tenant ID — ugly but
unmissable. Empty handle (`" — confirming on "`) would defeat R-5.

## Local gates

- `npx tsc --noEmit` — clean (no output).
- `npm run test` — **2847 passed, 32 skipped** (no regressions; 27 new
  tests added by this task land in the suite).
- `npm run build` — clean. `audit-bundle` PASS (1798.5 KB total — same
  as PR #113 baseline; the dialog code only renders when mounted by a
  consumer and so doesn't enter the initial bundle).
- `npx eslint` on every touched file — clean.
- `npx playwright test --project=chromium` — **24 passed, 1 skipped**
  (the skipped test is auth-signup-verify, same as on PR #113;
  unrelated to this task).

## Acceptance Criteria — coverage

Spec §8.3 + R-5 (lines 397–401 of tasks.md):

- [x] Dialog appears on destructive actions under non-home tenant
      (non-home branch renders the full Dialog with `brand-destructive`
      variant; ActingOnClient + LongTenantName + FallbackToId stories
      cover the rendered path).
- [x] Dialog title + body name the active client tenant (literal
      `confirming on` in title + `You are acting on` in body; structural
      tests assert both).
- [x] Tests cover both home-org and non-home-org branches (27 structural
      tests across 7 describe groups; the home-org branch is its own
      group with 5 specs).
- [x] Operator decision on home-org dialog default recorded inline at
      task kickoff (file header + this HANDOFF + the PR body).

## Out-of-scope (NOT touched)

Per dispatch:

- `website/tests/**` (diff-guard)
- `website/src/lib/lsl/**`, `website/src/app/(calculator)/**` (engine + Phase 3b)
- `website/src/components/ui/**`, `website/src/components/brand/**` (E6.2 — consumed only)
- `website/src/components/app-shell/{TopNav,Sidebar,UserMenu,sidebar-routes,TenantSwitcher,ActingAsBanner,memberships}*` (PR #100 + #113 — consumed only)
- `website/src/components/empty-states/**` (PR #104 — consumed only)
- `website/src/lib/tenant-context*` (consumed only)
- `website/src/lib/{format,text-rules,design-tokens,auth/session-claims,feature-flags}.ts`
- `website/src/proxy.ts` (E5.1)
- `.specify/features/005-lsl-platform/**`, `website/supabase/**`,
  `website/src/lib/data/employee/**` (parallel E5.2 session)

## Open items for QA / next task

- **Playwright e2e for the dialog open + confirm flow.** Source-level
  tests cover the structural correctness; an e2e test that opens the
  dialog under a non-home tenant context and verifies the actual title
  + body copy + onConfirm wiring belongs to Phase 4 (the design-system
  acceptance gate, PR #112 territory which has already closed for
  Phase 3b but Phase 3a's gate will come).
- **First consumer integration.** The first call site (delete-employee
  on `/app/employees/<id>`) will exercise the full flow end-to-end and
  validate the API shape under real load. Open in E5.2.
- **Setup of `aria-busy` on the home-org wrapper during pending** —
  for the home-org branch I set `aria-busy` on the `<span>` wrapper,
  but the underlying button still receives clicks (Enter, Space)
  during the in-flight `onConfirm` — only the click is gated by the
  `if (pending) return;` short-circuit. Strictly, the underlying
  trigger should also be visibly disabled during pending. Today the
  caller-supplied trigger is whatever button the call site passes
  (typically `<Button variant="destructive">`); we don't auto-disable
  it. If pilot users report double-submit issues, the next iteration
  would clone the trigger via React.cloneElement to inject
  `disabled={pending}` — but that requires casting through React 19's
  `unknown`-typed `props` field, which I deliberately deferred. The
  `if (pending) return;` guard is sufficient for the failure modes
  R-5 cares about.
