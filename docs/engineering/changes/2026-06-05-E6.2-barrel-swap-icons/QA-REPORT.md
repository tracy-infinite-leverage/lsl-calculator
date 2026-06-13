# QA Report — PR #153 (E6.2+ barrel-swap: Lucide → OQ-2 sprite)

**Date:** 2026-06-07
**QA agent:** qa
**PR:** https://github.com/tracy-infinite-leverage/lsl-calculator/pull/153
**Branch:** `feat/E6.2+-barrel-swap-icons-orch` → `main`
**Verdict:** **PASS — clear to merge.**

---

## Executive summary

PR #153 swaps the production icon set from `lucide-react` to a local sprite-based implementation rendered through the existing `@/components/brand/Icon` barrel. All 14 named CI checks are green, all local checks reproduce, and every checklist item from the dispatch is verified. The single coordination gap (`Minus` icon) is honestly disclosed, inline-documented in `eslint.config.mjs`, and mechanically contained by the preserved `ui/**` exemption.

This is a clean, well-tested, well-documented load-bearing change. Recommend merge after the operator confirms the Vercel preview renders icons across the targeted surfaces.

---

## Checklist results

### 1. `Minus` gap + `ui/**` ESLint exemption — PASS

- `grep -rn "from ['\"]lucide-react['\"]" website/src/` returns **6 matches, all in `website/src/components/ui/**`**:
  - `ui/accordion.tsx` — `ChevronDown`
  - `ui/checkbox.tsx` — `Check, Minus` (Minus is the gap)
  - `ui/dialog.tsx` — `X`
  - `ui/dropdown-menu.tsx` — `Check, ChevronRight, Circle`
  - `ui/radio-group.tsx` — `Circle`
  - `ui/select.tsx` — `Check, ChevronDown`
- A 7th match exists in `brand.test.ts` line 236 as a **string literal** inside the lint-walker regex (not an actual import) — correct.
- `Icon.tsx` has **zero** `lucide-react` imports (verified).
- `eslint.config.mjs` lines 25–72 document the exemption inline with full rationale: (a) shadcn upgrade-path lock-in per spec §7.2, (b) `Minus` is not in the 42-icon OQ-2 inventory and is load-bearing for the checkbox indeterminate state.
- The `ui/**` allow-list inside `brand.test.ts` (lines 205–212) matches the actual file set exactly.

### 2. Sprite asset correctness — PASS

- `/website/public/icons/sprite.svg` contains exactly **126** `<symbol>` defs (42 names × 3 states: `default`, `active`, `disabled`).
- All symbol ids follow the `<state>--<kebab-name>` pattern (e.g. `default--users`, `active--bell`, `disabled--calculator`).
- All 42 sprite names map bijectively to the 42 `createIcon('...')` invocations in `Icon.tsx` (verified via JS regex matcher across newlines).
- **Build is idempotent**: ran `node scripts/build-icon-sprite.mjs` against the committed sprite — byte-for-byte identical output (50.0 KB, 126 symbols).
- `prebuild` + `prestorybook` in `package.json` both chain `scripts/build-icon-sprite.mjs` after `sync-brand-assets.mjs` — sprite stays honest on every build.

### 3. `Icon.tsx` rewrite — render correctness — PASS

- 42 named exports verified (`grep -c "^export const "` returned 42).
- Each export goes through the `createIcon(spriteName, displayName)` factory which renders `<svg viewBox="0 0 24 24" fill="none"><use href={`${SPRITE_HREF}#${variant}--${spriteName}`} /></svg>`.
- `LslIconProps` interface exported with documented shape: `variant?: 'default' | 'active' | 'disabled'`, plus all `React.SVGAttributes<SVGSVGElement>` minus `children` (and notably without `size` / `color` / `strokeWidth` which would have no runtime effect on a sprite).
- `LucideProps` is exported as a deprecated alias of `LslIconProps` — the burn-in shim documented for one release.
- A11y default works as specified: when neither `aria-label` nor explicit `aria-hidden` is supplied, the wrapper sets `aria-hidden="true"` (decorative). With `aria-label` set, `aria-hidden` is omitted entirely (no masking from assistive tech).
- Spot-checked render paths for `Users`, `Calculator`, `Trash2` via the brand-test render assertions — all produce the expected `<use href="/icons/sprite.svg#default--<name>">` markup.

