# QA-REPORT — E6.2 Task 2.4: typed TS mirror of design tokens

**Date:** 2026-05-28
**Branch:** `feat/E6.2-task-2.4-typed-tokens` (HEAD = `origin/main` @ `5ec1e58`, nothing committed yet — the three new files are still untracked)
**QA agent:** independent verification of dev handoff at
`docs/engineering/changes/2026-05-28-E6.2-task-2.4-typed-tokens/HANDOFF.md`
**Reviewer scope:** verify Task 2.4 acceptance criteria + regression set + drift-catch property + type-consumability. No source modifications retained.

---

## VERDICT

**PASS — ready to commit + push + open PR.**

Every acceptance criterion verified independently. The load-bearing drift-catch property holds in all three directions (TS-side change, CSS-side change, TS-side missing key). All regression gates green and match the dev's claimed numbers byte-for-byte. The typed mirror is consumable from a real `cva`-style call site with full autocomplete, narrowing, and rejection of bogus union members.

---

## AC table

| # | Acceptance criterion | Status | Command(s) run | Evidence |
|---|---|---|---|---|
| **AC1** | All 9 spec §5.1 colours mirrored at exact hex | **PASS** | sync test + manual byte-compare against `globals.css :root` lines 68–76 | All 9 declared in `colors` const (lines 84–94 of `design-tokens.ts`) match CSS exactly: navy `#48608a`, gold `#d9a428`, white `#ffffff`, light-blue `#a0aec1`, yellow `#eebd3c`, dark-blue `#324d61`, charcoal `#333232`, grey `#808897`, advisory `#6ec8c0` |
| **AC2** | Type-scale mirror covers all 12 size tokens | **PASS** | sync test (12 `type scale` cases) | `fontSizes` const covers title-{min,mid,max}, h1-{min,max}, h2-{min,max}, h3-{min,max}, body-{min,max}, caption — all match `--text-*` declarations in `@theme inline` of globals.css lines 199–210 |
| **AC3** | Font-family NOT redeclared in TS | **PASS** | `grep -nE "font\|Montserrat\|Source Sans\|next/font" design-tokens.ts` | Only matches are JSDoc comments and the `fontSizes` export name. No font-family literals, no `next/font/local` imports, no `--font-*` declarations |
| **AC4** | Shadow + radius + gradient tokens mirrored | **PASS** | sync test (3 shadows, 5 radii, 2 gradients = 10 cases, all pass) | `shadows` (brand-sm/md/lg), `radii` (brand-sm/md/lg/xl/2xl), `gradients` (brand-navy-gold, brand-navy-light-blue) all align with CSS source |
| **AC5** | `BrandSpacing = never` honours Task 2.3 "no spacing tokens" decision; sync test guards both directions | **PASS** | sync test `spacing` block (2 cases) + AC8 type consumer | `BrandSpacing = never`; `spacing = {} as const`; one test asserts the TS export is empty; second test asserts `globals.css :root` carries no `--spacing-*` declarations — both pass. Inverse-drift symmetry confirmed |
| **AC6** | Drift-catch works in all 3 directions | **PASS (3/3)** | See Drift-catch section below | Drift-A (TS change), Drift-B (CSS change), Drift-C (TS missing key) all triggered precise, named failures. Tree reverted to clean afterwards (`git status` confirms only the 3 new untracked files) |
| **AC7** | SC-7 preserved; vitest count = 2304 baseline + 34 new = 2338 | **PASS** | `npm test` | `Test Files 44 passed (44) / Tests 2338 passed (2338)` — matches dev claim exactly. No previously-passing test now fails |
| **AC8** | TypeScript types consumable from a real `cva`-style call site | **PASS** | Wrote `src/qa-token-consumer-check.ts` consumer; ran `npx tsc --noEmit` (clean), then added bogus union member (tsc errored TS2322), then removed scratch file. See AC8 section below | tsc accepts `colors`, `fontSizes`, `radii`, `shadows`, `gradients` as `VariantMap<Brand*, string>`. Bogus `BrandColour = 'brand-foo'` is rejected with `error TS2322: Type '"brand-foo"' is not assignable to type 'BrandColour'`. Scratch deleted; tsc still clean |
| **AC9** | No existing source file modified | **PASS** | `git diff origin/main` (empty) + `git diff origin/main -- website/src/app/globals.css` (empty) | Only untracked additions: `website/src/lib/design-tokens.ts`, `website/src/lib/design-tokens.test.ts`, `docs/engineering/changes/2026-05-28-E6.2-task-2.4-typed-tokens/HANDOFF.md` (+ this QA report) |
| **AC10** | Lint baseline preserved at 1615 | **PASS** | `npm run lint` | `✖ 1615 problems (17 errors, 1598 warnings)` — zero delta vs baseline; new TS file adds zero lint problems |

