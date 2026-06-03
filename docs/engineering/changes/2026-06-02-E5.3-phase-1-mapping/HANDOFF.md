# HANDOFF — E5.3 Phase 1 — Pay-Code Mapping Data Layer

**Branch (git):** `feat/E5.3-phase-1-mapping-schema`
**Supabase branch:** `e53-phase-1-mapping-schema` — project ref `oahgcmqlqdfeqfibsfej` (parent `woxtujkxatosbirikxtq`) — **DO NOT delete; operator may want to inspect**
**Status:** Phase 1 complete. Phase 0 fixtures + Phase 1 data layer (6 of 7 planned migrations applied, 1 deferred) landed across 8 commits. 4 new tables + 1 column live on the Supabase branch with RLS + advisors clean. Cross-tenant RLS test suite added. TypeScript types regenerated.

## How this dispatch ran

Phase 1 took **three sessions** to land:

1. **First background dev agent** (killed mid-T1.4) pushed T0.1–T1.3 across 4 commits on `feat/E5.3-phase-1-mapping-schema`. Application of T1.4 to the Supabase branch had started; the SQL file existed in the worktree but was never committed. State preserved on origin at `1f497ca`.
2. **Second background dev agent** stalled (watchdog 600s no progress) after re-applying T1.4 SQL to the Supabase branch. The seed migration was applied (v`20260602045645`) but advisor verification + commit + push never happened.
3. **Operator drove the rest in-session** (T1.4 close-out + T1.6 + T1.7 + T1.8 + tasks.md ticks + this HANDOFF). T1.5 deferred to E5.4 Phase 1.

The Phase 1 work is complete despite the agent instability. Operator's lesson: when background dev dispatches show instability on a particular task, drive directly via MCP + Bash rather than re-dispatching repeatedly.

## What's done

### Phase 0 — Pre-work + fixture assembly

| Task | Status | Commit |
|---|---|---|
| T0.1 — Confirm E5.2 schema final | ✅ | (verified — all 7 E5.2 Phase 1 migrations live in prod) |
| T0.2 — Stage Virtus fixtures | ✅ | `273ec2d` |
| T0.3 — Assemble 10-fixture real-world set | ✅ | `273ec2d` |
| T0.4 — Paired-fixture test harness skeleton | ✅ | `273ec2d` |

### Phase 1 — Data layer + seeds

| Task | Status | Commit | Supabase version |
|---|---|---|---|
| T1.1 — `pay_code_mappings` + `pay_code_mapping_versions` | ✅ | `9b41b78` | `20260602021051` |
| T1.2 — `pay_code_aliases` + 71-row seed | ✅ | `bb74d78` | `20260602021306` |
| T1.3 — `value_normalisation_aliases` + `_versions` | ✅ | `1f497ca` | `20260602021511` |
| T1.4 — Seed `value_normalisation_aliases` (66 rows) | ✅ | `be8b312` | `20260602045645` |
| **T1.5 — Extend `imports` with wizard-state columns** | **⏸ DEFERRED** | — | — |
| T1.6 — `organisations.llm_assist_enabled` opt-out | ✅ | `59a0692` | `orgs_llm_assist_enabled` |
| T1.7 — Regenerate TypeScript types | ✅ | `6dee75c` | — |
| T1.8 — Cross-tenant RLS test suite | ✅ | `5a353c8` | — |

### Cumulative Supabase advisor outcome (E5.3 contribution)

- **Security:** Zero new lints. Only pre-existing E5.1/E5.2 lints unchanged (3 total — `auth_audit_log` no-policy INFO; `handle_new_user` SECURITY DEFINER WARN ×2).
- **Performance:** Many INFO-level "unused index" lints on newly-created tables (expected; will clear once traffic builds — same accepted pattern as E5.2).

## T1.5 deferral — why and what

**Why deferred:** T1.5 adds 5 columns (`wizard_state`, `sheet_name`, `file_relationship`, `llm_cost_estimated`, `llm_cost_actual`) to the `imports` table. The `imports` table is owned by E5.4 and does not yet exist on the Supabase branch. E5.3 stubbing the table would mean creating a half-baked version that E5.4 would have to migrate; cleaner to have E5.4 Phase 1 create `imports` WITH these columns from the start.

**What this blocks:** Nothing in Phase 2. The E5.3 auto-detection layer (Phase 2) classifies headers and pay-code values; it doesn't need to persist wizard state to `imports` until the wizard UI lands in Phase 3+.

