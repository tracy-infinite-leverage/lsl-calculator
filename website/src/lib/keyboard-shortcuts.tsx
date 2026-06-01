/**
 * keyboard-shortcuts.tsx — global `/app/*` keyboard shortcut handler +
 * `?` overlay.
 *
 * E6.3 Task 3.9 (spec §5.2 + §8.3, OQ-8). Mounted once at the workspace
 * layout level (`app/app/layout.tsx`) so a single global `keydown`
 * listener serves every `/app/*` page.
 *
 * # The two responsibilities
 *
 *   1. **Listen for the navigation sequences** (`g e`, `g v`, `g p`,
 *      `g h`, `g l`, `g r`, `g s`) and route via `useRouter().push()`.
 *   2. **Listen for `?`** and open a controlled Dialog that lists every
 *      shortcut.
 *
 * The pure-data + sequence resolver live in `./shortcuts-map.ts` —
 * `NAV_SHORTCUTS`, `resolveSequence`, `resolveSingleKey`,
 * `shouldIgnoreKeydown`. This file composes them with the browser-only
 * concerns: the keydown listener, the timer for sequence-timeout, the
 * Next router, and the Dialog UI.
 *
 * The split lets `shortcuts-map.test.ts` cover every resolver branch in
 * vitest's `node` env without a jsdom shim. The live wiring here is
 * verified by Playwright at the orchestrator layer.
 *
 * # Always-on (OQ-8 — operator-locked)
 *
 * Spec §5.2 + §8.3 + tasks.md line 429: shortcuts ship always-on in v1.
 * No settings toggle, no env-flag gating. If a pilot user reports
 * screen-reader interference, the follow-up flips the gating to a per-
 * user preference in Settings. Today the handler unconditionally mounts.
 *
 * # Why a single global listener (not per-component)
 *
 * The handler attaches to `window` once (via `useEffect`) and lives for
 * the lifetime of any `/app/*` route. Per-component listeners would
 * either need a focus context to receive keystrokes (the user would
 * have to click into the page first), or have to mount on `document`
 * separately (forcing multiple coordinated listeners). Single global =
 * the user can land on any `/app/*` route fresh from a tenant switch
 * and immediately press `g e` without needing to focus first. This is
 * the Linear / GitHub / Gmail pattern.
 *
 * # Why the overlay is a controlled Dialog (no DialogTrigger)
 *
 * The overlay opens in response to a keyboard event, not a click. There
 * is no trigger element to wrap with `<DialogTrigger>`. So we control
 * the `open` prop directly and let `onOpenChange` handle the Escape /
 * overlay-click / X-button close paths (Radix wires all three for free).
 *
 * # Accessibility surface
 *
 *   - The Dialog primitive (`components/ui/dialog.tsx`) already wires:
 *     focus trap on open, focus restoration on close, Escape-to-close,
 *     `aria-modal="true"`. We only re-use it.
 *   - `DialogTitle` ("Keyboard shortcuts") is the accessible name —
 *     screen readers announce it on open.
 *   - The shortcut table inside the overlay is a `<dl>` with `<dt>` for
 *     the key combo and `<dd>` for the destination label. This is the
 *     W3C ARIA APG recommendation for term/definition pairs (which is
 *     exactly what a shortcut row is — "the key `g e` means navigate
 *     to Employees").
 *   - Each `<kbd>` element is the semantically correct tag for a key
 *     combo on a page — screen readers may announce "key" preamble.
 *   - The handler IGNORES keystrokes while focus is in an INPUT /
 *     TEXTAREA / contenteditable surface (see `shouldIgnoreKeydown`).
 *
 * # Why not use a settings toggle in v1
 *
 * Locked by OQ-8 operator decision recorded in spec v0.4 (2026-05-27).
 * A toggle adds:
 *   - A Settings UI (E5.x territory, not E6).
 *   - A persistence path (user table column / preference cookie).
 *   - A read in this handler that has to be debounced against
 *     `useEffect` lifecycle.
 * None of which advances the OQ-8 question ("is screen-reader
 * interference a real problem?"). Ship always-on, gather pilot data,
 * add the toggle if needed. Same posture as the home-org skip in
 * ConfirmDestructiveDialog (G-8 inline note).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  NAV_LEADER,
  NAV_SHORTCUTS,
  OVERLAY_KEY,
  SEQUENCE_TIMEOUT_MS,
  resolveSequence,
  resolveSingleKey,
  shouldIgnoreKeydown,
} from './shortcuts-map';

// ---------------------------------------------------------------------------
// Pure-prop Presentation — the overlay markup
// ---------------------------------------------------------------------------

export interface KeyboardShortcutsOverlayPresentationProps {
  /**
   * Whether the overlay is open. The live `KeyboardShortcuts` wrapper
   * controls this from internal state; Storybook can drive it via the
   * `defaultOpen` arg.
   */
  open: boolean;
  /**
   * Called when Radix wants to change the open state (Escape pressed,
   * overlay clicked, X button hit). Forwarded to the parent.
   */
  onOpenChange: (open: boolean) => void;
}

