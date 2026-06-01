/**
 * breadcrumbs-routes.test.ts — unit coverage for the breadcrumb trail
 * builder + label map.
 *
 * E6.3 Task 3.6. The trail builder is the load-bearing piece for spec
 * §8.3 AC bullets:
 *   - "Breadcrumbs render on every `/app/*` page"
 *   - "Route labels are human-friendly (sentence case)"
 *   - "Keyboard-navigable (each crumb is a real anchor)" — covered by
 *     `Breadcrumbs.tsx` rendering `<Link>` for every non-terminal crumb.
 *     The trail data here is what feeds that — verify the structural
 *     `href !== null` contract so a regression turns the trail static.
 *
 * Vitest runs `environment: 'node'` — no DOM, no JSX. The route-map split
 * is the whole reason this file is `.ts` and not `.tsx`.
 */

import { describe, expect, it } from 'vitest';
import {
  BREADCRUMB_LABELS,
  buildTrail,
  deriveLabel,
} from './breadcrumbs-routes';

// ---------------------------------------------------------------------------
// BREADCRUMB_LABELS — shape contract
// ---------------------------------------------------------------------------

describe('BREADCRUMB_LABELS', () => {
  it('maps every shipped sidebar surface to a sentence-case label', () => {
    // Spec §5.1 brand voice: sentence case. No Title Case in chrome.
    // Each shipped sidebar route MUST have an explicit map entry so a
    // future contributor adding a route gets a one-stop grep target.
    expect(BREADCRUMB_LABELS['/app']).toBe('Home');
    expect(BREADCRUMB_LABELS['/app/employees']).toBe('Employees');
    expect(BREADCRUMB_LABELS['/app/pay-codes']).toBe('Pay codes');
    expect(BREADCRUMB_LABELS['/app/pay-history']).toBe('Pay history');
    expect(BREADCRUMB_LABELS['/app/valuations']).toBe('Valuations');
    expect(BREADCRUMB_LABELS['/app/liability']).toBe('Liability');
    expect(BREADCRUMB_LABELS['/app/reconciliation']).toBe('Reconciliation');
    expect(BREADCRUMB_LABELS['/app/settings']).toBe('Settings');
  });

  it('uses sentence case (no Title Case) on multi-word labels', () => {
    // The audit: "Pay codes" not "Pay Codes". A regression to Title Case
    // here would silently drift the chrome from the brand voice.
    expect(BREADCRUMB_LABELS['/app/pay-codes']).toBe('Pay codes');
    expect(BREADCRUMB_LABELS['/app/pay-history']).toBe('Pay history');
  });
});

// ---------------------------------------------------------------------------
// deriveLabel — fallback shape for unmapped segments
// ---------------------------------------------------------------------------

