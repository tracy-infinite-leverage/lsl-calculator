/**
 * empty-state-surfaces.test.ts — unit coverage for the empty-state data.
 *
 * E6.3 Task 3.7. Exercises:
 *
 *   1. `EMPTY_STATE_SURFACES` shape — exactly six surfaces in spec order,
 *      each carrying every required field.
 *
 *   2. Copy shape — headlines have no terminal period, CTAs are
 *      imperative verb-first, subtext ends with a period. These are the
 *      brand-voice contracts from the module's copy guidelines.
 *
 *   3. CTA contract — each surface has exactly one CTA; CTA href starts
 *      with `/app/` so the navigation envelope stays inside the
 *      authenticated workspace.
 *
 *   4. Sidebar alignment — every slug in this module matches a slug in
 *      `SIDEBAR_ENTRIES` (minus the Settings anchor). This is the load-
 *      bearing cross-reference: an out-of-sync slug means a sidebar
 *      entry routes to a `/app/<slug>/` page that doesn't exist.
 *
 *   5. `getEmptyStateSurface` lookup — returns the matching surface for
 *      every known slug.
 *
 * No DOM, no JSX, no React — pure data + pure functions. Runs in
 * vitest's default `node` env per `vitest.config.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_STATE_SURFACES,
  getEmptyStateSurface,
  type EmptyStateSlug,
} from './empty-state-surfaces';
import { SIDEBAR_ENTRIES } from '@/components/app-shell/sidebar-routes';

/**
 * Imperative verb prefixes accepted by the CTA contract. Sentence-case
 * verb-first. Adding a new accepted verb requires deliberate intent —
 * keep the surface narrow so brand voice stays consistent.
 */
const IMPERATIVE_VERBS = ['Add', 'Create', 'Import', 'Run', 'Open', 'Set up'];

// ---------------------------------------------------------------------------
// EMPTY_STATE_SURFACES — shape contract
// ---------------------------------------------------------------------------

describe('EMPTY_STATE_SURFACES', () => {
  it('contains exactly six surfaces in spec order', () => {
    expect(EMPTY_STATE_SURFACES.map((s) => s.slug)).toEqual([
      'employees',
      'pay-codes',
      'pay-history',
      'valuations',
      'liability',
      'reconciliation',
    ] satisfies EmptyStateSlug[]);
  });

  it('every surface carries a non-empty headline, subtext, ctaLabel, and ctaHref', () => {
    for (const surface of EMPTY_STATE_SURFACES) {
      expect(surface.headline.length).toBeGreaterThan(0);
      expect(surface.subtext.length).toBeGreaterThan(0);
      expect(surface.ctaLabel.length).toBeGreaterThan(0);
      expect(surface.ctaHref.startsWith('/app/')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Copy shape — brand-voice contract
// ---------------------------------------------------------------------------

describe('empty-state copy', () => {
  it('headlines do not end with a period', () => {
    // Spec brand voice: headlines are scannable; trailing periods read as
    // declarative and slow the scan. Subtext is where full sentences live.
    for (const surface of EMPTY_STATE_SURFACES) {
      expect(surface.headline.endsWith('.')).toBe(false);
    }
  });

  it('subtext ends with a period', () => {
    // Subtext is one or two full sentences. Skip the trailing period and
    // it reads truncated. Catch a regression early.
    for (const surface of EMPTY_STATE_SURFACES) {
      expect(surface.subtext.endsWith('.')).toBe(true);
    }
  });

  it('CTA labels do not end with terminal punctuation', () => {
    // Button labels are call-to-action verbs; periods + exclamation
    // marks would read as exhortations not affordances.
    for (const surface of EMPTY_STATE_SURFACES) {
      const last = surface.ctaLabel.slice(-1);
      expect(['.', '!', '?']).not.toContain(last);
    }
  });

  it('CTA labels begin with an imperative verb', () => {
    // Imperative verb-first labels mirror the platform conventions doc
    // (and how operator describes the workflows in interviews).
    for (const surface of EMPTY_STATE_SURFACES) {
      const startsWithImperative = IMPERATIVE_VERBS.some((v) =>
        surface.ctaLabel.startsWith(v + ' '),
      );
      expect(
        startsWithImperative,
        `CTA "${surface.ctaLabel}" should start with one of: ${IMPERATIVE_VERBS.join(', ')}`,
      ).toBe(true);
    }
  });

  it('each surface has exactly one CTA field set', () => {
    // The empty-state spec mandates a SINGLE primary CTA per surface
    // (AC bullet 3). A future "and secondary CTA" addition must be a
    // deliberate spec amendment, not a copy edit. We assert the shape
    // here so a stray extra property doesn't sneak in.
    for (const surface of EMPTY_STATE_SURFACES) {
      const ctaFields = Object.keys(surface).filter((k) =>
        k.toLowerCase().startsWith('cta'),
      );
      // Exactly two: `ctaLabel` + `ctaHref`. Add a `ctaSecondaryLabel` and
      // the count jumps to three — failing this test forces a code review.
      expect(ctaFields.sort()).toEqual(['ctaHref', 'ctaLabel']);
    }
  });
});

// ---------------------------------------------------------------------------
// Sidebar slug alignment — cross-module contract
// ---------------------------------------------------------------------------

describe('sidebar alignment', () => {
  it('every empty-state slug matches a sidebar entry slug', () => {
    const sidebarSlugs = new Set(SIDEBAR_ENTRIES.map((e) => e.slug));
    for (const surface of EMPTY_STATE_SURFACES) {
      expect(
        sidebarSlugs.has(surface.slug),
        `empty-state slug "${surface.slug}" must match a SIDEBAR_ENTRIES.slug — otherwise the sidebar links to a route with no empty state`,
      ).toBe(true);
    }
  });

  it('covers every sidebar entry except Settings', () => {
    // The reverse direction: every sidebar entry except the Settings
    // navigation anchor should have a matching empty state. Settings is
    // a config surface, not a data surface — no empty state by design.
    const sidebarDataSlugs = SIDEBAR_ENTRIES.map((e) => e.slug).filter(
      (s) => s !== 'settings',
    );
    const emptyStateSlugs = EMPTY_STATE_SURFACES.map((s) => s.slug);
    expect(emptyStateSlugs).toEqual(sidebarDataSlugs);
  });
});

// ---------------------------------------------------------------------------
// getEmptyStateSurface — lookup
// ---------------------------------------------------------------------------

describe('getEmptyStateSurface', () => {
  it('returns the matching surface for every known slug', () => {
    for (const surface of EMPTY_STATE_SURFACES) {
      expect(getEmptyStateSurface(surface.slug)).toBe(surface);
    }
  });
});
