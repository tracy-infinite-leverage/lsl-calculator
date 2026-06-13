# QA Report — PR #154: OQ-2 Minus icon (43rd icon)

**Branch:** `design/oq-2-minus-icon-orch`
**Base:** `main`
**Commit reviewed:** `ec0f814`
**Reviewer:** QA agent
**Date:** 2026-06-09
**Verdict:** PASS (with one nit for follow-up)

---

## Summary

PR #154 closes the indeterminate-state inventory gap left open by PR #151 (production icon set) and PR #153 (barrel swap). It adds a `Minus` icon as the 43rd entry in the OQ-2 set across all three states (default, active, disabled), regenerates the sprite atlas, and updates the production inventory document. The dev correctly reverted a prior in-branch modification of `Icon.tsx` and `brand.test.ts` so this PR is strictly design-only — barrel/test contract bump and the `checkbox.tsx` migration are deferred to the scheduled burn-in cleanup PR (2026-06-15). CI 15/15 green. All carve-outs hold. Recommend merge.

---

## Checklist results

### 1. SVG quality bar (3 files) — PASS

All 3 SVGs read clean:

| File | Bytes | Disc fill | Stroke colour | Wrapper |
|---|---|---|---|---|
| `default/minus.svg` | 289 | `#48608a` navy | `#ffffff` white | none |
| `active/minus.svg` | 289 | `#d9a428` gold | `#48608a` navy | none |
| `disabled/minus.svg` | 316 | `#a0aec1` grey-blue | `#ffffff` white | `<g opacity="0.6">` |

All three:
- 24×24 viewBox with `width="24" height="24" fill="none"`
- `aria-hidden="true"` set
- No `<defs>`, no `<g transform>`
- Inline hex colours (no CSS vars / no symbolic refs)
- Disc geometry `<circle cx="12" cy="12" r="11" />` — identical to all 42 sibling icons
- Glyph: `<path d="M8 12 H16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />` — 8-unit horizontal centred stroke
- Sub-1 KB ✓ (289 / 289 / 316 bytes)

### 2. Visual congruence with the 42 existing icons — PASS (with one nit)

Spot-checked `plus.svg`, `check.svg`, `chevron-down.svg`, `x.svg`:
- 2px stroke width — matches ✓
- Round caps + joins — matches ✓
- Navy disc + white stroke default — matches ✓
- Gold disc + navy stroke active — matches ✓
- `<g opacity="0.6">` wrap on disabled — matches ✓

**Nit (non-blocking):** Minus uses an **8-unit horizontal stroke** (`M8 12 H16`) while `Plus`'s horizontal arm spans **10 units** (`x1="7"` → `x2="17"`). For semantic-pair symmetry (Plus / Minus as visual inverses) consider widening Minus to `M7 12 H17` in a follow-up. That said, `x.svg` uses 8→16 diagonal arms, so an 8-unit Minus is consistent with that established sub-pattern. Either choice is defensible; the dev's call is reasonable. Flagging for designer awareness, not blocking.

### 3. Sprite regeneration — PASS

- `grep -c '<symbol'` returns **129** ✓ (was 126 pre-PR; +3 expected)
- `default--minus`, `active--minus`, `disabled--minus` all present as symbol ids ✓
- Sprite rebuild idempotency confirmed: ran `node website/scripts/build-icon-sprite.mjs` and `diff` reported byte-for-byte stability. Build script reports "43 icons × 3 states = 129 symbols" matching the inventory header.

### 4. Inventory update scope — PASS

Diff in `production-inventory.md` is exactly two changes:
1. Header line: `42 icons` → `43 icons`, `126 SVGs` → `129 SVGs`
2. One row inserted under Editing/IO between `plus.svg` and `x.svg`:

   ```
   | `minus.svg` | `Minus` | Editing / IO | Indeterminate / subtract / collapse — tri-state checkbox dash | No — pure white stroke on navy disc (matches `plus.svg` restraint; subtract is the inverse semantic) | `components/ui/checkbox.tsx` (indeterminate state — see "Cross-PR coordination" below; consumer migration is mechanical and lands in the burn-in cleanup PR) |
   ```