**AC pass rate: 10 / 10**

---

## Regression table

| # | Regression check | Command | Result |
|---|---|---|---|
| **R1** | Next.js production build clean | `npm run build` | **PASS** — 10 routes compile (mix of static + dynamic); proxy middleware present; no build errors |
| **R2** | Lint baseline unchanged at 1615 | `npm run lint` | **PASS** — `1615 problems (17 errors, 1598 warnings)`, zero delta |
| **R3** | TypeScript clean | `npx tsc --noEmit` | **PASS** — exit 0, no output |
| **R4** | `tests/` + `__tests__/` untouched (Task 2.11 sanctity) | `git diff origin/main -- 'tests/' '**/__tests__/'` | **PASS** — empty diff. The new colocated `src/lib/design-tokens.test.ts` is an addition, not a modification to existing test infra |
| **R5** | Storybook build clean | `npm run build-storybook` | **PASS** — built in 2.08s, no story errors. (Bundle-size warning on `iframe-*.js` is a pre-existing Storybook v9 advisory unrelated to this task) |
| **R6** | No new runtime / dev deps | `git diff origin/main -- website/package.json website/package-lock.json` | **PASS** — empty diff |

**Regression pass rate: 6 / 6**

---

## Drift-catch results (load-bearing)

The whole value of this task hinges on the sync test failing precisely and clearly when CSS and TS diverge. Verified in three independent directions; tree was reverted to clean state after each.

### Drift-A — TS-side change

- **Mutation:** edited `design-tokens.ts` so `colors['brand-navy']` became `#48608b` (one hex digit drift).
- **Command:** `npx vitest run src/lib/design-tokens.test.ts`
- **Result:** **FAIL as expected.** Test output:

```
FAIL  src/lib/design-tokens.test.ts > design-tokens.ts ↔ globals.css sync > colours > --brand-navy matches globals.css
AssertionError: expected '#48608a' to be '#48608b' // Object.is equality

Expected: "#48608b"
Received: "#48608a"

 Tests  1 failed | 33 passed (34)
```

- **Reverted:** yes; `git diff` empty after.

### Drift-B — CSS-side change

- **Mutation:** edited `website/src/app/globals.css` so `--brand-navy: #48608a;` became `--brand-navy: #48608b;`.
- **Command:** `npx vitest run src/lib/design-tokens.test.ts`
- **Result:** **FAIL as expected.** Test output:

```
Expected: "#48608a"
Received: "#48608b"

 Tests  1 failed | 33 passed (34)
```

(The expected/received swap vs Drift-A correctly reflects that the test compares CSS-read value to TS literal.)

- **Reverted:** yes; `git diff` empty after.

### Drift-C — TS-side missing key

- **Mutation:** commented out the `'brand-advisory': '#6ec8c0',` line in `colors` (CSS still declared the token).
- **Command:** `npx vitest run src/lib/design-tokens.test.ts`
- **Result:** **FAIL as expected**, and crucially through the coverage-guard test (not the per-token test, which is skipped when the entry is absent). This proves the inverse-drift guard works.

```
FAIL  src/lib/design-tokens.test.ts > design-tokens.ts ↔ globals.css sync > coverage guard > every --brand-<colour> declared in :root is mirrored in colors
AssertionError: globals.css declares brand colours not mirrored in design-tokens.ts: brand-advisory:
  expected [ 'brand-advisory' ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "brand-advisory",
+ ]

 Tests  1 failed | 32 passed (33)
```

The custom assertion message names the exact drifted token. Excellent diagnostics.

- **Reverted:** yes; `git diff` empty after.

**Drift-catch summary: 3 / 3 directions verified.** The test will catch CSS→TS, TS→CSS, and TS-removal drift independently. The dev's claim is true and the sync-test design is sound.

---

## AC8 — type consumability (full evidence)

### Scratch consumer file (written to `website/src/qa-token-consumer-check.ts`, since deleted)

