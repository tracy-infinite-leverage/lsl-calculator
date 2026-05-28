# HANDOFF — E6.2 Task 2.4: typed TS mirror of design tokens

**Date:** 2026-05-28
**Branch:** `feat/E6.2-task-2.4-typed-tokens` (cut from `origin/main` at `5ec1e58`)
**Status:** Implementation complete; awaiting QA verification before commit / push / PR.
**Author:** developer agent
**Predecessor merged:** PR #58 (Task 2.3 — Tailwind v4 theme tokens)
**Successor (next):** Task 2.5 — Wordmark + Lockup + Icon barrel components

---

## 1. Scope

Implement the **typed TypeScript mirror** of the brand tokens that Task 2.3 landed in `website/src/app/globals.css`. Per `tasks.md` Task 2.4:

> Generate (or hand-author + lint) a typed TS re-export of Tailwind tokens for non-CSS contexts (specifically: react-pdf templates in Phase 4). Single source of truth = Tailwind config; `lib/tokens.ts` reads from it.

**Acceptance criteria (verbatim from `tasks.md`):**

1. `lib/tokens.ts` exports `colors`, `fontSizes`, `spacing`, `radii`, `shadows` as typed constants
2. Unit test confirms `lib/tokens.ts` values match `tailwind.config.ts` source

Both ACs are met — see §3 (exports) and §5 (sync test). The `tailwind.config.ts` reference in AC #2 is honoured as `globals.css` per the Task 2.3 [SCOPE-NOTE] (no `tailwind.config.ts` exists; Tailwind v4 uses CSS-first config).

**Out of scope (deferred to later tasks):**

- Wordmark / Lockup / Icon barrel components → Task 2.5
- shadcn variant overrides via `cva` → Task 2.6
- PDF templates that consume this mirror → Phase 4 (Tasks 5.x)
- Spacing token additions → Task 2.6 if friction surfaces (none today)

---

## 2. [SCOPE-NOTE] File location chosen

**Spec / impl-plan prescribes:** `website/lib/tokens.ts`.

**Reality on `main`:**

- `lib/` lives under `src/` (Next.js 16 with `src/` directory enabled — `website/src/lib/`).
- The folder pattern is **either** a flat `.ts` file (e.g. `src/lib/utils.ts`) **or** a subfolder with internal structure (e.g. `src/lib/lsl/`, `src/lib/observability/`, `src/lib/supabase/`).

**Decision:** Land the mirror as a flat file at **`website/src/lib/design-tokens.ts`** with a colocated **`website/src/lib/design-tokens.test.ts`**.

**Rationale:**

1. **File, not folder** — the mirror is ~30 tokens / ~140 LOC. Wrapping it in a `design-tokens/` folder with an `index.ts` is premature structure. Match the `utils.ts` pattern in the same directory.
2. **`design-tokens.ts`, not `tokens.ts`** — the lib root carries a generic `utils.ts`; a generic `tokens.ts` collides semantically with future "auth tokens" / "API tokens" / "session tokens" callers might reach for. `design-tokens.ts` is unambiguous and self-documenting. The plan's `lib/tokens.ts` wording is incidental — what matters is that this is the single typed mirror of the design system.
3. **Inside `src/`** — Vitest's `include: ['src/**/*.{test,spec}.ts']` glob already picks up the colocated test without config change. No new test directory to maintain.

If a future PDF / `cva` consumer wants `import { colors } from '@/lib/tokens'` for ergonomic reasons, a one-line re-export shim can be added later — but no current consumer needs it.

---

## 3. Files modified / created

| Path | Status | Purpose |
|---|---|---|
| `website/src/lib/design-tokens.ts` | **CREATED** | Hand-authored typed mirror — `BrandColour` / `BrandTextSize` / `BrandRadius` / `BrandShadow` / `BrandGradient` / `BrandSpacing` union types + `colors` / `fontSizes` / `radii` / `shadows` / `gradients` / `spacing` `as const` records. |
| `website/src/lib/design-tokens.test.ts` | **CREATED** | CSS ↔ TS sync test. Parses `:root { … }` block + `@theme inline` block from `globals.css`, asserts every TS-side token matches the CSS-side declaration (after whitespace normalisation). 34 test cases. |
| `docs/engineering/changes/2026-05-28-E6.2-task-2.4-typed-tokens/HANDOFF.md` | **CREATED** | This document. |
| `docs/engineering/changes/2026-05-28-E6.2-task-2.4-typed-tokens/QA-REPORT.md` | _(to be written by QA)_ | — |

**Untouched (verified clean):**

