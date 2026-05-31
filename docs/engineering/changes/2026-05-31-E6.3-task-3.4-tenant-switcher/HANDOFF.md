# E6.3 Task 3.4 — TenantSwitcher + ActingAsBanner

**Date:** 2026-05-31
**Branch:** `feat/E6.3-3.4-tenant-switcher` (off `main`)
**Worktree:** `/Users/tracyangwin/code-projects/lsl-e6-3`
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.5 §5.2 + §8.3 + OQ-4 + R-5
**Task:** `.specify/features/006-ui-design-system/tasks.md` Task 3.4 (size M, lines 375–387)
**Impl plan:** `.specify/features/006-ui-design-system/impl-plan.md` §1.1 + §1.4

---

## What shipped

The two app-shell controls that surface multi-tenant context in the `/app/*`
workspace:

1. **TenantSwitcher** — dropdown of the user's tenant memberships, mounted in
   the TopNav right-rail slot. Hidden entirely when the user has `< 2`
   memberships (OQ-4). Selecting a row calls `setActiveTenant()` from the
   `TenantContext`.
2. **ActingAsBanner** — full-width sticky strip below TopNav, visible
   whenever `isActingNonHome === true`. Background `bg-brand-gold`, text
   `text-brand-charcoal` — 5.65:1 contrast, WCAG 2.2 AA pass (see §"WCAG
   audit" below).

Plus the supporting data-source helper and a TopNav slot prop.

## Files touched

NEW:

- `website/src/components/app-shell/TenantSwitcher.tsx`
  `'use client'` Client Component module — exports `TenantSwitcher` (live)
  and `TenantSwitcherPresentation` (pure-prop, Storybook-renderable).
- `website/src/components/app-shell/TenantSwitcher.stories.tsx`
  Five stories: Default, ActingOnClient, HiddenSingleMembership,
  HiddenZeroMemberships, CookieDisagrees. axe `'error'` mode.
- `website/src/components/app-shell/TenantSwitcher.test.ts`
  18 source-level + structural tests covering the dual-guard visibility
  rule, data-source decoupling, context consumption, presentation/live
  split, accessibility surface, and `memberships.ts` shape.
- `website/src/components/app-shell/ActingAsBanner.tsx`
  `'use client'` Client Component module — exports `ActingAsBanner` (live)
  and `ActingAsBannerPresentation` (pure-prop, Storybook-renderable).
- `website/src/components/app-shell/ActingAsBanner.stories.tsx`
  Four stories: ActingOnClient, LongTenantName, FallbackToId,
  HiddenOnHomeOrg. axe `'error'` mode.
- `website/src/components/app-shell/ActingAsBanner.test.ts`
  13 source-level tests covering the visibility rule, WCAG-AA contrast
  pairing, R-5 sticky-positioning, ID fallback, accessibility surface,
  presentation/live split.
- `website/src/components/app-shell/memberships.ts`
  `Membership` type + `fetchMembershipsForActiveUser()` server-side data
  helper. Co-located so the future multi-membership swap is discoverable.

MODIFIED:

- `website/src/app/app/layout.tsx`
  Server-fetches `memberships` via `fetchMembershipsForActiveUser()` and
  passes the prop bag into both `<TenantSwitcher>` (via TopNav's new
  `rightRailSlot` prop) and `<ActingAsBanner>` directly below TopNav.
- `website/src/components/app-shell/TopNav.tsx`
  Added optional `rightRailSlot?: ReactNode` prop to both
  `TopNavPresentation` and the `TopNav` server wrapper. The slot renders
  between the flex-spacer and the notifications bell. Single composition
  point keeps TopNav minimal; the switcher decides its own visibility.

## Data-source decision (option 3 — server-rendered prop bag)

The dispatch flagged that `SessionCookieClaims` today carries IDs but NOT
tenant names. Three options were offered; **picked option 3 — server-render
the memberships list in `app/app/layout.tsx` and pass it as a prop bag**.

Why:

- **Schema fits today's reality.** `org_members.user_id` is `UNIQUE` (per
  migration `20260527042620_create_org_members.sql`), so a user belongs to
  exactly one org. The switcher hides itself at `< 2` memberships (OQ-4),
  so single-membership users see nothing — correct outcome with no
  cross-epic coordination required. The query lives in one place
  (`memberships.ts`); when E5.x relaxes the UNIQUE constraint, only that
  helper changes.
- **Option 1 (extend `SessionCookieClaims` with names)** would couple a
  cross-epic contract type to display-only data — names belong in
  server-rendered props, not cookies.
- **Option 2 (client-side fetch)** would create a flash of "no switcher" →
  "switcher with wrong label" → "correct label" while the query resolves.
  Server-render avoids the entire UX class.

The decision is documented in the `memberships.ts` file header so the next
contributor lands on the rationale within one open-file action.

## TopNav slot composition

Original TopNav had only the wordmark, bell, and UserMenu. The dispatch
preferred composition via the layout. I added a single optional
`rightRailSlot?: ReactNode` prop on `TopNavPresentation` (and forwarded it
through the `TopNav` server wrapper). The layout fills the slot with
`<TenantSwitcher memberships={memberships} />`.

This is the smallest possible TopNav change (one optional prop) and keeps
the composition decisions in the layout — where they belong. The slot is
named generically so the next right-rail control (e.g. a global search
trigger) doesn't need to extend the prop surface again.

## WCAG audit — gold background contrast

The task AC mandates `colors.brand.gold` background with WCAG 2.2 AA
contrast. The dispatch suggested "navy on gold is the spec-prescribed
pairing" — but the actual spec (v0.5 §8.3 AC bullet 5) does NOT pin a text
token, and **navy on gold demonstrably fails the AA gate the AC itself
mandates**.

