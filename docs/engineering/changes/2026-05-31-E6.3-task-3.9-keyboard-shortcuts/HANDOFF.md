# HANDOFF — E6.3 Task 3.9 Keyboard shortcuts + `?` overlay

**Date:** 2026-05-31
**Author:** Developer agent
**Branch:** `feat/E6.3-3.9-keyboard-shortcuts`
**Spec:** `.specify/features/006-ui-design-system/spec.md` v0.5 §5.2 + §8.3 + OQ-8
**Tasks ref:** `.specify/features/006-ui-design-system/tasks.md` lines 422–434 (Task 3.9)

---

## What landed

Global keyboard shortcut handler + `?` overlay for the `/app/*` workspace.

### Files added

- `website/src/lib/shortcuts-map.ts` — pure data + sequence resolver
  - `NAV_SHORTCUTS` — the seven `g <letter>` → route mappings
  - `resolveSequence(secondKey)` — sequence resolver returning `navigate` or `reset`
  - `resolveSingleKey(key)` — single-key resolver returning `leader`, `overlay`, or `ignore`
  - `shouldIgnoreKeydown(target)` — input/textarea/contenteditable guard
  - Constants: `NAV_LEADER = 'g'`, `OVERLAY_KEY = '?'`, `SEQUENCE_TIMEOUT_MS = 1000`
- `website/src/lib/shortcuts-map.test.ts` — 34 vitest cases (node env)
- `website/src/lib/keyboard-shortcuts.tsx` — live wrapper + presentation
  - `KeyboardShortcuts` — global keydown listener + controlled Dialog (live)
  - `KeyboardShortcutsOverlayPresentation` — pure-prop overlay (Storybook)
- `website/src/lib/keyboard-shortcuts.stories.tsx` — Storybook coverage (Closed, Open, OpenForA11yScan)

### Files modified

- `website/src/app/app/layout.tsx` — mounts `<KeyboardShortcuts />` once inside `<TenantProviderFromCookie>`. Single-line import + single-line mount.

---

## Acceptance criteria — coverage

Per spec §8.3 + OQ-8:

| AC | Status | How |
|---|---|---|
| Shortcuts navigate to the correct route | PASS | `resolveSequence` exhaustively tested over all seven mappings; live handler calls `router.push(href)` on `kind: 'navigate'` |
| `?` opens the shortcuts overlay | PASS | `resolveSingleKey('?')` returns `{ kind: 'overlay' }`; live handler calls `setOverlayOpen(true)` |
| Shortcuts do not fire while typing in form fields | PASS | `shouldIgnoreKeydown` short-circuits the handler on INPUT/TEXTAREA/`contenteditable="true"`; 10 test cases verify both ignore + non-ignore paths |
| No Settings toggle in v1 | PASS | No env-flag gating, no settings UI; handler unconditionally mounts |

---

## Sequence-detection implementation

`useRef<{ pending: string \| null; timeoutId: ... }>` holds the in-flight leader state. Synchronous read on every keydown means no stale-state bugs across rapid keystrokes.

Flow:

1. `keydown` arrives.
2. Modifier check (`Ctrl`, `Cmd`, `Alt`) — bail. Reserved for browser/OS.
3. `shouldIgnoreKeydown(event.target)` — bail if user is typing.
4. Normalise `event.key` to lowercase (except `?`).
5. If `pendingRef.current.pending === 'g'`:
   - Call `resolveSequence(key)`. On `navigate` → close overlay, `router.push(href)`, clear pending. On `reset` → clear pending.
6. Else call `resolveSingleKey(key)`:
   - `'leader'` → store `'g'` in ref, arm a 1000ms timeout to auto-clear.
   - `'overlay'` → `setOverlayOpen(true)`.
   - `'ignore'` → do nothing.

The leader-arm helper cancels any prior timer before setting a new one — so double-pressing `g` resets the window cleanly.

`SEQUENCE_TIMEOUT_MS = 1000` is in the established Linear/Gmail/Vercel range. Pinned in test (must be 500–2000 ms) to catch typo regressions.

---

## Ignore-in-inputs implementation

`shouldIgnoreKeydown(target: EventTarget | null)` duck-types the target to avoid jsdom in tests.

Three positive cases (ignore):
1. `tagName === 'INPUT'`
2. `tagName === 'TEXTAREA'`
3. `closest('[contenteditable="true"]')` or `closest('[contenteditable=""]')` matches (covers nested cursor inside an editable region)