- `website/src/app/globals.css` — Task 2.3's source of truth is the read-only contract for this task.
- `tests/`, `**/__tests__/` — no existing test modified (Task 2.11 sanctity respected). The new test file `design-tokens.test.ts` lives at `src/lib/`, NOT under `__tests__/` — colocated with the source it tests, consistent with `src/lib/observability/scrub-pii.test.ts` and `src/lib/lsl/dispatch.test.ts`.
- LSL engine code — SC-7 respected.
- No new runtime dependencies. No new dev dependencies. Pure stdlib (`node:fs`, `node:path` already in use across the project).

---

## 4. Type-mirror preview (key exports)

```ts
// website/src/lib/design-tokens.ts

export type BrandColour =
  | 'brand-navy'
  | 'brand-gold'
  | 'brand-white'
  | 'brand-light-blue'
  | 'brand-yellow'
  | 'brand-dark-blue'
  | 'brand-charcoal'
  | 'brand-grey'
  | 'brand-advisory';

export const colors: Readonly<Record<BrandColour, string>> = {
  'brand-navy': '#48608a',
  'brand-gold': '#d9a428',
  'brand-white': '#ffffff',
  'brand-light-blue': '#a0aec1',
  'brand-yellow': '#eebd3c',
  'brand-dark-blue': '#324d61',
  'brand-charcoal': '#333232',
  'brand-grey': '#808897',
  'brand-advisory': '#6ec8c0',
} as const;

export type BrandTextSize =
  | 'title-min' | 'title-mid' | 'title-max'
  | 'h1-min' | 'h1-max'
  | 'h2-min' | 'h2-max'
  | 'h3-min' | 'h3-max'
  | 'body-min' | 'body-max'
  | 'caption';

export const fontSizes: Readonly<Record<BrandTextSize, string>> = {
  'title-min': '2.667rem', 'title-mid': '4.333rem', 'title-max': '6rem',
  'h1-min': '1.833rem', 'h1-max': '2.333rem',
  'h2-min': '1.5rem',   'h2-max': '1.667rem',
  'h3-min': '1.167rem', 'h3-max': '1.333rem',
  'body-min': '0.833rem', 'body-max': '1rem',
  caption: '0.667rem',
} as const;

export type BrandRadius = 'brand-sm' | 'brand-md' | 'brand-lg' | 'brand-xl' | 'brand-2xl';

export const radii: Readonly<Record<BrandRadius, string>> = {
  'brand-sm': '0.25rem',
  'brand-md': '0.5rem',
  'brand-lg': '0.75rem',
  'brand-xl': '1rem',
  'brand-2xl': '1.5rem',
} as const;

export type BrandShadow = 'brand-sm' | 'brand-md' | 'brand-lg';

export const shadows: Readonly<Record<BrandShadow, string>> = {
  'brand-sm': '0 1px 2px 0 rgba(72, 96, 138, 0.06), 0 1px 2px 0 rgba(72, 96, 138, 0.04)',
  'brand-md': '0 4px 6px -1px rgba(72, 96, 138, 0.08), 0 2px 4px -2px rgba(72, 96, 138, 0.06)',
  'brand-lg': '0 10px 24px -6px rgba(72, 96, 138, 0.10), 0 4px 10px -4px rgba(72, 96, 138, 0.06)',
} as const;

export type BrandGradient = 'brand-navy-gold' | 'brand-navy-light-blue';

export const gradients: Readonly<Record<BrandGradient, string>> = {
  'brand-navy-gold': 'linear-gradient(135deg, #48608a 0%, #d9a428 100%)',
  'brand-navy-light-blue': 'linear-gradient(135deg, #48608a 0%, #a0aec1 100%)',
} as const;

// Spacing — AC compatibility surface, empty by design.
// Task 2.3 did NOT add --spacing-* tokens (default Tailwind scale adequate).
export type BrandSpacing = never;
export const spacing: Readonly<Record<BrandSpacing, string>> = {} as const;
```

**`as const` posture:** every record is `as const` + `Readonly<Record<…, string>>`. Consumers (PDF templates, `cva` variant authors) get autocomplete on token keys AND a compile error if they pass a token name that drifted vs the source CSS.

---

## 5. Sync-test approach (load-bearing)

**File:** `website/src/lib/design-tokens.test.ts` — 34 test cases.

**What it asserts:**

1. **Per-token equality** — for every entry in `colors`, `fontSizes`, `radii`, `shadows`, `gradients`, a corresponding `--<name>: <value>;` declaration exists in `globals.css` AND its value (after whitespace normalisation) matches the TS literal.
2. **Coverage guard** — every `--brand-<colour>` declared in `globals.css :root` is mirrored in `colors`. Catches the inverse drift: someone adds a colour to CSS but forgets the TS side.
3. **Spacing inverse-drift guard** — `globals.css :root` must NOT contain `--spacing-*` declarations (since the TS mirror is empty). Catches the case where Task 2.6 adds `--spacing-*` to CSS without mirroring here.

**Parser strategy:**

