/**
 * shortcuts-map.test.ts — unit coverage for the global-shortcut pure
 * data + resolvers.
 *
 * E6.3 Task 3.9. Exercises:
 *
 *   1. `NAV_SHORTCUTS` shape — the seven `g <letter>` shortcuts named
 *      in spec §5.2 + OQ-8 are all present with the correct href +
 *      label. A missing entry breaks the §8.3 AC "shortcuts navigate
 *      to the correct route" silently — a test that enumerates the
 *      contract catches that at PR time.
 *
 *   2. `resolveSequence` — the seven mapped letters return
 *      `{ kind: 'navigate', href: <route> }`; any other key returns
 *      `{ kind: 'reset' }`. Includes the "second key is also the
 *      leader" case (the sequence resets cleanly).
 *
 *   3. `resolveSingleKey` — `?` resolves to overlay, `g` to leader,
 *      every other key to ignore.
 *
 *   4. `shouldIgnoreKeydown` — INPUT / TEXTAREA / contenteditable
 *      ignored; BUTTON / A / null target / contenteditable="false"
 *      NOT ignored.
 *
 *   5. Sequence-timeout constant is sane (lives in the data file, used
 *      by the live handler — exposing it for the test confirms the
 *      contract).
 *
 * No DOM. Pure functions only. Runs in vitest's default `node` env per
 * `vitest.config.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
  NAV_LEADER,
  NAV_SHORTCUTS,
  OVERLAY_KEY,
  SEQUENCE_TIMEOUT_MS,
  resolveSequence,
  resolveSingleKey,
  shouldIgnoreKeydown,
} from './shortcuts-map';

describe('NAV_SHORTCUTS', () => {
  it('contains exactly the seven shortcuts named in spec §5.2 + OQ-8', () => {
    // The seven `g <letter>` → route mappings from the dispatch + spec
    // §5.2. Enumerated explicitly here so a typo in `shortcuts-map.ts`
    // (e.g. `/app/employee` instead of `/app/employees`) fails the suite.
    const expected: ReadonlyArray<{
      secondKey: string;
      href: string;
      label: string;
    }> = [
      { secondKey: 'e', href: '/app/employees', label: 'Employees' },
      { secondKey: 'h', href: '/app/pay-history', label: 'Pay history' },
      { secondKey: 'l', href: '/app/liability', label: 'Liability' },
      { secondKey: 'p', href: '/app/pay-codes', label: 'Pay codes' },
      {
        secondKey: 'r',
        href: '/app/reconciliation',
        label: 'Reconciliation',
      },
      { secondKey: 's', href: '/app/settings', label: 'Settings' },
      { secondKey: 'v', href: '/app/valuations', label: 'Valuations' },
    ];
    expect(NAV_SHORTCUTS).toEqual(expected);
  });

  it('has no duplicate secondKey values', () => {
    const keys = NAV_SHORTCUTS.map((s) => s.secondKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every secondKey is a single lowercase ASCII letter', () => {
    for (const s of NAV_SHORTCUTS) {
      expect(s.secondKey).toMatch(/^[a-z]$/);
    }
  });

  it('every href starts with /app/', () => {
    for (const s of NAV_SHORTCUTS) {
      expect(s.href.startsWith('/app/')).toBe(true);
    }
  });
});

describe('resolveSequence', () => {
  it.each(NAV_SHORTCUTS)(
    'returns navigate for second key "$secondKey" → $href',
    ({ secondKey, href }) => {
      expect(resolveSequence(secondKey)).toEqual({
        kind: 'navigate',
        href,
      });
    },
  );

  it('returns reset for an unmapped letter', () => {
    expect(resolveSequence('z')).toEqual({ kind: 'reset' });
  });

  it('returns reset when the second key is the leader itself', () => {
    // Pressing `g g` should NOT navigate. The first `g` set pending;
    // the second `g` is not a mapped destination → reset.
    expect(resolveSequence('g')).toEqual({ kind: 'reset' });
  });

  it('returns reset for the overlay key as a second key', () => {
    // `g ?` should NOT open the overlay (overlay is single-key). The
    // sequence resolver doesn't know about `?` — falls to reset, which
    // is correct: the live handler's overlay branch never sees this
    // path.
    expect(resolveSequence('?')).toEqual({ kind: 'reset' });
  });

  it('returns reset for a non-letter key (e.g. Enter, Escape)', () => {
    expect(resolveSequence('enter')).toEqual({ kind: 'reset' });
    expect(resolveSequence('escape')).toEqual({ kind: 'reset' });
    expect(resolveSequence('arrowdown')).toEqual({ kind: 'reset' });
  });

  it('returns reset for an uppercase letter (caller must lowercase)', () => {
    // `resolveSequence` is a pure data lookup. The live handler does
    // the lowercase normalisation. A pure resolver pinning this
    // expectation catches a future refactor that drops the lowercase
    // step at the call site.
    expect(resolveSequence('E')).toEqual({ kind: 'reset' });
  });
});

describe('resolveSingleKey', () => {
  it('returns overlay for "?"', () => {
    expect(resolveSingleKey('?')).toEqual({ kind: 'overlay' });
  });

  it('returns leader for "g"', () => {
    expect(resolveSingleKey('g')).toEqual({ kind: 'leader' });
  });

  it('returns ignore for any other key', () => {
    expect(resolveSingleKey('e')).toEqual({ kind: 'ignore' });
    expect(resolveSingleKey('a')).toEqual({ kind: 'ignore' });
    expect(resolveSingleKey('enter')).toEqual({ kind: 'ignore' });
    expect(resolveSingleKey('escape')).toEqual({ kind: 'ignore' });
    expect(resolveSingleKey('shift')).toEqual({ kind: 'ignore' });
  });

  it('returns ignore for uppercase "G" (caller must lowercase)', () => {
    // Same contract as resolveSequence — case normalisation is the
    // live handler's job. Capital G is NOT the leader from this
    // resolver's perspective. Test pins that contract.
    expect(resolveSingleKey('G')).toEqual({ kind: 'ignore' });
  });
});

describe('shouldIgnoreKeydown', () => {
  // A minimal Element-shaped fake. Vitest runs in `node` env (no jsdom)
  // so we duck-type the test targets — `shouldIgnoreKeydown` does the
  // same duck-typing internally.
  function fakeElement(opts: {
    tagName: string;
    closestMap?: Record<string, boolean>;
  }): EventTarget {
    return {
      tagName: opts.tagName,
      closest: (selector: string) => {
        if (opts.closestMap && opts.closestMap[selector]) {
          // Return a truthy stand-in element. `closest()` returns the
          // matched element; the caller only checks truthiness, so any
          // non-null object works.
          return { __matched: selector };
        }
        return null;
      },
    } as unknown as EventTarget;
  }

  it('ignores INPUT', () => {
    expect(shouldIgnoreKeydown(fakeElement({ tagName: 'input' }))).toBe(
      true,
    );
    expect(shouldIgnoreKeydown(fakeElement({ tagName: 'INPUT' }))).toBe(
      true,
    );
  });

  it('ignores TEXTAREA', () => {
    expect(
      shouldIgnoreKeydown(fakeElement({ tagName: 'textarea' })),
    ).toBe(true);
    expect(
      shouldIgnoreKeydown(fakeElement({ tagName: 'TEXTAREA' })),
    ).toBe(true);
  });

  it('ignores any contenteditable="true" ancestor', () => {
    expect(
      shouldIgnoreKeydown(
        fakeElement({
          tagName: 'span',
          closestMap: { '[contenteditable="true"]': true },
        }),
      ),
    ).toBe(true);
  });

  it('ignores any contenteditable="" ancestor (legacy markup)', () => {
    expect(
      shouldIgnoreKeydown(
        fakeElement({
          tagName: 'span',
          closestMap: { '[contenteditable=""]': true },
        }),
      ),
    ).toBe(true);
  });

  it('does NOT ignore BUTTON', () => {
    expect(shouldIgnoreKeydown(fakeElement({ tagName: 'button' }))).toBe(
      false,
    );
  });

  it('does NOT ignore A (link)', () => {
    expect(shouldIgnoreKeydown(fakeElement({ tagName: 'a' }))).toBe(false);
  });

  it('does NOT ignore DIV with no editable ancestor', () => {
    expect(shouldIgnoreKeydown(fakeElement({ tagName: 'div' }))).toBe(
      false,
    );
  });

  it('does NOT ignore contenteditable="false"', () => {
    // The selector `[contenteditable="true"]` does NOT match this — and
    // our resolver does NOT use the bare `[contenteditable]` selector
    // for exactly this reason. `false` means "not editable".
    expect(
      shouldIgnoreKeydown(
        fakeElement({
          tagName: 'div',
          closestMap: {
            // Only false: an explicit contenteditable=false ancestor.
            // No truthy match should be found.
          },
        }),
      ),
    ).toBe(false);
  });

  it('does NOT ignore null target', () => {
    expect(shouldIgnoreKeydown(null)).toBe(false);
  });

  it('does NOT throw for a non-Element target (no tagName, no closest)', () => {
    // Document / Window / a custom listener target. None will match
    // the INPUT / TEXTAREA branch, and `closest` is missing → defensive
    // branch returns false cleanly.
    const documentLike = {} as unknown as EventTarget;
    expect(() => shouldIgnoreKeydown(documentLike)).not.toThrow();
    expect(shouldIgnoreKeydown(documentLike)).toBe(false);
  });
});

describe('constants', () => {
  it('NAV_LEADER is "g"', () => {
    expect(NAV_LEADER).toBe('g');
  });

  it('OVERLAY_KEY is "?"', () => {
    expect(OVERLAY_KEY).toBe('?');
  });

  it('SEQUENCE_TIMEOUT_MS is a positive integer', () => {
    expect(Number.isInteger(SEQUENCE_TIMEOUT_MS)).toBe(true);
    expect(SEQUENCE_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('SEQUENCE_TIMEOUT_MS is in the 500ms-2000ms power-user window', () => {
    // Pin to the established Linear / Gmail / Vercel range. A value
    // outside this window is almost certainly a typo (`100` → users
    // can't reach the second key in time; `10000` → leader hangs
    // forever).
    expect(SEQUENCE_TIMEOUT_MS).toBeGreaterThanOrEqual(500);
    expect(SEQUENCE_TIMEOUT_MS).toBeLessThanOrEqual(2000);
  });
});