### 4. `brand.test.ts` snapshot completeness — PASS

Ran locally: `npx vitest run src/components/brand/brand.test.ts` → **9/9 tests pass**.

Coverage verified:
- `exports exactly the 42 components in the OQ-2 production inventory` — uses `Object.keys(Icon)` filtered to objects, equals the `OQ2_ICONS` inventory.
- `every default-variant icon renders <use href=…>` — iterates all 42 `OQ2_ICONS` pairs; each renders the expected sprite href + `aria-hidden="true"` + `viewBox="0 0 24 24"`.
- `active variant routes to active-- sprite id` — spot-checks 3 icons (`Bell`, `Users`, `ArrowUpDown`).
- `disabled variant routes to disabled-- sprite id` — spot-checks 3 icons (`Settings`, `Calculator`, `Lock`).
- `passes through className and aria-label overrides` — exists (`Trash2` test).
- `sprite file contains all 126 expected symbol ids` — iterates 42 × 3 = 126 combinations against the committed sprite file.

### 5. `citation-block.test.ts` snapshot review — PASS

Ran locally: `npx vitest run src/components/lsl/citation-block.test.ts` → **5/5 tests pass**.

Diff against `origin/main` is +4 / -4 across the 4 inline snapshots:
- Old: `<svg ... lucide lucide-book-open ...><path d="..." /><path d="..." /></svg>` (Lucide path-based render)
- New: `<svg class="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true"><use href="/icons/sprite.svg#default--book-open"></use></svg>` (sprite-based render)

Verified:
- All citation **text** content (`section`, `rule`, `pdfPage`, `note`, dedup, source-order rendering, "renders nothing when empty") is byte-identical to the previous snapshot.
- `<svg>` wrapper attributes (size classes, `text-primary`, `mt-0.5 shrink-0`, viewBox 24×24, `aria-hidden="true"`) are preserved.
- The `citation-block.tsx` source now imports `BookOpen` from `@/components/brand/Icon` (was previously from `lucide-react`).
- The test file's documentation block (lines 22–28) explicitly states snapshot amendments are part of the same PR as the component change — this snapshot update is intentional and scoped.

### 6. Codemod surface — PASS

- `grep -rn "LucideProps" website/src/` returns matches only in **comments** in `Icon.tsx` and `brand.test.ts`, plus the **deprecated alias export** at `Icon.tsx:116`. No consumer file imports `LucideProps`.
- `grep -rn "LslIconProps" website/src/{ui/spinner.tsx,app-shell/sidebar-routes.ts,empty-states/EmptyState.tsx}` returns matches in all 3 codemodded sites.
- No other consumer file changed — most consumers import named values (`Calculator`, `BookOpen`, etc.) which the codemod doesn't touch. The 28 non-codemod consumers are out of scope for this PR.

### 7. Bundle size + sprite serving — PASS

- Sprite is at `website/public/icons/sprite.svg` (50 KB on disk) — served as a static asset by Next 16 at `/icons/sprite.svg`, not bundled into JS chunks.
- `audit-bundle.mjs` does not reference the sprite — it scans JS bundle origins / dev-only imports, which are correctly orthogonal to the public-tree asset.
- PR body claims **1813.4 → 1802.5 KB (−10.9 KB)**. CI's audit-bundle gate passed; the dispatch's ≤ +50 KB budget is met with significant headroom. Net decrease comes from dropping Lucide tree-shaken paths in favour of a single ~120-byte wrapper per icon component.

### 8. SSR + 4-browser Playwright — PASS