- Reads `globals.css` from disk with `node:fs.readFileSync`.
- Extracts the `:root { … }` block (which carries literal hex / rem / box-shadow values).
- `--text-*` tokens live in `@theme inline { … }` as direct literals (not `var()` references), so the test scans the whole file for those.
- Regex-extracts each `--<name>: <value>;` declaration; value capture is multi-line-tolerant (shadows wrap two `box-shadow` rules across lines for readability).
- Normalises whitespace on both sides before equality (collapse `\s+` to single space + trim) so a CSS author can wrap a long declaration for readability without breaking the test.

**Drift verification (load-bearing claim verified):**

During development I deliberately changed `colors['brand-navy']` from `#48608a` to `#48608b` and re-ran the test. Output:

```
× src/lib/design-tokens.test.ts > … > --brand-navy matches globals.css
AssertionError: expected '#48608a' to be '#48608b'
Expected: "#48608b"
Tests  1 failed | 33 passed (34)
```

The test fails cleanly with a precise diff naming the drifted token. **Reverted before commit.** Future maintainers who rename a token in only one place will see the same failure.

---

## 6. Verification results (self-check)

| Gate | Command | Result |
|---|---|---|
| LSL + new unit tests | `npm test` | **2338 / 2338 passed** (44 files) — 2304 baseline + 34 new sync tests = 2338 |
| Type-check | `npx tsc --noEmit` | clean (no output) |
| Lint | `npm run lint` | **1615 problems** (17 errors, 1598 warnings) — **zero delta** vs `main` baseline |
| Next.js build | `npm run build` | clean — all 10 routes compile (static + dynamic) |
| Storybook build | `npm run build-storybook` | clean — built in 2.08s, no story errors |
| Drift test (load-bearing) | manual mutate-and-revert | **confirmed test fails on deliberate drift, reverted to clean state** |
| Playwright e2e | not run by developer | deferred to QA (CI runs full 92 × 4 = 368 matrix; no `tests/` changes in this PR) |

**Test-folder sanctity (Task 2.11 contract):** `git diff origin/main -- 'tests/' '**/__tests__/'` returns empty — verified before handoff. The project has no top-level `tests/` directory; existing `__tests__/` (auth Phase 4 RLS) is untouched. The new `design-tokens.test.ts` lives at `src/lib/design-tokens.test.ts` colocated with its source, matching the existing pattern (`src/lib/observability/scrub-pii.test.ts`, `src/lib/lsl/dispatch.test.ts`, etc.) — this is NOT a modification to existing test infrastructure.

---

## 7. QA acceptance criteria

QA should confirm the following before signing off:

1. **AC #1 satisfied** — `website/src/lib/design-tokens.ts` exports `colors`, `fontSizes`, `spacing`, `radii`, `shadows` as typed `Readonly<Record<…, string>>` constants (plus `gradients` as a bonus mirror).
2. **AC #2 satisfied** — `website/src/lib/design-tokens.test.ts` exists, runs in the default `npm test` invocation, and asserts CSS ↔ TS parity per §5 above.
3. **Sync test catches drift** — QA may independently verify by mutating one value in `design-tokens.ts` (e.g. change `brand-navy` to `#48608z`) and confirming `npm test` fails with a precise diff. Revert after.
4. **No hard-coded brand values introduced outside the mirror** — `grep -rE "#48608a|#d9a428|#a0aec1|#eebd3c|#324d61|#333232|#808897|#6ec8c0" website/src/ --exclude="globals.css" --exclude="design-tokens.ts" --exclude="design-tokens.test.ts"` should return zero hits.
5. **Lint delta is exactly zero** — total problem count remains 1615 (17 errors, 1598 warnings). No new directives, no new disables.
6. **Suites still green** — `npm test` returns 2338/2338; CI runs the 92 × 4 Playwright matrix on PR open and that must come back green before merge.
7. **`tests/` and existing `__tests__/` untouched** — `git diff origin/main -- 'tests/' '**/__tests__/'` returns empty.
8. **Type-check clean** — `npx tsc --noEmit` produces no output.
9. **Storybook build still clean** — `npm run build-storybook` succeeds (no new story files added in this task; Task 2.5 will).
10. **`globals.css` byte-for-byte unchanged** — `git diff origin/main -- website/src/app/globals.css` returns empty. This task is read-only against the Task 2.3 source.

---

## 8. Verification steps for QA

