/**
 * shortcuts-map.ts — pure data + sequence resolver for global `/app/*`
 * keyboard shortcuts.
 *
 * E6.3 Task 3.9 (spec §5.2 + §8.3, OQ-8). Split off from
 * `keyboard-shortcuts.tsx` so the shortcut list, the sequence resolver,
 * and the focus-target ignore rule can be unit-tested in vitest's `node`
 * env (see `website/vitest.config.ts`) without a browser shim.
 *
 * Mirrors the established Phase 3a split convention:
 *   - `sidebar-routes.ts` (data) + `Sidebar.tsx` (visuals).
 *   - `breadcrumbs-routes.ts` (data) + `Breadcrumbs.tsx` (visuals).
 *
 * No JSX, no React imports, no DOM. Safe to import anywhere — server,
 * client, tests, future server actions.
 *
 * # Sequence shape (the load-bearing contract)
 *
 * Every navigation shortcut is a TWO-KEY SEQUENCE. The user presses the
 * leader key (`g`), then within the sequence timeout window the secondary
 * key (`e`, `v`, `p`, `h`, `l`, `r`, `s`) routes to the destination. This
 * matches the Linear / Vercel / Gmail "g + letter" convention referenced
 * in spec §4 ("Stripe / Linear / Notion … keyboard-first feel") and the
 * §5.2 MUST clause naming `g e` + `g v`.
 *
 * The `?` overlay is a SINGLE-KEY shortcut. It is its own resolver branch
 * (see `resolveSingleKey`) — not a leader. Pressing `?` after a pending
 * `g` does NOT open the overlay (the sequence resets on a non-letter
 * second key — see `resolveSequence` below).
 *
 * # Why two resolvers, not one polymorphic resolver
 *
 * The sequence and single-key cases want different state semantics:
 *
 *   - Sequence: stateful. Press `g` → pending. Press `e` within window →
 *     navigate + clear. Press anything else → clear without navigating.
 *   - Single-key: stateless. Press `?` → open overlay. Whether or not a
 *     leader is pending is irrelevant.
 *
 * Two resolvers mirror that — each tests cleanly and the live handler
 * (`keyboard-shortcuts.tsx`) composes them.
 *
 * # Why the route map duplicates `sidebar-routes.ts`
 *
 * Could re-derive from `SIDEBAR_ENTRIES`. Chose NOT to:
 *
 *   1. **Independent contracts.** The sidebar can hide an entry via
 *      env-flag gating (`isVisible()` per spec §5.2). The shortcut is
 *      always-on per OQ-8 — operator-locked. If shortcuts mirrored
 *      sidebar visibility, an off-by-default flag would silently break
 *      a documented power-user keystroke. Worse: turning the flag on at
 *      Vercel would silently activate a shortcut without a code change.
 *
 *   2. **Different key contract.** Shortcuts use single letters; the
 *      sidebar entries don't carry that data. Tagging single letters
 *      onto `SidebarEntry` would conflate two contracts.
 *
 *   3. **Test independence.** The shortcut test suite verifies the
 *      seven `g <letter>` mappings exhaustively. Aliasing through
 *      `SIDEBAR_ENTRIES` would couple the shortcut test to the sidebar
 *      entry order — a refactoring footgun.
 *
 * Adding a new shortcut is a one-line addition to `NAV_SHORTCUTS`. The
 * test suite will catch a missing letter or a typo'd href.
 */

/**
 * The leader key for navigation sequences. `g` per spec §5.2 + OQ-8 +
 * established `gmail` / `linear` convention. Lowercase — the live
 * handler normalises `key` to lowercase before resolving (so `G` and
 * `g` both work; Shift+G doesn't navigate but doesn't break either).
 */
export const NAV_LEADER = 'g' as const;

/**
 * Sequence timeout in milliseconds. The dispatch suggests ~1 second.
 * Long enough for a slow typist to land the second key; short enough
 * that a long pause won't navigate when the user has already moved on.
 *
 * Linear uses ~1000 ms. Gmail uses ~1500 ms. We pick the lower end —
 * a stale pending key that fires unexpectedly is worse than a slow
 * typist having to press `g` again.
 */
export const SEQUENCE_TIMEOUT_MS = 1000;

/**
 * The single-key shortcut for opening the shortcuts overlay. `?` per
 * spec §5.2 + §8.3 + the GitHub / Linear / Vercel / Notion convention.
 *
 * NOTE: `?` is Shift+`/` on most keyboards. The browser reports `key`
 * as `'?'` directly (not `'/'`) when Shift is held. The live handler
 * matches on `event.key === '?'`. No special-casing needed.
 */
