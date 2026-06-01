/**
 * sidebar-routes.ts — pure data + helpers for the workspace sidebar.
 *
 * E6.3 Task 3.2. Split out from `Sidebar.tsx` so the entry list, the
 * env-flag visibility helper, and the active-route matcher can be unit-
 * tested without a DOM. `Sidebar.tsx` itself stays a `'use client'`
 * component that calls `usePathname()` and composes the visuals.
 *
 * Three reasons for the split:
 *
 *   1. Vitest runs in a `node` environment (see `vitest.config.ts`). Any
 *      `.tsx` file with React JSX would need a browser-env override to
 *      import in vitest. Keeping the pure logic in `.ts` sidesteps that
 *      entirely.
 *
 *   2. The active-route matcher is a small but load-bearing piece: it
 *      handles the `/app` → "Employees" home-route convention plus the
 *      deep-link prefix rule. A regression here would silently fail the
 *      §8.3 "active route highlighted" AC. A unit test catches it.
 *
 *   3. Visibility (env-flag gating) is the spec-mandated mechanism for
 *      "hide entries whose underlying E5 feature has not landed yet"
 *      (spec §5.2 + Task 3.2 AC). Documenting the function in one place
 *      and testing the static-reference rule (see `isVisible` comment)
 *      keeps the contract enforceable.
 *
 * No JSX, no React imports, no DOM. Safe to import from anywhere — server
 * components, client components, tests, future server actions.
 */

import type { LucideProps } from '@/components/brand/Icon';
import {
  Users,
  Tag,
  CalendarRange,
  Calculator,
  Scale,
  GitCompareArrows,
  Settings,
} from '@/components/brand/Icon';

/**
 * A single nav entry. Shape kept as a literal record (not an enum) so new
 * entries are a one-line addition; no parallel type to keep in sync.
 */
export interface SidebarEntry {
  readonly slug: string;
  readonly label: string;
  readonly href: string;
  readonly icon: React.ComponentType<LucideProps>;
  /**
   * Env-var name that gates entry visibility. `null` = always visible.
   * Read at render time via the inline switch in `isVisible()` so the
   * Next.js inliner sees the static reference and bakes the value at
   * build time.
   */
  readonly flag: string | null;
}

/**
 * Sidebar entries in display order. Order is the source of truth — the spec
 * (§5.2) names them in this order and the user persona research (§4.1)
 * suggests it (Employees first because that's where the payroll manager's
 * daily work starts).
 */
export const SIDEBAR_ENTRIES: readonly SidebarEntry[] = [
  {
    slug: 'employees',
    label: 'Employees',
    href: '/app/employees',
    icon: Users,
    // Always visible — Employees is the structural anchor of the shell.
    flag: null,
  },
  {
    slug: 'pay-codes',
    label: 'Pay codes',
    href: '/app/pay-codes',
    icon: Tag,
    flag: 'NEXT_PUBLIC_FEATURE_PAY_CODES',
  },
  {
    slug: 'pay-history',
    label: 'Pay history',
    href: '/app/pay-history',
    icon: CalendarRange,
    flag: 'NEXT_PUBLIC_FEATURE_PAY_HISTORY',
  },
  {
    slug: 'valuations',
    label: 'Valuations',
    href: '/app/valuations',
    icon: Calculator,
    flag: 'NEXT_PUBLIC_FEATURE_VALUATIONS',
  },
  {
    slug: 'liability',
    label: 'Liability',
    href: '/app/liability',
    icon: Scale,
    flag: 'NEXT_PUBLIC_FEATURE_LIABILITY',
  },
  {
    slug: 'reconciliation',
    label: 'Reconciliation',
    href: '/app/reconciliation',
    icon: GitCompareArrows,
    flag: 'NEXT_PUBLIC_FEATURE_RECONCILIATION',
  },
  {
    slug: 'settings',
    label: 'Settings',
    href: '/app/settings',
    icon: Settings,
    // Always visible — every shell needs a Settings anchor even if the
    // page is a placeholder. Underlying surfaces can be gated separately.
    flag: null,
  },
];

/**
 * Returns `true` when the entry should render.
 *
 * Rules:
 *   - `flag === null` → always visible.
 *   - `flag === '<env var name>'` → visible iff that env var === `'true'`.
 *
 * Strict equality on the literal string `'true'` mirrors Vercel's
 * convention for boolean env vars — explicit, no truthy-string footguns.
 *
 * The inline `switch` is required for Next.js's build-time inliner: the
 * inliner rewrites `process.env.NEXT_PUBLIC_*` accesses only when the
 * key is a static literal. Dynamic accessor `process.env[key]` would
 * leave the lookup as a runtime no-op (env vars aren't present in the
 * browser). Hence: each flag is referenced by name.
 *
 * Adding a new entry means adding a `case` here too — that is the right
 * kind of friction. A flag without a static reference is an inert flag.
 */
export function isVisible(flag: string | null): boolean {
  if (flag === null) return true;
  switch (flag) {
    case 'NEXT_PUBLIC_FEATURE_PAY_CODES':
      return process.env.NEXT_PUBLIC_FEATURE_PAY_CODES === 'true';
    case 'NEXT_PUBLIC_FEATURE_PAY_HISTORY':
      return process.env.NEXT_PUBLIC_FEATURE_PAY_HISTORY === 'true';
    case 'NEXT_PUBLIC_FEATURE_VALUATIONS':
      return process.env.NEXT_PUBLIC_FEATURE_VALUATIONS === 'true';
    case 'NEXT_PUBLIC_FEATURE_LIABILITY':
      return process.env.NEXT_PUBLIC_FEATURE_LIABILITY === 'true';
    case 'NEXT_PUBLIC_FEATURE_RECONCILIATION':
      return process.env.NEXT_PUBLIC_FEATURE_RECONCILIATION === 'true';
    default:
      return false;
  }
}

/**
 * Returns the subset of `SIDEBAR_ENTRIES` whose flags resolve to visible.
 */
export function visibleEntries(): readonly SidebarEntry[] {
  return SIDEBAR_ENTRIES.filter((entry) => isVisible(entry.flag));
}

/**
 * Decides whether the entry's href is currently active.
 *
 * Rules:
 *   1. Exact path match → active.
 *   2. Pathname has the entry href as a prefix followed by `/` → active
 *      (so `/app/employees/123` highlights "Employees").
 *   3. Pathname is `/app` or `/app/` → "Employees" is active (post-login
 *      home convention).
 */
export function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (pathname.startsWith(href + '/')) return true;
  if ((pathname === '/app' || pathname === '/app/') && href === '/app/employees') {
    return true;
  }
  return false;
}