```bash
# From repo root
cd website

# 1. Type-check
npx tsc --noEmit

# 2. Lint (expect 1615 problems — zero delta)
npm run lint

# 3. Unit suite (expect 2338/2338 — 2304 baseline + 34 new sync tests)
npm test

# 4. Production build
npm run build

# 5. Storybook build
npm run build-storybook

# 6. Drift catch — optional independent verification
#    Edit design-tokens.ts → change one hex → npm test → confirm fail → revert.

# 7. Hex-leak audit (no brand hex literals outside the mirror + CSS)
grep -rnE "#48608a|#d9a428|#a0aec1|#eebd3c|#324d61|#333232|#808897|#6ec8c0" \
  src/ \
  --exclude="globals.css" \
  --exclude="design-tokens.ts" \
  --exclude="design-tokens.test.ts" \
  || echo "no leaks — pass"

# 8. tests/ folder + existing __tests__/ diff guard (Task 2.11 contract)
git fetch origin main
git diff origin/main -- 'tests/' '**/__tests__/'
# expect: empty output

# 9. globals.css read-only contract
git diff origin/main -- website/src/app/globals.css
# expect: empty output
```

If all nine commands pass, QA may sign off and the developer will then commit + push + open PR for operator merge.

---

## 9. Open follow-ups (NOT for this task)

- **Task 2.5** — Wordmark / Lockup / Icon barrel components. First real consumer of `BrandColour` + `BrandTextSize` union types as `cva` variant keys.
- **Task 2.6** — shadcn variant overrides via `cva`. Each `cva` call's variant key set should reference `BrandColour` / `BrandRadius` / `BrandShadow` so a typo on a variant name is a compile error, not a silent runtime miss.
- **Phase 4 (Task 5.2 / 5.3)** — react-pdf `Letterhead` + `MethodologyFooter` consume `colors`, `fontSizes`, `radii`, `shadows` directly as inline-style values. This is the primary motivating consumer of this task per impl-plan §1.1 decision 1.
- **Spacing-token gap** — if Task 2.6 surfaces a friction point (e.g. a 14px or 22px step the Tailwind default scale lacks), add the token to `globals.css` AND the `spacing` record here in the same PR. The sync test's spacing inverse-drift guard will fail loudly if only one side is updated.

---

## 10. Decision log (inline)

| Decision | Rationale |
|---|---|
| File path `src/lib/design-tokens.ts`, not `src/lib/tokens.ts` | Spec wording is incidental; `design-tokens` is unambiguous vs future auth/API/session tokens. The lib root carries a generic `utils.ts`; matching that flat-file convention beats a one-file `design-tokens/` folder. |
| Flat file + colocated test, not subfolder | ~140 LOC + 34 tests. No internal structure needed yet. Matches `src/lib/observability/scrub-pii.test.ts` colocation pattern. |
| Hand-authored, not auto-generated | Tailwind v4's `@theme inline` uses `var()` references that need resolution to compare. The sync test asserts equality against the literal `:root` declarations — same drift protection without a build-time generator. ~30 tokens × quarterly cadence = generator overhead not justified. |
| `Readonly<Record<Union, string>>` typing | Gives consumers compile-time autocomplete on keys AND a TS error if they read a key that doesn't exist. `as const` widens to `Readonly` automatically; the explicit annotation makes the contract visible at the import site. |
| Empty `spacing` export, not omitted | Task 2.4 AC names `spacing` explicitly. Exporting `Readonly<Record<never, never>>` honours the surface contract with zero invented values. The inverse-drift test asserts `globals.css` carries no `--spacing-*` declarations, locking the empty mirror to the empty source. |
| Sync-test parses `:root` block, not `@theme inline` | The `:root` block carries literal hex / rem / box-shadow values. `@theme inline` uses `var(--x)` references which would require a resolution pass to compare. `--text-*` tokens are an exception — they're declared as literals directly inside `@theme inline`, so for those the test scans the whole CSS source. |
| Whitespace normalisation in sync test | CSS authors should be free to wrap long declarations (multi-stop box-shadows) across multiple lines for readability. Collapsing `\s+` → single space on both sides preserves the rule semantics while permitting reformatting. |
| Gradients exposed as TS literals despite being CSS `@utility` blocks (not custom properties in `@theme`) | The literal `linear-gradient(…)` strings ARE declared as `--gradient-brand-*` custom properties in `:root` (Task 2.3 §5.2 of HANDOFF). Mirroring them lets a future PDF template use them as `background-image` strings without re-typing the gradient stop math. |
| Brand-navy-tinted shadows preserved as literal `rgba(72,96,138,…)` | Same rgba components as in CSS. The sync test enforces byte equality (after whitespace norm). If a future designer re-tints the navy hex, both `globals.css` AND `design-tokens.ts` need updating in the same PR — the sync test fails otherwise. |
| Default shadcn semantic tokens (`--background`, `--primary`, …) NOT mirrored | They use `oklch()` colour spaces and are dark-mode-aware. PDF context never renders them; component code reads them via Tailwind utilities. Mirroring them as TS literals would be theatre. |

---

*End of HANDOFF. Next step: dispatch QA agent for verification per the hard constraint in the operator brief. On QA pass, developer commits → pushes → opens PR.*