Row schema matches sibling rows. Consumer column correctly forward-references the deferred `checkbox.tsx` migration. Gold-stroke usage column matches the documented direction §5 restraint pattern.

### 5. Carve-outs — PASS

`git diff --name-only origin/main..design/oq-2-minus-icon-orch` returned exactly 5 files:

1. `docs/brand/icons/active/minus.svg`
2. `docs/brand/icons/default/minus.svg`
3. `docs/brand/icons/disabled/minus.svg`
4. `docs/brand/icons/production-inventory.md`
5. `website/public/icons/sprite.svg`

Per-file diff confirmation on the carve-out list (all returned 0 diff lines):

- `website/src/components/brand/Icon.tsx` — 0 ✓ (dev's revert held)
- `website/src/components/brand/brand.test.ts` — 0 ✓ (dev's revert held)
- `website/src/components/ui/checkbox.tsx` — 0 ✓ (migration deferred)
- `website/eslint.config.mjs` — 0 ✓ (exemption removal deferred)
- `website/package.json` — 0 ✓ (lucide removal deferred)

`git diff --stat origin/main..design/oq-2-minus-icon-orch -- website/src/ website/tests/ website/e2e/` returned **empty** — no code-side drift.

### 6. brand.test.ts still passes against the new sprite — PASS

Read `brand.test.ts` end-to-end:
- The `OQ2_ICONS` array (lines 117–160) has **42 entries** — `Minus` is NOT added (correct for this PR's scope).
- The "exactly the 42 components in the OQ-2 production inventory" assertion (line 172) iterates over `OQ2_ICONS` and matches against the barrel's `Icon.tsx` exports. Since `Icon.tsx` was reverted and still exports the original 42 names, this still passes.
- The "sprite file ... contains all 126 expected symbol ids" assertion (line 327) iterates over `OQ2_ICONS` × 3 states and checks for symbol-id presence. There is **no exclusivity check** (`126` only appears in the test description string, never as a numeric assertion). 129 symbols in the sprite is therefore compatible.
- Ran `npx vitest run src/components/brand/brand.test.ts` locally: **10/10 tests pass** in 136 ms.

**Note for the burn-in cleanup PR:** the test description string at line 327 ("contains all 126 expected symbol ids") is now stale literature. When that PR lands and adds `['Minus', 'minus']` to `OQ2_ICONS`, the description should also bump to "129 expected symbol ids". Already correctly scoped out of this PR.

---

## Risk assessment

- **Code-path risk:** Zero. PR touches docs and a build artifact only. No runtime code change.
- **Visual regression risk:** Low. New symbol is only referenced by the future `checkbox.tsx` migration — not consumed today. The existing 126 symbol ids are unchanged byte-for-byte (verified via idempotent rebuild).
- **Test regression risk:** Zero. Local run confirms all 10 brand contract tests pass.
- **Inventory drift risk:** Resolved. Header counts updated, row added in the correct section.
- **Follow-up dependency:** The burn-in cleanup PR (2026-06-15) must bump `OQ2_ICONS` to include Minus, migrate `checkbox.tsx`, drop the `ui/**` lucide-react ESLint exemption, and remove `lucide-react` from `package.json`. This PR is a clean prerequisite.

---

## Recommendation

**PASS — ready to merge.**

Two optional follow-ups (neither blocks):

1. Designer eye on whether Minus's 8-unit stroke should widen to 10 units to match Plus's horizontal arm length for cleaner semantic-pair symmetry. (Not required; 8-unit matches the X-icon sub-pattern.)
2. When the burn-in cleanup PR lands, also bump the line-327 test description string to "129" to match the new inventory count.

Worktree clean. Branch on track. CI 15/15 green on `ec0f814`. No code, tests, or PRs were modified by QA — read-only review.
