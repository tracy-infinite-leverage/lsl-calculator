/**
 * TenantSwitcher.test.ts — source-level + structural tests for the workspace
 * tenant switcher.
 *
 * E6.3 Task 3.4. Vitest runs `environment: 'node'` (see `vitest.config.ts`)
 * with no JSDOM — so the React tree cannot be rendered here. Coverage is
 * structural: we grep the source for the load-bearing OQ-4 guards, the
 * dual-visibility check, and the data-source decoupling that makes the
 * future multi-membership swap a one-file change.
 *
 * Matches the established pattern in `sidebar-routes.test.ts` and
 * `tenant-context.test.ts`.
 *
 * # What is NOT covered here (and where it IS covered)
 *
 *   - The dropdown panel's keyboard semantics → Radix UI's own test suite.
 *   - The full mount + click → Playwright e2e (E6.3 Phase 4).
 *   - axe-core a11y of the panel → Storybook a11y addon stories.
 *
 * # Why every assertion is greppable
 *
 * If a future contributor accidentally weakens the `membershipCount < 2`
 * guard (or drops it), the test must fail. Source-level greps achieve
 * that with no DOM dependency.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const switcherSrc = readFileSync(
  resolve(__dirname, 'TenantSwitcher.tsx'),
  'utf-8',
);
const membershipsSrc = readFileSync(
  resolve(__dirname, 'memberships.ts'),
  'utf-8',
);

describe('TenantSwitcher — OQ-4 visibility guards', () => {
  it('hides when memberships.length < 2 (data side)', () => {
    // Load-bearing OQ-4 guard. If this assertion fails, single-org users
    // could see the switcher — which violates spec §8.3 AC bullet 2.
    expect(switcherSrc).toContain('memberships.length < 2');
  });

  it('hides when membershipCount < 2 (cookie side)', () => {
    // The cookie's `membershipCount` is the canonical OQ-4 gate per
    // SessionCookieClaims contract. Both guards must be present so a brief
    // cookie/data race never leaks an empty switcher.
    expect(switcherSrc).toContain('membershipCount < 2');
  });

  it('uses a single OR-combined guard with early return', () => {
    // The two guards combine into a single `if (... || ...) return null` so
    // the surface fails CLOSED — either failure path hides the switcher.
    expect(switcherSrc).toMatch(
      /memberships\.length\s*<\s*2\s*\|\|\s*membershipCount\s*<\s*2/,
    );
    expect(switcherSrc).toMatch(/return null/);
  });
});

describe('TenantSwitcher — data-source decoupling', () => {
  it('accepts memberships as a prop (option 3 — server-rendered prop bag)', () => {
    // The data-source decision recorded in `memberships.ts` is option 3:
    // server-rendered prop bag, no client-side fetch. The switcher must
    // receive `memberships: Membership[]` as a prop, not fetch them itself.
    expect(switcherSrc).toContain('memberships: Membership[]');
  });

  it('imports the Membership type from the co-located memberships module', () => {
    // Co-location (not a global `lib/` import) keeps the future
    // multi-membership swap discoverable: the next contributor reads
    // `TenantSwitcher.tsx` and lands on `memberships.ts` one line away.
    expect(switcherSrc).toMatch(
      /from\s+['"]\.\/memberships['"]/,
    );
  });

  it('does NOT fetch data inside the component (no Supabase client import)', () => {
    // If a future refactor introduces a client-side fetch here, the build
    // would flash "no switcher" → "switcher with wrong label" → "correct
    // label" — exactly the UX we picked option 3 to avoid.
    expect(switcherSrc).not.toContain('createSupabaseServerClient');
    expect(switcherSrc).not.toContain("'@supabase/");
  });
});

describe('TenantSwitcher — context consumption', () => {
  it('consumes useTenantContext for the live setActiveTenant binding', () => {
    expect(switcherSrc).toContain('useTenantContext');
    expect(switcherSrc).toContain('setActiveTenant');
  });

  it('marks the file as a Client Component (uses React hooks)', () => {
    // `useTenantContext`, `useMemo`, and DropdownMenu (`'use client'`) all
    // require a Client boundary.
    expect(switcherSrc).toMatch(/^'use client'/m);
  });
});

describe('TenantSwitcher — Presentation / live split', () => {
  it('exports both a live and a presentational variant', () => {
    // Storybook-renderable presentation + live hook-consumer for production.
    // Mirrors the TopNav / TopNavPresentation split.
    expect(switcherSrc).toContain('export function TenantSwitcherPresentation');
    expect(switcherSrc).toContain('export function TenantSwitcher(');
  });

  it('wraps the presentational variant with the hook on the live export', () => {
    // The live `TenantSwitcher` MUST forward into
    // `TenantSwitcherPresentation` — that's how Storybook covers the markup
    // without a TenantProvider mounted above.
    expect(switcherSrc).toMatch(/<TenantSwitcherPresentation/);
  });
});

describe('TenantSwitcher — accessibility surface', () => {
  it('labels the trigger with the active tenant', () => {
    // Screen readers must announce the currently-active tenant on focus.
    expect(switcherSrc).toContain('aria-label=');
    expect(switcherSrc).toMatch(/Currently acting on/);
  });

  it('marks the active row with aria-current', () => {
    // Sighted users see a check glyph; SR users get aria-current="true".
    expect(switcherSrc).toMatch(/aria-current=\{isActive\s*\?\s*['"]true['"]/);
  });
});

describe('memberships.ts — data-source decision documentation', () => {
  it('records the option-3 decision in the file header', () => {
    // The decision MUST be discoverable for the future contributor who
    // adds multi-membership in E5.x. Greppable phrase pins the location.
    expect(membershipsSrc).toContain('Option 3 (server-rendered prop bag)');
  });

  it('exports the Membership type', () => {
    expect(membershipsSrc).toContain('export interface Membership');
  });

  it('exposes a server-only fetch helper', () => {
    // The helper is called from `app/app/layout.tsx` (Server Component).
    // Co-locating it in this folder keeps the swap surface contained.
    expect(membershipsSrc).toContain(
      'export async function fetchMembershipsForActiveUser',
    );
  });

  it('uses the canonical Supabase server client constructor', () => {
    expect(membershipsSrc).toContain('createSupabaseServerClient');
  });

  it('queries org_members joined to organisations(id, name)', () => {
    // The query shape is the single point that changes when E5.x adds
    // multi-membership. Pin the shape so a refactor that breaks it gets
    // caught here, not in production.
    expect(membershipsSrc).toMatch(/from\(['"]org_members['"]\)/);
    expect(membershipsSrc).toMatch(/select\(['"]organisations\(id, name\)['"]\)/);
  });

  it('returns an empty array when no user is resolved (fail-closed)', () => {
    // Conservative behaviour: if the user resolution fails, the switcher
    // hides (memberships.length < 2 trips OQ-4 hide). Never force-renders
    // a switcher that could land the user on the wrong tenant.
    expect(membershipsSrc).toMatch(/if\s*\(\s*!userData\.user\s*\)\s*\{\s*return\s*\[\s*\]\s*;/);
  });
});