```ts
/**
 * QA scratch (E6.2 Task 2.4 verification) — TEMPORARY, to be deleted.
 * Verifies BrandColour / BrandRadius / BrandShadow union types from
 * design-tokens.ts are consumable as cva-style variant keys.
 */

import {
  colors,
  fontSizes,
  gradients,
  radii,
  shadows,
  spacing,
  type BrandColour,
  type BrandGradient,
  type BrandRadius,
  type BrandShadow,
  type BrandSpacing,
  type BrandTextSize,
} from '@/lib/design-tokens';

// 1. Literal-narrowed record access
const navy: string = colors['brand-navy'];
const captionSize: string = fontSizes.caption;
const cardRadius: string = radii['brand-lg'];
const mdShadow: string = shadows['brand-md'];
const navyGold: string = gradients['brand-navy-gold'];

// 2. cva-style consumer — simulates Task 2.5/2.6 variant author
type VariantMap<K extends string, V> = { [k in K]: V };

type ButtonVariants = {
  background: VariantMap<BrandColour, string>;
  radius: VariantMap<BrandRadius, string>;
  shadow: VariantMap<BrandShadow, string>;
  size: VariantMap<BrandTextSize, string>;
  gradient: VariantMap<BrandGradient, string>;
};

const buttonVariants: ButtonVariants = {
  background: colors,
  radius: radii,
  shadow: shadows,
  size: fontSizes,
  gradient: gradients,
};

// 3. BrandSpacing = never assignment compatibility
const emptySpacing: Readonly<Record<BrandSpacing, string>> = spacing;

export { /* ... */ };
```

### tsc results

| Scenario | Command | Outcome |
|---|---|---|
| Positive — happy-path consumer compiles | `npx tsc --noEmit` (with scratch present) | **PASS** — exit 0, no output |
| Negative — bogus union member rejected | Added `const wrongUnion: BrandColour = 'brand-foo';` then re-ran tsc | **FAIL as expected** — `error TS2322: Type '"brand-foo"' is not assignable to type 'BrandColour'.` |
| Final clean — scratch deleted | `rm src/qa-token-consumer-check.ts && npx tsc --noEmit` | **PASS** — exit 0, no output |

The types are consumable AND the union narrowing is enforced at the call site. This is the actual user-facing value of Task 2.4: future PDF templates / `cva` authors get autocomplete on token keys and a build break if they typo a variant name.

---

## Notes (non-blocking)

1. **Coverage guard scope is colour-only today.** The `coverage guard` describe block only iterates `--brand-<colour>` declarations. A future Task 2.6 that adds, say, an extra shadow tier (`--shadow-brand-xl`) in CSS without mirroring it in TS would slip past today's sync test (Drift-C variant for radii/shadows/gradients). Not a Task 2.4 issue — the AC was met — but the dev / next-task agent may want to broaden the coverage guard when more token families enter the mirror. Filing as a non-blocking observation.
2. **Storybook chunk-size warning** is pre-existing (Storybook 9 + axe-core landed in Task 2.1 with the same advisory). Unrelated to this task.
3. **`design-tokens.ts` filename vs spec wording.** Spec / impl-plan says `lib/tokens.ts`; dev chose `lib/design-tokens.ts` to avoid future collisions with "auth tokens" / "session tokens". The HANDOFF §2 rationale is sound and the AC wording ("typed re-export of Tailwind tokens") is satisfied regardless of filename. Re-export shim from `lib/tokens.ts` can be added later if needed — operator's call.
4. **Documentation hygiene.** Excellent JSDoc at the top of `design-tokens.ts` (sync contract, why-not-auto-generate, deliberate omissions) and on every exported const. Matches the quality bar set by Task 2.3.

---

## Sign-off recommendation

**Recommend the developer commit + push + open PR for operator merge.** All 10 ACs pass; all 6 regression gates green; drift-catch property is load-bearing-and-real in three directions; types compile clean and reject bogus inputs. No existing source file was modified. Lint and test counts match the dev's claims byte-for-byte.

Operator (Tracy) merges the PR; Task 2.5 (Wordmark + Lockup + Icon barrel) is the natural next consumer of `BrandColour` + `BrandTextSize` and will exercise the autocomplete property at a real call site.

---

*End of QA-REPORT. Tree state at sign-off: untracked `design-tokens.ts`, `design-tokens.test.ts`, `HANDOFF.md`, and this `QA-REPORT.md`; zero modifications to tracked files.*