export const OVERLAY_KEY = '?' as const;

/**
 * One navigation shortcut. `secondKey` is the letter pressed after the
 * leader; `href` is the destination; `label` is what renders in the
 * overlay row (sentence case per spec §5.1 brand voice).
 */
export interface NavShortcut {
  readonly secondKey: string;
  readonly href: string;
  readonly label: string;
}

/**
 * The navigation shortcut table. Order is the display order in the
 * overlay — alphabetical by `secondKey` so users can scan to the letter
 * they want fast. Mirrors the OQ-8 resolution in spec §5.2:
 *
 *   `g e` → Employees, `g h` → Pay history, `g l` → Liability,
 *   `g p` → Pay codes, `g r` → Reconciliation, `g s` → Settings,
 *   `g v` → Valuations.
 *
 * Labels match `BREADCRUMB_LABELS` in `components/app-shell/breadcrumbs-routes.ts`
 * — same sentence-case product chrome convention.
 */
export const NAV_SHORTCUTS: readonly NavShortcut[] = [
  { secondKey: 'e', href: '/app/employees', label: 'Employees' },
  { secondKey: 'h', href: '/app/pay-history', label: 'Pay history' },
  { secondKey: 'l', href: '/app/liability', label: 'Liability' },
  { secondKey: 'p', href: '/app/pay-codes', label: 'Pay codes' },
  { secondKey: 'r', href: '/app/reconciliation', label: 'Reconciliation' },
  { secondKey: 's', href: '/app/settings', label: 'Settings' },
  { secondKey: 'v', href: '/app/valuations', label: 'Valuations' },
];

/**
 * The resolved action returned by `resolveSequence` after the second
 * key arrives:
 *
 *   - `{ kind: 'navigate', href }` — the live handler should
 *     `router.push(href)` and clear the pending leader.
 *   - `{ kind: 'reset' }` — the second key didn't match. Clear the
 *     pending leader. DON'T navigate.
 *
 * The discriminated union keeps the test suite exhaustive — TypeScript
 * flags an un-handled branch at the call site.
 */
export type SequenceResult =
  | { readonly kind: 'navigate'; readonly href: string }
  | { readonly kind: 'reset' };

/**
 * Resolve the second key of a pending sequence.
 *
 * Contract:
 *   - The caller has already observed a leader key (`g`) and stored
 *     `'g'` in its pending ref. This function ONLY handles the
 *     second-key step — testing the pending ref is the caller's job.
 *   - `secondKey` is the raw `event.key` (already lowercased by the
 *     caller). Case-sensitivity is the caller's responsibility so this
 *     resolver stays a pure data lookup.
 *
 * Returns:
 *   - `{ kind: 'navigate', href }` when `secondKey` matches one of
 *     `NAV_SHORTCUTS[].secondKey`.
 *   - `{ kind: 'reset' }` otherwise (including when `secondKey` is the
 *     leader itself, the overlay key, a modifier name, or unmapped).
 *
 * The reset branch is critical for the §8.3 AC: a stale pending leader
 * should not silently absorb the next keystroke. Reset = clean slate.
 */
export function resolveSequence(secondKey: string): SequenceResult {
  const match = NAV_SHORTCUTS.find((s) => s.secondKey === secondKey);
  if (match) {
    return { kind: 'navigate', href: match.href };
  }
  return { kind: 'reset' };
}

/**
 * The resolved action returned by `resolveSingleKey` for non-sequence
 * keystrokes (i.e. before any leader has been pressed, OR for the
 * `?` overlay which never participates in a sequence):
 *
 *   - `{ kind: 'leader' }` — the key is the leader. The caller stores
 *     it as the pending sequence head.
 *   - `{ kind: 'overlay' }` — the key is `?`. The caller opens the
 *     overlay.
 *   - `{ kind: 'ignore' }` — the key is something else. The caller
 *     does nothing.
 *
 * Note: `?` never opens the overlay mid-sequence. Spec §5.2 + OQ-8
 * names `?` as an overlay-opening single-key shortcut, AND names `g <x>`
 * as navigation sequences. The live handler implements that by:
 *   - If `pending === 'g'`, call `resolveSequence(key)`.
 *   - Else call `resolveSingleKey(key)`.
 * Composition keeps each resolver pure + exhaustively testable.
 */
export type SingleKeyResult =
  | { readonly kind: 'leader' }
  | { readonly kind: 'overlay' }
  | { readonly kind: 'ignore' };