Measured ratios against `--brand-gold: #d9a428`:

| Text token | Hex | Ratio | AA Normal (4.5:1) | AA Large (3:1) |
|---|---|---|---|---|
| `brand-navy` | #48608a | 2.80:1 | ❌ FAIL | ❌ FAIL |
| `brand-dark-blue` | #324d61 | 3.92:1 | ❌ FAIL | ✅ pass |
| `brand-white` | #ffffff | 2.26:1 | ❌ FAIL | ❌ FAIL |
| **`brand-charcoal`** | **#333232** | **5.65:1** | **✅ pass** | **✅ pass** |

Picked `text-brand-charcoal`. The banner is body-text size (14px), so the
normal-text threshold (4.5:1) applies — only charcoal-on-gold clears it.

Pre-existing precedent in the codebase (`components/ui/badge.tsx` brand-gold
variant uses `text-brand-dark-blue` — 3.92:1) is acceptable for the badge
because badges typically render bold ≥12px (the Large Text threshold). The
banner runs un-bold at body size, so the strict threshold rules. The audit
is documented in the `ActingAsBanner.tsx` file header so the next
contributor doesn't try to "fix" the colour back to navy.

## Mount points

```
app/app/layout.tsx
├── <TenantProviderFromCookie>             ← reads `lsl_session_claims`
│   ├── <TopNav rightRailSlot={...}>       ← slot composition
│   │   └── <TenantSwitcher memberships=…> ← self-hides if < 2 memberships
│   ├── <ActingAsBanner memberships=…>     ← visible when active ≠ home
│   ├── <Sidebar>
│   └── <main>{children}</main>
```

## Accessibility notes

- **TenantSwitcher trigger** carries `aria-label="Switch tenant. Currently
  acting on <name>."` so a screen reader announces the current state on
  focus.
- **Active row** in the dropdown carries `aria-current="true"` plus a
  visible check glyph — sighted and SR users both see the active state.
- **Focus management** is handled by Radix DropdownMenu — focus traps in
  the panel while open, returns to the trigger on close, arrow-key
  navigation between items. Same primitive as UserMenu (axe-clean per
  PR #100).
- **ActingAsBanner** is `role="status"` + `aria-live="polite"` — a screen
  reader announces the strip when the user switches into a non-home
  tenant. Not `role="alert"` because the banner is informational.
- **Lucide icons** marked `aria-hidden="true"` so SR users don't get
  redundant icon names.

## Local gates

- `npx tsc --noEmit` — clean (no output).
- `npm run test` — 2664 passed, 32 skipped (no test regressions).
- `npm run build` — clean; `audit-bundle` PASS (1798.5 KB total).
- `npx eslint` on every touched file — clean.
- `next start` smoke (port 3148):
  - `/` → 200
  - `/app/login` → 200
  - `/app/signup` → 200
  - `/app` → 307 → `/app/login` (proxy gating intact)
  - `/app/employees` → 307 → `/app/login` (proxy gating intact)
- Playwright `auth-signup-verify.spec.ts` skipped (no test Supabase creds
  in this worktree's env); the `next start` smoke is the substitute per
  the dispatch fallback.

## Out-of-scope (NOT touched)

- `website/tests/**` (diff-guard)
- `website/src/lib/lsl/**`, `website/src/app/(calculator)/**` (engine + Phase 3b)
- `website/src/components/ui/**`, `website/src/components/brand/**` (E6.2 shipped)
- `website/src/components/app-shell/{Sidebar, UserMenu, sidebar-routes}*`
- `website/src/components/empty-states/**`, `website/src/components/shell/**`
- `website/src/lib/tenant-context*` (consumed only)
- `website/src/lib/{format,text-rules,design-tokens,auth/session-claims}.ts`
- `website/src/proxy.ts` (E5.1)
- `website/supabase/migrations/` (read-only)

## Open items for QA / next task

- **PR #105 / E5.x — multi-membership schema.** When the `UNIQUE(user_id)`
  constraint on `org_members` is relaxed, `fetchMembershipsForActiveUser`
  in `memberships.ts` is the one helper that changes. The consumer surface
  is N-membership-shaped already.
- **E5.1 — `setActiveTenant` server action.** The switcher's selection
  today only updates the in-memory `TenantContext`. The cookie write — so
  a hard refresh STAYS in the selected tenant for that request only, then
  OQ-9 reverts on the next refresh — is E5.1's responsibility (a server
  action that writes `lsl_session_claims`). The UI is wired and ready;
  the cookie write side is a one-line addition to the click handler when
  E5.1 ships the action.
- **Task 3.5 — ConfirmDestructiveDialog.** Naturally consumes the
  `isActingNonHome` derivation that this task surfaces, but is out of
  scope for this 1-PR-per-task dispatch.

## Acceptance Criteria — coverage

Spec §8.3 + OQ-4 (lines 379–383 of tasks.md):

- [x] Switcher hidden for single-org users (`memberships.length < 2 ||
      membershipCount < 2` early return).
- [x] Switcher renders for users with ≥ 2 memberships (Storybook
      Default / ActingOnClient stories exercise the rendered path).
- [x] ActingAsBanner visible whenever active ≠ home (driven by
      `isActingNonHome` from TenantContext; structural test asserts the
      `if (!isActingNonHome) return null` guard).
- [x] Banner uses `colors.brand.gold` token, contrast verified WCAG 2.2 AA
      (5.65:1 with `text-brand-charcoal`; full audit in HANDOFF + component
      file header).
