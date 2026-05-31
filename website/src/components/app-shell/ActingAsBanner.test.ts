/**
 * ActingAsBanner.test.ts — source-level + structural tests for the
 * "Acting as: <client>" banner.
 *
 * E6.3 Task 3.4. Vitest runs `environment: 'node'` (see `vitest.config.ts`)
 * with no JSDOM — so the React tree cannot be rendered here. Coverage is
 * structural: we grep the source for the load-bearing visibility rule
 * (`isActingNonHome === true`), the WCAG-AA-compliant colour pairing, the
 * R-5 sticky-positioning requirement, and the fall-back-to-ID safety net.
 *
 * Matches the established pattern in `TenantSwitcher.test.ts` and
 * `sidebar-routes.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bannerSrc = readFileSync(
  resolve(__dirname, 'ActingAsBanner.tsx'),
  'utf-8',
);

describe('ActingAsBanner — visibility rule', () => {
  it('renders null when isActingNonHome is false', () => {
    // Spec §5.2: banner is visible WHENEVER `activeTenantId !== homeTenantId`.
    // On home org the banner MUST be invisible — a noisy permanent banner
    // on every home-org page would hurt the daily-driver UX.
    expect(bannerSrc).toMatch(/if\s*\(\s*!isActingNonHome\s*\)\s*\{\s*return\s+null/);
  });

  it('reads isActingNonHome from useTenantContext on the live export', () => {
    // The derived `isActingNonHome` is the spec-mandated comparator
    // (`activeTenantId !== homeTenantId && activeTenantId !== ''`). Reading
    // the derived field from context — not re-deriving in the banner —
    // keeps the comparator in one place (the provider).
    expect(bannerSrc).toContain('useTenantContext');
    expect(bannerSrc).toMatch(/isActingNonHome,\s*activeTenantId\s*\}\s*=\s*useTenantContext/);
  });
});

describe('ActingAsBanner — WCAG 2.2 AA contrast', () => {
  it('uses bg-brand-gold as the background (spec §8.3 AC bullet 5)', () => {
    expect(bannerSrc).toContain('bg-brand-gold');
  });

  it('uses text-brand-charcoal for AA-compliant body-text contrast', () => {
    // Measured 5.65:1 against bg-brand-gold (#d9a428 vs #333232) — passes
    // WCAG 2.2 AA for normal body text (4.5:1 threshold). The naive
    // navy/gold pairing only achieves 2.80:1 and fails.
    expect(bannerSrc).toContain('text-brand-charcoal');
  });

  it('documents the contrast measurement in the file header', () => {
    // Greppable phrase pins the audit so a future contributor who flips
    // the text colour back to navy gets a clear breadcrumb to the
    // calculation that ruled it out.
    expect(bannerSrc).toContain('5.65:1');
    expect(bannerSrc).toContain('WCAG 2.2 AA');
  });
});

describe('ActingAsBanner — R-5 always-visible positioning', () => {
  it('renders the banner as a sticky strip below the TopNav', () => {
    // R-5: every action surface in /app/* must show the active tenant.
    // `sticky top-14` (TopNav is `h-14`) keeps the banner anchored to the
    // bottom of the TopNav across scroll.
    expect(bannerSrc).toContain('sticky top-14');
  });

  it('spans full width and uses a single-line layout', () => {
    expect(bannerSrc).toContain('w-full');
    // Single-line is enforced by `truncate` on the label span.
    expect(bannerSrc).toMatch(/truncate/);
  });

  it('sits below TopNav z-index but above page content', () => {
    // TopNav is `z-30`, Radix portals are `z-50`. Banner at `z-20` keeps
    // dropdowns / menus rendering above the strip without occluding it
    // from page content.
    expect(bannerSrc).toContain('z-20');
  });
});

describe('ActingAsBanner — fall-back-to-ID safety net', () => {
  it('falls back to activeTenantId when activeTenantName is empty', () => {
    // R-5: the indicator MUST identify the tenant. An empty name (e.g. a
    // data race where the cookie arrived but the memberships query
    // didn\'t) must NOT render an empty "Acting as:" label.
    expect(bannerSrc).toContain('activeTenantName.trim() || activeTenantId');
  });
});

describe('ActingAsBanner — accessibility surface', () => {
  it('marks the strip as a polite live region for screen readers', () => {
    // Announce on appearance (tenant switch). `polite` (not `alert`)
    // because the banner is informational, not an error.
    expect(bannerSrc).toMatch(/role="status"/);
    expect(bannerSrc).toMatch(/aria-live="polite"/);
  });

  it('marks the lucide icon as decorative', () => {
    // The AlertTriangle is purely visual; the text carries the meaning.
    expect(bannerSrc).toMatch(/<AlertTriangle[\s\S]*?aria-hidden="true"/);
  });
});

describe('ActingAsBanner — Presentation / live split', () => {
  it('exports both a live and a presentational variant', () => {
    expect(bannerSrc).toContain('export function ActingAsBannerPresentation');
    expect(bannerSrc).toContain('export function ActingAsBanner(');
  });

  it('marks the file as a Client Component (uses useTenantContext)', () => {
    expect(bannerSrc).toMatch(/^'use client'/m);
  });
});