/**
 * Resolve a single keystroke (no pending leader). `key` is `event.key`
 * already lowercased EXCEPT for `?` which is reported by the browser
 * as `'?'` directly — the caller should pass it through verbatim.
 *
 * The live handler's logic:
 *
 *   ```
 *   const key = event.key === '?' ? '?' : event.key.toLowerCase();
 *   const result = pending === 'g'
 *     ? resolveSequence(key)
 *     : resolveSingleKey(key);
 *   ```
 *
 * That keeps the case-normalisation in the live layer, and both
 * resolvers as pure data lookups.
 */
export function resolveSingleKey(key: string): SingleKeyResult {
  if (key === OVERLAY_KEY) return { kind: 'overlay' };
  if (key === NAV_LEADER) return { kind: 'leader' };
  return { kind: 'ignore' };
}

/**
 * Returns `true` if a keydown event originating from this target should
 * be IGNORED by the global shortcut handler.
 *
 * The contract per spec §5.2 + §8.3 + dispatch:
 *
 *   "Shortcut handler IGNORES keystrokes when focus is in `input`,
 *    `textarea`, or any element with `contenteditable='true'`. The
 *    user is typing — don't hijack."
 *
 * Implementation notes:
 *
 *   - `target` is typed loosely (`EventTarget | null`) because vanilla
 *     `KeyboardEvent.target` is `EventTarget`. We narrow defensively to
 *     `Element` via duck-typing (`tagName` + `closest`) so the function
 *     stays unit-testable in vitest's `node` env without a jsdom shim.
 *
 *   - `<select>` is NOT in the ignore list. A `<select>` element's
 *     internal type-ahead-search uses letter keys WITHOUT consuming a
 *     leader prefix — `g` on a `<select>` jumps to the first option
 *     starting with "g", not the shortcut leader. But: if the user
 *     then presses `e` outside the option list, that's mainline
 *     keyboard. The friction of `<select>` collision is rare enough
 *     that we treat it as a v1 follow-up rather than expand the
 *     ignore-set. (Spec §5.2 doesn't name `<select>`; we honour the
 *     spec.)
 *
 *   - `<button>` and `<a>` are NOT in the ignore list. Pressing letter
 *     keys on a button doesn't do anything by default — the leader
 *     should fire as expected. The ignore list is specifically about
 *     text-entry surfaces where the user has typing intent.
 *
 *   - `contenteditable` matching uses `closest('[contenteditable]')`
 *     so a nested span inside an editable region still gets ignored.
 *     `closest()` walks up the ancestor chain — covers
 *     `<div contenteditable><span>cursor here</span></div>`.
 */
export function shouldIgnoreKeydown(target: EventTarget | null): boolean {
  if (target === null) return false;

  // Duck-type to `Element`. `tagName` is the cheap, universally-present
  // identity check. `closest` is the standard tree-walking helper that
  // every `Element` in every browser since 2017 supports.
  //
  // `unknown` cast avoids forcing the consumer to import `Element` from
  // a DOM-typed global — keeps `shortcuts-map.ts` importable from any
  // surface. The narrowing is local + bounded.
  const element = target as unknown as {
    tagName?: unknown;
    closest?: (selector: string) => unknown;
  };

  // `tagName` shape check. A non-Element target (e.g. `Document`,
  // `Window`) won't have a tagName string — bail out of the form-field
  // ignore branch but keep going for the contenteditable check (which
  // also won't match — so we return `false` cleanly).
  const tag =
    typeof element.tagName === 'string' ? element.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    return true;
  }

  // `closest('[contenteditable="true"]')` matches both the target
  // itself and any ancestor. Covers the nested-cursor case.
  //
  // The HTML spec accepts `contenteditable`, `contenteditable=""`, and
  // `contenteditable="true"` as truthy values; selectors with attr
  // matching `[contenteditable="true"]` ONLY match the explicit
  // `"true"` form. We expand to a two-step selector for robustness —
  // first the canonical truthy form, then the bare attribute as a
  // belt-and-braces fall-back (covers `<div contenteditable>` which
  // older Stack Overflow examples show).
  if (typeof element.closest === 'function') {
    if (element.closest('[contenteditable="true"]')) return true;
    if (element.closest('[contenteditable=""]')) return true;
    // Some legacy markup uses bare `contenteditable` (no value). The
    // browser normalises that to `contenteditable=""`, but defensive
    // browsers + older fixtures may not. `[contenteditable]` matches
    // any element WITH the attribute regardless of value — including
    // `contenteditable="false"`, which we DON'T want to ignore. So we
    // do NOT use the bare-attribute selector. The two cases above
    // cover the truthy contract.
  }

  return false;
}