CI's `Playwright (chromium · webkit · firefox · mobile-chrome)` check is **green**. The `<use href="/icons/sprite.svg#…">` semantics under Next 16 SSR are therefore empirically validated — the sprite href is an absolute root-relative URL that resolves identically server-side and client-side. The SSR risk called out in the dispatch is resolved.

### 9. `lucide-react` package retention — PASS

`package.json` still lists `"lucide-react": "^1.16.0"` — burn-in posture preserved per the dispatch. The PR body explicitly calls out the one-release deferral and the rollback safety it provides (a single named export can be reverted to Lucide while a redrawn glyph is commissioned).

### 10. Carve-out compliance — PASS

`git diff --stat origin/main...HEAD` against all carve-out paths returns **zero diff**:
- `website/tests/` — clean
- `website/e2e/` — clean
- `website/src/__tests__/` — clean
- `website/src/lib/lsl/engine/` — clean
- `website/src/lib/lsl/states/` — clean
- `website/supabase/` — clean
- `docs/brand/icons/{default,active,disabled}/` — clean (PR #151 source SVGs immutable)
- `docs/brand/icon-candidates/` — clean
- `website/src/lib/lsl/mapping/detect/` — clean
- `.specify/features/005-lsl-platform/sub-specs/*.md` — clean

---

## CI status (cross-checked via `gh pr view 153`)

| Check | Status |
|---|---|
| TypeScript · Vitest · Build | PASS |
| Lighthouse · accessibility ≥ 95 on `/` (non-blocking) | PASS |
| CSP header smoke test (Task 2.10b) | PASS |
| State suite · nsw / vic / qld / wa / sa / act / engine | PASS (7 suites) |
| Cross-state regression (engine-touching PRs) | PASS |
| **Playwright (chromium · webkit · firefox · mobile-chrome)** | **PASS** |
| Test-sanctity guard (spec §5.3 + SC-7) | PASS |
| Vercel Preview Comments | PASS |

14/14 named checks green. PR is in `MERGEABLE` state with base `main`.

---

## Local verification reproduced

- `npx vitest run src/components/brand/brand.test.ts src/components/lsl/citation-block.test.ts` → **15/15 pass** (103 ms).
- `node scripts/build-icon-sprite.mjs` run twice produces byte-for-byte identical output (50 KB, 126 symbols). Build is deterministic.
- `grep` audit of `lucide-react` imports in `src/` confirms the 6-file `ui/**` allow-list matches both the ESLint exemption AND the in-test allowed list — drift-resistant.

---

## Risk assessment

- **Behaviour change:** Every icon rendered on every page now points at a different SVG asset. Visual regression risk is non-trivial but is the explicit purpose of the PR — Storybook + Playwright + Vercel preview are the verification surfaces.
- **`Minus` gap:** Indeterminate-state checkbox depends on `lucide-react` still being installed. Removing `lucide-react` from `package.json` would break checkbox indeterminate rendering until a `Minus` stamp is commissioned. The burn-in posture preserves this for one release — operator should follow up with a designer ticket before the eventual `lucide-react` drop.
- **No new test categories needed:** the existing brand-render contract + citation byte-for-byte snapshot fully cover the swap surface at the unit level. Visual regression (which a unit test cannot catch) is operator's job at the Vercel preview stage — the dispatch explicitly lists this as part of the human test plan.

---

## Recommendations to operator

1. **Merge after Vercel preview eyeball** — surfaces to scan: public calculator landing, bulk-mode preview, single-mode form, ResultPanel, citation block under a result, top-nav, sidebar, breadcrumbs, empty-state pages.
2. **File a designer ticket** for the `Minus` icon stamp so the `ui/**` ESLint exemption can be tightened to "shadcn upgrade-path only" in a v1.1 PR.
3. **Calendar the burn-in drop**: after ~7 days of clean production, the follow-up PR removes `lucide-react` from `package.json`, drops the deprecated `LucideProps` alias, and codemods the remaining 5 shadcn primitives (excluding `checkbox.tsx` until the Minus stamp ships).

---

**QA sign-off:** PASS. Recommend merge.
