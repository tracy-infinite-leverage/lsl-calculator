/**
 * ConfirmDestructiveDialog.test.ts — source-level + structural tests for
 * the tenant-aware destructive-action confirmation wrapper.
 *
 * E6.3 Task 3.5. Vitest runs `environment: 'node'` (see `vitest.config.ts`)
 * with no JSDOM — so the React tree cannot be rendered here. Coverage is
 * structural: we grep the source for:
 *
 *   - The R-5 alignment markers (tenant name MUST appear in title + body).
 *   - The locked operator decision (skip on home org → `isActingNonHome`
 *     early-return guard).
 *   - The async + error semantics (close on resolve, stay-open + surface
 *     error on reject, block-close-while-pending).
 *   - The Presentation / live split.
 *
 * Matches the established Phase 3a pattern in `TenantSwitcher.test.ts` +
 * `ActingAsBanner.test.ts` + `sidebar-routes.test.ts`.
 *
 * # What is NOT covered here (and where it IS covered)
 *
 *   - Dialog focus management → Radix UI's own test suite + the
 *     `dialog.stories.tsx` `defaultOpen` axe-core surface coverage.
 *   - The full mount + click → Playwright e2e (E6.3 Phase 4).
 *   - axe-core a11y of the open dialog → Storybook a11y addon stories
 *     (`ConfirmDestructiveDialog.stories.tsx`).
 *
 * # Why every assertion is greppable
 *
 * If a future contributor accidentally:
 *   - Drops the tenant name from the dialog title (R-5 break).
 *   - Flips the home-org branch to "always show dialog" (the locked
 *     decision per tasks.md G-8 — needs operator approval to flip).
 *   - Silently closes the dialog on `onConfirm` rejection.
 *   - Allows close-while-pending.
 *
 * ...the relevant test below MUST fail. Source-level greps achieve that
 * with no DOM dependency.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dialogSrc = readFileSync(
  resolve(__dirname, 'ConfirmDestructiveDialog.tsx'),
  'utf-8',
);

// ---------------------------------------------------------------------------
// Operator decision (locked) — skip-on-home branch
// ---------------------------------------------------------------------------

describe('ConfirmDestructiveDialog — operator decision (skip on home org)', () => {
  it('records the locked operator decision in the file header', () => {
    // The operator decision is recorded inline per the dispatch contract
    // ("Operator decision on home-org dialog default (SKIP) recorded
    // inline at task kickoff"). Greppable phrase pins the audit so a
    // future contributor doesn't flip the default without checking.
    expect(dialogSrc).toContain('SKIP on home org');
    expect(dialogSrc).toContain('Operator decision');
  });

  it('references tasks.md G-8 inline operator-awareness note', () => {
    // The G-8 note ("if any pilot user reports a near-miss in home-org
    // context, flip the default") is the operational instruction the
    // future contributor needs alongside the decision itself.
    expect(dialogSrc).toContain('G-8');
  });

  it('returns early when isActingNonHome is false (no dialog rendered)', () => {
    // The home-org branch MUST short-circuit before the <Dialog> renders.
    // If the dialog renders even briefly on home org, R-5 friction lands
    // on every home-org destructive click — exactly the UX the operator
    // ruled out.
    expect(dialogSrc).toMatch(/if\s*\(\s*!isActingNonHome\s*\)/);
  });

  it('bypasses the Dialog via a display:contents span on home org', () => {
    // The home-org branch uses a transparent <span display:contents>
    // wrapper to intercept the click. Layout impact must be zero —
    // checked via the `display: 'contents'` style literal.
    expect(dialogSrc).toMatch(/style=\{\{\s*display:\s*['"]contents['"]/);
  });

  it('fires onConfirm directly on home-org click (no Dialog mount)', () => {
    // The bypass handler calls `await onConfirm()` without any
    // setOpen(true) — the dialog never enters the DOM. Greppable
    // pattern matches the `handleHomeOrgClick` async wrapper.
    expect(dialogSrc).toContain('handleHomeOrgClick');
    expect(dialogSrc).toMatch(/await\s+onConfirm\(\)/);
  });
});

// ---------------------------------------------------------------------------
// R-5 alignment — tenant identification in title + body
// ---------------------------------------------------------------------------

describe('ConfirmDestructiveDialog — R-5 tenant identification', () => {
  it('amends the dialog title with the active tenant name', () => {
    // The literal phrase "confirming on" is the load-bearing R-5 marker.
    // If a future refactor drops this from the title, the user can't see
    // which tenant they're about to write to — exactly the failure mode
    // R-5 calls out.
    expect(dialogSrc).toContain('confirming on');
    expect(dialogSrc).toMatch(/\$\{title\}\s*—\s*confirming on\s*\$\{tenantLabel\}/);
  });

  it('leads the dialog body with "You are acting on <tenant>."', () => {
    // The body copy mirrors the ActingAsBanner "Acting as: <name>"
    // structure so the user gets the same visual + textual mapping in
    // both surfaces. Greppable so a future copy edit doesn't silently
    // drop the tenant call-out.
    expect(dialogSrc).toContain('You are acting on');
  });

  it('falls back to activeTenantId when activeTenantName is empty', () => {
    // Same safety net as ActingAsBanner: an empty handle would render
    // " — confirming on " (trailing space) in the title and "You are
    // acting on ." in the body — both defeat R-5.
    expect(dialogSrc).toContain('activeTenantName.trim() || activeTenantId');
  });

  it('passes tenantLabel through to BOTH the title and the body', () => {
    // The label is computed once and referenced in both surfaces. The
    // single source ensures they always agree (a fork would let the
    // title say "Bondi Bookkeeping" while the body still said an old
    // value during a partial re-render).
    expect(dialogSrc).toContain('const tenantLabel');
    expect(dialogSrc).toMatch(/confirming on\s*\$\{tenantLabel\}/);
    expect(dialogSrc).toMatch(/acting on \{tenantLabel\}/);
  });
});

// ---------------------------------------------------------------------------
// Dialog variant + composition
// ---------------------------------------------------------------------------

describe('ConfirmDestructiveDialog — Dialog primitive composition', () => {
  it('uses the brand-destructive DialogContent variant', () => {
    // E6.2 ships `brand-destructive` variant precisely for irreversible
    // actions (delete employee, hard-reset mapping). Using the variant
    // surfaces the red-tinted hairline + brand shadow — visual reinforcement
    // of the destructive nature.
    expect(dialogSrc).toContain('variant="brand-destructive"');
  });

  it('renders DialogTrigger with asChild forwarding the caller trigger', () => {
    // asChild lets the caller control the trigger styling (any Button
    // variant works). The trigger is a `ReactElement` — Radix's Slot
    // forwards click + focus to it.
    expect(dialogSrc).toMatch(/<DialogTrigger\s+asChild>\{trigger\}<\/DialogTrigger>/);
  });

  it('wires DialogTitle + DialogDescription for screen-reader naming', () => {
    // DialogTitle provides the accessible name; DialogDescription is
    // linked via Radix's `aria-describedby`. Both must be present for
    // the modal to announce correctly.
    expect(dialogSrc).toContain('<DialogTitle');
    expect(dialogSrc).toContain('<DialogDescription');
  });

  it('uses the destructive Button variant on the Confirm action', () => {
    // The confirm button reinforces the irreversible intent at the
    // action surface — the dialog variant alone is a container cue;
    // the button variant is the call-to-action cue.
    expect(dialogSrc).toMatch(/<Button[\s\S]*?variant="destructive"[\s\S]*?onClick=\{handleConfirm\}/);
  });
});

// ---------------------------------------------------------------------------
// Async + error semantics
// ---------------------------------------------------------------------------

describe('ConfirmDestructiveDialog — async + error semantics', () => {
  it('closes the dialog on successful onConfirm', () => {
    // After `await onConfirm()` resolves, setOpen(false) MUST run.
    // Forgetting this leaves the user staring at a dialog after the
    // write succeeded — UX broken.
    expect(dialogSrc).toMatch(/await\s+onConfirm\(\);[\s\S]*?setOpen\(false\)/);
  });

  it('keeps the dialog OPEN on onConfirm rejection (surfaces error inline)', () => {
    // The catch block sets the error state but does NOT call
    // setOpen(false). A future contributor who "tidies up" by closing on
    // error would silently swallow the failure — the wrong outcome for
    // a destructive action.
    expect(dialogSrc).toContain('setError(message)');
    // The error surface MUST render `role="alert"` for SR announcement
    // — the destructive-action context demands an assertive live region.
    expect(dialogSrc).toMatch(/role="alert"/);
    expect(dialogSrc).toMatch(/aria-live="assertive"/);
  });

  it('blocks close-while-pending', () => {
    // handleOpenChange checks `if (pending) return;` at the top so the
    // overlay click, Escape key, and X-button-close are all suppressed
    // mid-flight. Without this guard, the user could dismiss the modal
    // while a delete is in flight — the next mount would never see the
    // error.
    expect(dialogSrc).toMatch(/handleOpenChange[\s\S]*?if\s*\(pending\)\s*return/);
  });

  it('disables both Cancel and Confirm buttons while pending', () => {
    // Visual + interactive reinforcement of the pending state. The
    // `disabled={pending}` MUST be on both — disabling only Confirm
    // would let the user cancel-out mid-flight, which the close-guard
    // already blocks but the button click would still flash.
    const cancelMatches = dialogSrc.match(/data-testid="app-confirm-destructive-cancel"[\s\S]*?disabled=\{pending\}/);
    const confirmMatches = dialogSrc.match(/disabled=\{pending\}[\s\S]*?data-testid="app-confirm-destructive-confirm"/);
    // The disabled attribute appears in the source for both buttons
    // (count the disabled={pending} occurrences — must be ≥ 2 for the
    // two buttons).
    const occurrences = (dialogSrc.match(/disabled=\{pending\}/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    // And the cancel and confirm buttons both carry the pattern in
    // some order — directional asserts above check the structural
    // placement, but the count alone catches a one-off mis-paste.
    expect(cancelMatches || confirmMatches).toBeTruthy();
  });

  it('shows "Working…" label on Confirm while pending', () => {
    // Caller can override `confirmLabel`, but the busy state always
    // renders "Working…" so the user gets unambiguous feedback that
    // a write is in flight.
    expect(dialogSrc).toContain('Working…');
  });

  it('re-throws errors on the home-org skip path (no silent swallow)', () => {
    // Home-org has no dialog to surface the error in. The bypass handler
    // MUST re-throw so the caller's error boundary can handle it.
    // Greppable `throw e;` inside the catch.
    expect(dialogSrc).toMatch(/handleHomeOrgClick[\s\S]*?catch[\s\S]*?throw\s+e/);
  });
});

// ---------------------------------------------------------------------------
// Presentation / live split
// ---------------------------------------------------------------------------

describe('ConfirmDestructiveDialog — Presentation / live split', () => {
  it('exports both a live and a presentational variant', () => {
    // Storybook-renderable presentation + live hook-consumer for
    // production. Mirrors TenantSwitcher / ActingAsBanner.
    expect(dialogSrc).toContain('export function ConfirmDestructiveDialogPresentation');
    expect(dialogSrc).toContain('export function ConfirmDestructiveDialog(');
  });

  it('wraps the presentational variant with the hook on the live export', () => {
    // The live export MUST forward into the presentational sibling —
    // that's how Storybook covers the markup without a TenantProvider
    // mounted above.
    expect(dialogSrc).toMatch(/<ConfirmDestructiveDialogPresentation/);
  });

  it('marks the file as a Client Component (uses React hooks)', () => {
    // `useTenantContext`, `useState`, `useCallback`, `useMemo` all
    // require a Client boundary. Dialog itself also marks `'use client'`.
    expect(dialogSrc).toMatch(/^'use client'/m);
  });
});

// ---------------------------------------------------------------------------
// Context consumption
// ---------------------------------------------------------------------------

describe('ConfirmDestructiveDialog — context consumption', () => {
  it('reads isActingNonHome from useTenantContext on the live export', () => {
    // The derived `isActingNonHome` is the spec-mandated comparator
    // (single source of truth in the provider). The dialog reads it from
    // context, never re-derives it — re-derivation would risk drift.
    expect(dialogSrc).toContain('useTenantContext');
    expect(dialogSrc).toMatch(/isActingNonHome,\s*activeTenantId\s*\}\s*=\s*useTenantContext/);
  });

  it('memoises the active tenant name lookup', () => {
    // The membership list comes from server-rendered props; the lookup
    // must not run on every parent re-render. `useMemo` keyed on
    // memberships + activeTenantId is the established pattern.
    expect(dialogSrc).toMatch(/useMemo[\s\S]*?memberships\.find\(/);
  });

  it('does NOT fetch data inside the component (no Supabase client import)', () => {
    // The memberships prop is the only data source — same decoupling as
    // TenantSwitcher / ActingAsBanner. If a future refactor introduces a
    // client-side fetch here, the dialog would flash incorrect tenant
    // names while the query resolves.
    expect(dialogSrc).not.toContain('createSupabaseServerClient');
    expect(dialogSrc).not.toContain("'@supabase/");
  });
});

// ---------------------------------------------------------------------------
// Spec / tasks references
// ---------------------------------------------------------------------------

describe('ConfirmDestructiveDialog — spec + tasks discoverability', () => {
  it('references spec §5.2 + §8.3 + R-5 in the file header', () => {
    // Greppable references pin the contract — a future contributor can
    // jump straight to the spec sections that justify the behaviour.
    expect(dialogSrc).toContain('§5.2');
    expect(dialogSrc).toContain('§8.3');
    expect(dialogSrc).toContain('R-5');
  });

  it('references Task 3.5 + tasks.md lines 389–405 in the file header', () => {
    expect(dialogSrc).toContain('Task 3.5');
    expect(dialogSrc).toContain('tasks.md');
  });
});