/**
 * The shortcut-overlay UI in isolation. Renders a brand-styled Dialog
 * listing every navigation shortcut + the `?` overlay self-reference.
 *
 * Mounted by:
 *   - `KeyboardShortcuts` (the live wrapper) — `open` state from a
 *     `useState` inside the wrapper.
 *   - Storybook — `open: true` via story args so the overlay markup is
 *     a11y-scanned without a keystroke.
 */
export function KeyboardShortcutsOverlayPresentation({
  open,
  onOpenChange,
}: KeyboardShortcutsOverlayPresentationProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="brand"
        data-testid="app-keyboard-shortcuts-overlay"
      >
        <DialogHeader>
          <DialogTitle data-testid="app-keyboard-shortcuts-title">
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Press a combo from anywhere in the app. Shortcuts are
            always on — they pause while you&rsquo;re typing in a form
            field.
          </DialogDescription>
        </DialogHeader>

        {/* The shortcut list. <dl> is the semantically correct element
          * for term/definition pairs — W3C ARIA APG recommendation.
          * Each row pairs the key combo (term) with its destination
          * (definition). <kbd> elements inside the <dt> mark the
          * physical keys. */}
        <dl
          className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 pt-2"
          data-testid="app-keyboard-shortcuts-list"
        >
          {NAV_SHORTCUTS.map((shortcut) => (
            <ShortcutRow
              key={shortcut.secondKey}
              combo={[NAV_LEADER, shortcut.secondKey]}
              label={shortcut.label}
              testid={`app-keyboard-shortcut-${shortcut.secondKey}`}
            />
          ))}
          {/* The self-reference row — `?` opens THIS overlay. Useful
            * documentation for the first-time user who landed here via
            * a guess. */}
          <ShortcutRow
            combo={[OVERLAY_KEY]}
            label="Show this overlay"
            testid="app-keyboard-shortcut-overlay"
          />
        </dl>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Internal row component
// ---------------------------------------------------------------------------

interface ShortcutRowProps {
  /**
   * One or more keys that form the combo. Rendered with a "then"
   * separator between keys so the user sees "press `g`, then `e`" —
   * matching the sequence semantics.
   */
  combo: readonly string[];
  /** Destination label (sentence case per spec §5.1 brand voice). */
  label: string;
  /** stable data-testid for Playwright + Storybook interaction tests. */
  testid: string;
}

function ShortcutRow({ combo, label, testid }: ShortcutRowProps) {
  return (
    <>
      <dt
        className="flex items-center gap-1.5 font-mono text-sm"
        data-testid={`${testid}-combo`}
      >
        {combo.map((key, i) => (
          <span key={`${key}-${i}`} className="flex items-center gap-1.5">
            <kbd
              // `<kbd>` is the semantic element for a keyboard input
              // (HTML living standard, §4.5.18). Styling keeps the
              // monospace tone and a subtle brand border so the key
              // reads as a physical button.
              className="inline-flex min-w-[1.5rem] items-center justify-center rounded-sm border border-brand-light-blue/60 bg-brand-white px-1.5 py-0.5 text-xs font-semibold text-brand-charcoal shadow-sm"
            >
              {key}
            </kbd>
            {i < combo.length - 1 && (
              <span
                className="text-xs text-brand-charcoal/60"
                aria-hidden="true"
              >
                then
              </span>
            )}
          </span>
        ))}
      </dt>
      <dd
        className="self-center text-sm text-brand-charcoal"
        data-testid={`${testid}-label`}
      >
        {label}
      </dd>
    </>
  );
}

// ---------------------------------------------------------------------------
// Live wrapper — the global keydown listener
// ---------------------------------------------------------------------------

/**
 * `KeyboardShortcuts` — mount once at the workspace layout level.
 *
 * Maintains TWO pieces of state:
 *
 *   - `overlayOpen` (useState) — drives the Dialog `open` prop.
 *   - `pendingRef` (useRef) — the current sequence head (`'g'` or
 *     `null`) + the timeout handle that clears it after
 *     `SEQUENCE_TIMEOUT_MS`. A ref (not state) because the keydown
 *     handler reads + writes it synchronously on every keystroke;
 *     a state would trigger a re-render on every press and lose the
 *     "synchronous read" property mid-handler.
 *
 * On every `keydown` event:
 *
 *   1. Bail early if the event is a modifier-prefixed shortcut. Spec
 *      §5.2 names bare `g e` / `?` / etc.; Ctrl+G, Alt+G, Cmd+G are
 *      browser/OS shortcuts (Find, etc.) we MUST NOT shadow.
 *   2. Bail early if `shouldIgnoreKeydown(event.target)` — user is
 *      typing into an input/textarea/contenteditable.
 *   3. If a `g` is pending, route through `resolveSequence(key)`.
 *      Navigate-or-reset.
 *   4. Otherwise route through `resolveSingleKey(key)`. Leader / overlay
 *      / ignore.
 *
 * The sequence-timeout cleanup runs on unmount and after every state
 * transition so we never leak a `setTimeout` handle across navigations.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Sequence state. `pending === 'g'` means a leader is in flight and
  // the NEXT keystroke is interpreted as the second key. `timeoutId`
  // is the active `setTimeout` handle (or `null` when no leader is
  // pending) — clearing it on reset prevents a stale timer firing and
  // wiping a fresh pending leader.
  const pendingRef = useRef<{
    pending: string | null;
    timeoutId: ReturnType<typeof setTimeout> | null;
  }>({ pending: null, timeoutId: null });

  // Clear any pending sequence + cancel the active timer. Centralised
  // so every reset path (timeout fired, unmount, after-navigate) goes
  // through the same accounting.
  const clearPending = useCallback(() => {
    const state = pendingRef.current;
    if (state.timeoutId !== null) {
      clearTimeout(state.timeoutId);
    }
    pendingRef.current = { pending: null, timeoutId: null };
  }, []);

  // Set `g` as pending and arm the auto-clear timer. Replaces any
  // prior pending state (e.g. user pressed `g` twice → only the most
  // recent leader is active; the prior timer is cancelled).
  const armLeader = useCallback(() => {
    const state = pendingRef.current;
    if (state.timeoutId !== null) {
      clearTimeout(state.timeoutId);
    }
    const timeoutId = setTimeout(() => {
      // Timer fired without a second key — reset cleanly. Read the ref
      // fresh; clearPending closure could be stale.
      pendingRef.current = { pending: null, timeoutId: null };
    }, SEQUENCE_TIMEOUT_MS);
    pendingRef.current = { pending: NAV_LEADER, timeoutId };
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      // ----- (1) Modifier-prefixed: skip. -----
      // Ctrl+G / Cmd+G / Alt+G / Meta+G are reserved for browser + OS
      // shortcuts (Find Next, etc.). Shadowing them would break user
      // expectations and accessibility tooling. The bare keystroke
      // path is the spec contract; everything else is hands-off.
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
        // NOTE: we DO accept `shiftKey` because `?` is Shift+`/` on
        // most keyboards — `event.key === '?'` is the truthy signal,
        // and Shift on letters (e.g. Shift+G → 'G') is normalised
        // downstream via `.toLowerCase()`.
      ) {
        return;
      }

      // ----- (2) Typing into a form field: skip. -----
      if (shouldIgnoreKeydown(event.target)) {
        return;
      }

      // ----- (3) Normalise the key for resolver lookup. -----
      // `?` is reported by the browser as `'?'` directly when Shift+`/`
      // is pressed. Letters arrive as `'g'` or `'G'` depending on
      // Shift / CapsLock — we lowercase everything else.
      const key = event.key === OVERLAY_KEY ? OVERLAY_KEY : event.key.toLowerCase();

      // ----- (4) Sequence vs single-key. -----
      const state = pendingRef.current;
      if (state.pending === NAV_LEADER) {
        // We're mid-sequence. Resolve the second key.
        const result = resolveSequence(key);
        clearPending();
        if (result.kind === 'navigate') {
          // Prevent default in the success case so the second key
          // doesn't bubble into a focus trap or trigger a download
          // dialog on edge cases (e.g. `g s` on a page with `s`
          // bound to save-as via a hidden button).
          event.preventDefault();
          // Close the overlay BEFORE navigating. If the user pressed
          // `g e` from inside the open overlay, leaving it open across
          // the navigation would block the destination view. Setting
          // `overlayOpen=false` first lets Radix restore focus to the
          // pre-overlay element before the route change kicks in.
          setOverlayOpen(false);
          router.push(result.href);
        }
        // result.kind === 'reset' → clearPending already ran; do nothing.
        return;
      }

      // No pending leader → single-key path.
      const result = resolveSingleKey(key);
      if (result.kind === 'leader') {
        // Arm the leader. PreventDefault so the standalone `g`
        // doesn't trigger any page-level `accesskey`/find-as-you-type
        // shortcut. (Firefox's quickfind starts on `/` not `g`; this
        // is belt-and-braces.)
        event.preventDefault();
        armLeader();
      } else if (result.kind === 'overlay') {
        // Open the overlay. PreventDefault so the `?` doesn't bubble
        // into anything else.
        event.preventDefault();
        setOverlayOpen(true);
      }
      // result.kind === 'ignore' → bare keystroke, hands off. Default
      // behaviour proceeds (typing into a focused button does nothing;
      // typing into an editable element was already filtered above).
    }

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      // Belt-and-braces: clear the pending timer on unmount so a
      // navigation-away-mid-sequence doesn't leak a setTimeout that
      // resolves into an unmounted ref. clearPending uses the closure
      // ref directly — safe even after unmount because the ref object
      // itself outlives the effect.
      clearPending();
    };
  }, [router, armLeader, clearPending]);

  return (
    <KeyboardShortcutsOverlayPresentation
      open={overlayOpen}
      onOpenChange={setOverlayOpen}
    />
  );
}