describe('deriveLabel', () => {
  it('sentence-cases a single-word slug', () => {
    expect(deriveLabel('reports')).toBe('Reports');
  });

  it('replaces dashes with spaces and sentence-cases the result', () => {
    expect(deriveLabel('pay-codes')).toBe('Pay codes');
    expect(deriveLabel('multi-word-slug')).toBe('Multi word slug');
  });

  it('collapses UUID-shaped segments to "Details"', () => {
    // Showing a raw UUID in a breadcrumb carries no signal. Until a
    // feature surfaces a meaningful dynamic label, "Details" is the
    // safe fallback.
    expect(deriveLabel('0f3b9d24-1d8a-4e2a-9c2a-7c1b1d0c9f4a')).toBe('Details');
    expect(deriveLabel('a1b2c3d4-e5f6-7890-abcd-ef0123456789')).toBe('Details');
  });

  it('collapses all-numeric IDs to "Details"', () => {
    expect(deriveLabel('123')).toBe('Details');
    expect(deriveLabel('999999')).toBe('Details');
  });

  it('returns an empty string for an empty segment (defensive)', () => {
    expect(deriveLabel('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildTrail — the main contract
// ---------------------------------------------------------------------------

describe('buildTrail', () => {
  it('returns a single terminal "Home" crumb on /app', () => {
    // The post-login home: no nav value in a multi-crumb trail.
    const trail = buildTrail('/app');
    expect(trail).toEqual([
      { label: 'Home', href: null, isCurrent: true },
    ]);
  });

  it('also returns the single terminal crumb on /app/ (trailing slash)', () => {
    // Trailing-slash normalisation. Vitest tests pathname forms that
    // Next.js might emit through `usePathname()`.
    const trail = buildTrail('/app/');
    expect(trail).toEqual([
      { label: 'Home', href: null, isCurrent: true },
    ]);
  });

  it('builds a two-crumb trail on /app/employees', () => {
    const trail = buildTrail('/app/employees');
    expect(trail).toEqual([
      { label: 'Home', href: '/app', isCurrent: false },
      { label: 'Employees', href: null, isCurrent: true },
    ]);
  });

  it('uses the sentence-case mapped label on /app/pay-codes', () => {
    const trail = buildTrail('/app/pay-codes');
    expect(trail).toEqual([
      { label: 'Home', href: '/app', isCurrent: false },
      { label: 'Pay codes', href: null, isCurrent: true },
    ]);
  });

  it('builds a three-crumb trail with a derived dynamic label', () => {
    // `/app/employees/<uuid>` is an E5.2-future route. Until a feature
    // ships a real label, the trail still renders — falls back to
    // "Details" so the crumb is meaningful.
    const trail = buildTrail(
      '/app/employees/0f3b9d24-1d8a-4e2a-9c2a-7c1b1d0c9f4a',
    );
    expect(trail).toEqual([
      { label: 'Home', href: '/app', isCurrent: false },
      {
        label: 'Employees',
        href: '/app/employees',
        isCurrent: false,
      },
      { label: 'Details', href: null, isCurrent: true },
    ]);
  });

  it('all non-terminal crumbs carry an href (keyboard-navigable contract)', () => {
    // AC §8.3 bullet 3: "Keyboard-navigable (each crumb is a real anchor)."
    // The consumer renders `href === null` as plain text and all others as
    // `<Link>`. If a non-terminal node leaked `href: null`, that crumb
    // would silently drop out of tab order.
    const trail = buildTrail('/app/employees/123/edit');
    for (let i = 0; i < trail.length - 1; i++) {
      expect(trail[i]!.href).not.toBeNull();
      expect(trail[i]!.isCurrent).toBe(false);
    }
    expect(trail[trail.length - 1]!.href).toBeNull();
    expect(trail[trail.length - 1]!.isCurrent).toBe(true);
  });

  it('returns an empty trail for paths outside /app', () => {
    // Defensive — the component should only mount under `/app/*` anyway.
    expect(buildTrail('/')).toEqual([]);
    expect(buildTrail('/calculator/single')).toEqual([]);
    expect(buildTrail('/marketing')).toEqual([]);
  });

  it('does not confuse /app-like prefixes (e.g. /appendix)', () => {
    // Bare-prefix regression guard — `/appendix` should NOT be treated as
    // an `/app/*` route. Same rule as `isActive` in sidebar-routes.ts.
    expect(buildTrail('/appendix')).toEqual([]);
    expect(buildTrail('/application')).toEqual([]);
  });

  it('strips query strings and hash fragments before matching', () => {
    // `usePathname()` already strips these but the builder must not
    // depend on the caller for that. Belt and braces.
    const a = buildTrail('/app/employees?foo=bar');
    expect(a[a.length - 1]!.label).toBe('Employees');
    const b = buildTrail('/app/pay-codes#top');
    expect(b[b.length - 1]!.label).toBe('Pay codes');
  });

  it('handles deep nested routes by deriving labels for unmapped segments', () => {
    const trail = buildTrail('/app/employees/new-hire-batch');
    expect(trail).toEqual([
      { label: 'Home', href: '/app', isCurrent: false },
      {
        label: 'Employees',
        href: '/app/employees',
        isCurrent: false,
      },
      { label: 'New hire batch', href: null, isCurrent: true },
    ]);
  });
});