**Action for E5.4 dev:** When E5.4 Phase 1 creates the `imports` table, include the 5 T1.5 columns in the initial schema definition. Spec text: `pay-period-ingestion.md` §4.1 (the columns are still listed there) + `pay-code-mapping.md` §4 (the column-level acceptance criteria AC-MAP-13 + AC-MAP-14 reference them). Mark T1.5 done in `pay-code-mapping-tasks.md` after E5.4 Phase 1 lands the table.

## What's next (Phase 2 brief for follow-up dispatch)

Per the impl-plan: **Phase 2 — Auto-detection Pass 1 (deterministic; blocks E5.4 ingestion wire-up).** Approx tasks T2.1–T2.8 covering:
- Header-name pattern matcher (against `pay_code_aliases.pattern` rows)
- Value normalisation lookup (against `value_normalisation_aliases.surface_form`)
- File-shape detection (`.csv` vs `.xlsx` vs multi-file relational drop)
- Wizard scaffolding for unresolved/ambiguous codes (no LLM in Pass 1 — that's Phase 3)
- Calibration against the 10-fixture set + Virtus fixtures (target ≥ 90% accuracy AC-MAP-1)

Phase 2 should NOT start until:
1. This PR (Phase 1) merges to main
2. Operator applies the 4 new E5.3 migrations to production `woxtujkxatosbirikxtq` via MCP (matches the E5.2 precedent — see PR #105 / PR #110 close-out)

## Files modified or created

```
website/supabase/migrations/
  20260602020500_create_pay_code_mappings.sql        (T1.1)
  20260602020600_create_pay_code_aliases.sql         (T1.2)
  20260602020700_create_value_normalisation_aliases.sql (T1.3)
  20260602045400_seed_value_normalisation_aliases.sql   (T1.4)
  20260602050000_orgs_llm_assist_enabled.sql         (T1.6)

website/src/lib/db/
  types.ts                                           (T1.7 — NEW; 756 lines)

website/src/__tests__/db-rls/
  pay-code-mapping.test.ts                           (T1.8 — NEW)

tests/fixtures/pay-code-mapping/
  virtus/                                            (T0.2)
  realworld/                                         (T0.3)

tests/lsl/mapping/
  llm-paired.test.ts                                 (T0.4 — skeleton)

.specify/features/005-lsl-platform/sub-specs/
  pay-code-mapping-tasks.md                          (ticked T0.1–T1.4, T1.6–T1.8; T1.5 marked DEFERRED)

docs/engineering/changes/2026-06-02-E5.3-phase-1-mapping/
  HANDOFF.md                                         (this file)
```

## Production-apply checklist (operator-gated)

After this PR merges to `main`:

1. Apply each of the 5 new migrations to production project `woxtujkxatosbirikxtq` via MCP, in version order:
   - `create_pay_code_mappings`
   - `create_pay_code_aliases`
   - `create_value_normalisation_aliases`
   - `seed_value_normalisation_aliases`
   - `orgs_llm_assist_enabled`
2. After each: `get_advisors(security)` and `get_advisors(performance)`. Expected outcome matches the branch validation above (0 new security lints; INFO-level perf lints accepted).
3. CI runs against the merge commit will then exercise the T1.8 cross-tenant RLS suite against production. **Until migrations are applied to prod, the RLS suite will fail in CI** — same convention as E5.2 PR #105.

## Open questions / followups

- **T1.5 dependency for E5.4.** E5.4 Phase 1 dev must include the 5 T1.5 columns in the initial `imports` table schema. PM should flag this in the E5.4 dispatch brief.
- **LAUNCH-GUARD update (E5.3 T3.8 territory).** OQ-MAP-5 reinstates `ANTHROPIC_API_KEY` as a soft-required production env var. The 2026-05-23 LAUNCH-GUARD relaxation said the key was no longer a hard gate (PDF removal eliminated the public-calc dependency). E5.3 Phase 3 (LLM-assisted mapping) re-introduces the dependency. Operator should review the LAUNCH-GUARD doc before E5.3 Phase 3 ships.
- **Test infra path convention.** Spec said `tests/db/rls/pay-code-mapping.test.ts`; pragmatic landed location is `website/src/__tests__/db-rls/pay-code-mapping.test.ts` (matches existing `website/src/__tests__/auth/_helpers.ts` infra). PM may want to update the spec path or leave as-is.

---

*End of HANDOFF. Phase 1 ready for review + merge + production migration apply. Phase 2 (auto-detection Pass 1) ready for follow-up dispatch after merge.*