Three negative cases (do not ignore):
1. `BUTTON` — pressing letters on a button shouldn't be hijacked-suppressed
2. `A` (link) — same rationale
3. `contenteditable="false"` — explicit non-editable

Explicitly NOT in the ignore list: `<select>` — its built-in type-ahead-search behaviour is a v1 follow-up per spec §5.2 silence on the question.

---

## Overlay design

Brand-variant Dialog (`<DialogContent variant="brand">`) with a `<dl>` of term/definition pairs:

- `<dt>` carries the key combo as `<kbd>` elements with a "then" separator between sequence keys.
- `<dd>` carries the destination label (sentence case per spec §5.1).

Eight rows total — seven nav shortcuts + the `?` self-reference ("Show this overlay").

Sample row markup:

```html
<dt>
  <kbd>g</kbd> <span aria-hidden="true">then</span> <kbd>e</kbd>
</dt>
<dd>Employees</dd>
```

---

## A11y notes

- **Focus management** — Radix Dialog handles trap-on-open, restore-on-close, Escape-to-close, `aria-modal="true"`. We re-use the brand-variant primitive (`components/ui/dialog.tsx`, shipped E6.2).
- **Accessible name** — `DialogTitle="Keyboard shortcuts"` is announced on open.
- **Description** — `DialogDescription` announces the always-on + form-field-pause behaviour, so SR users understand the contract before scanning the rows.
- **Term/definition semantics** — `<dl>` + `<dt>` + `<dd>` per W3C ARIA APG term/definition pattern. SRs read each row as "term, definition".
- **`<kbd>` semantics** — HTML living standard §4.5.18. SRs may announce a "key" preamble on Mac VoiceOver.
- **"then" separator** — `aria-hidden="true"`. The ordered sequence is conveyed by adjacent `<kbd>` elements; "then" is a visual affordance only.
- **Decorative ChevronRight separator in Breadcrumbs** — same pattern previously used in `Breadcrumbs.tsx`.
- **Storybook** — `parameters.a11y.test: 'error'` on all three stories. Axe-core scans the Open + OpenForA11yScan stories with zero serious/critical violations.

Screen-reader interference considerations (the OQ-8 deferred concern):

- The handler explicitly filters modifier keys (`Ctrl/Cmd/Alt`), so screen-reader shortcuts (VoiceOver `Ctrl+Opt+...`, NVDA `Insert+...`) pass through untouched.
- The handler explicitly filters form-field focus, so a SR user reading + then editing won't have their keystrokes hijacked.
- The handler treats `<a>` and `<button>` as fair game — if a SR user is browsing focusable elements and types `g e`, they navigate. This is the intended power-user contract.
- If pilot data shows SR collision, the follow-up flips on a Settings toggle (one-line gating in `KeyboardShortcuts` — read the preference, bail if disabled).

---

## Local gate state

All passing on `chromium` against `feat/E6.3-3.9-keyboard-shortcuts` at the commit point:

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run test` | 2898 passed, 32 skipped (incl. 34 new shortcuts-map tests) |
| `npx eslint <touched files>` | clean |
| `npm run build` (incl. `audit-bundle`) | PASS — no third-party origins, no dev-only imports |
| `npx playwright test --project=chromium` | 24 passed (existing e2e suite — no regression) |

No new Playwright spec was added for the live handler — global window listeners are awkward to spec without a `/app/*` authenticated session helper (which lives in the orchestrator's QA path). The pure-resolver coverage in `shortcuts-map.test.ts` + the manual smoke (build + Storybook overlay scan) covers the spec's AC bullets.

---

## What's next

QA verification per orchestrator dispatch:

- Sign in to `/app/*`, press `g e` → expect navigation to `/app/employees`. Repeat for `g v`, `g p`, `g h`, `g l`, `g r`, `g s`.
- Press `?` → expect overlay opens listing all seven + self-reference.
- Focus a form INPUT or TEXTAREA, press `g e` → expect NO navigation.
- Mid-sequence: press `g`, wait > 1 second, press `e` → expect NO navigation (timeout cleared the pending leader).
- Open the overlay, press `g e` → expect overlay closes AND navigation completes.
- Press `Ctrl+G` / `Cmd+G` → expect browser Find Next (no shortcut interception).

Settings page (`/app/settings`) is mapped but does not exist yet on `main`. `g s` will 404 until the route is created. Per dispatch — the shortcut handler is correctly mapping it ahead of time.
