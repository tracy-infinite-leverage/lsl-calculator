# Tasks: Payroll Knowledge Assessment v0.5 (E8)

**Version**: 0.1
**Status**: Draft — for operator review
**Date**: 2026-06-10
**Owner**: Developer agent
**Spec**: `.specify/features/008-knowledge-assessment/spec.md` v0.5 SPEC LOCKED
**Impl plan**: `.specify/features/008-knowledge-assessment/impl-plan.md`
**Branch**: `008-knowledge-assessment`

> Phases are sequential by default. Tasks within a phase may parallelise where marked `[P]`. Estimates: **S** = ≤ 2 hours; **M** = ≤ 1 day; **L** = ≤ 3 days; **XL** = > 3 days. Every task that implements a locked OQ resolution cites the OQ inline.

---

## Phase 0 — Pre-implementation sub-spec resolution (dev findings)

**Goal**: resolve the three dev findings raised in impl-plan §9 before any code is written.

### T0.1 Draft citation text for all 35 questions — **M**
- Dev pre-fills a one-line citation per question (Fair Work Act / SGR / state Payroll Tax Act / NES / LSL Acts / ATO STP guidance, as appropriate) based on the question content in `question-bank.md`.
- Format: `<Source> — <Section/topic>` plus an optional URL (deep-link to the authority's source page where available).
- Deliverable: an updated `question-bank.md` appendix or sidecar file (`citations.md`) listing question → citation text + URL pairs.
- Implements: spec §4 "every wrong answer surfaces a one-line citation" + OQ-KA-4. Resolves D01.
- Depends on: nothing.

### T0.2 Operator review + lock of citation copy — **S** (operator time, not dev)
- Operator reviews dev draft from T0.1; edits any wording that doesn't match their voice; locks the file.
- Deliverable: signed-off citations file ready for the seed migration.
- Resolves: D01.
- Depends on: T0.1.

### T0.3 Operator confirms email-marketer vendor (Brevo vs Resend) — **S** (operator time) `[P]`
- Operator confirms which vendor the email-marketer agent will use for the v0.5 capture pool. Decision documented in `agents/email-marketer/context/persona.md` (this update is by the email-marketer agent, not dev).
- Resolves: D02.
- Depends on: nothing.

### T0.4 Operator confirms currency-pause fallback contract — **S** (operator time) `[P]`
- Operator confirms the graceful-shrink behaviour from impl-plan §1.4: if Q7 is currency-paused on 1 July, the Super category shows 5 questions on the public surface (not 6 with a phantom missing question). Alternative (full shutdown of the entire assessment) is rejected by default unless operator objects.
- Resolves: R1 mitigation.
- Depends on: nothing.

**Phase 0 gate**: T0.1 + T0.2 complete; T0.3 + T0.4 confirmed. The citations file is the launch-gate artifact; no Phase 1 work starts before it is signed off.

---

## Phase 1 — Supabase migrations + seed

**Goal**: all six tables exist with RLS; 35 questions and their v1 versions seeded; smoke-test reads pass.

### T1.1 Create `assessment_categories` migration — **S**
- File: `website/supabase/migrations/20260611_assessment_categories.sql`.
- Six rows seeded matching `question-bank.md` (id / display_name / display_order / expected_question_count).
- RLS: anonymous SELECT permitted; no writes from app (table is system-managed via migrations).
- Implements: impl-plan §2.1.1.
- Depends on: Phase 0 closed.

### T1.2 Create `assessment_questions` + `assessment_question_versions` migration — **M**
- File: `website/supabase/migrations/20260611_assessment_questions.sql` (covers both tables — they're an inseparable pair).
- Columns per impl-plan §2.1.2 + §2.1.3.
- RLS: anonymous SELECT on both; admin-only INSERT/UPDATE via service-role.
- Trigger on `assessment_question_versions` that RAISES on UPDATE/DELETE (append-only enforcement).
- View `assessment_questions_with_review_status` exposing the `currency_review_due` computed column.
- Implements: OQ-KA-7, OQ-KA-8 (versioning + in-flight pin), OQ-KA-5 (currency_year field).
- Depends on: T1.1.

### T1.3 Create `assessment_attempts` + `assessment_responses` migration — **M**
- File: `website/supabase/migrations/20260611_assessment_attempts.sql` (covers both — they're tightly coupled).
- Columns per impl-plan §2.1.4 + §2.1.5.
- Unique constraint `(attempt_id, question_id)` on `assessment_responses` (no back-tracking — spec §3).
- RLS: anonymous INSERT permitted; UPDATE scoped via HMAC-signed cookie claim verified inside Server Actions; no anonymous SELECT.
- Indexes: `(email)` on `assessment_attempts` (re-take lookup), `(attempt_id)` on `assessment_responses`.
- Implements: OQ-KA-3 (email captured at end), OQ-KA-6 (re-takes unrestricted, no SELECT means no enumeration), spec §3 no-back-tracking.
- Depends on: T1.2.

### T1.4 Create `assessment_audit_log` migration — **S** `[P]`
- File: `website/supabase/migrations/20260611_assessment_audit_log.sql`.
- Columns per impl-plan §2.1.6.
- RLS: admin SELECT, service-role INSERT only, no UPDATE/DELETE (append-only).
- Implements: HR-1 audit-logged requirement (spec §4 + OQ-KA-7).
- Depends on: T1.2.

### T1.5 Build `lib/assessment/seed-from-markdown.ts` — **M**
- Dev utility that parses `question-bank.md` + the locked citations file from T0.2 → emits SQL for the seed migration.
- Produces one INSERT per `assessment_questions` row + one INSERT per `assessment_question_versions` row (v1 with `effective_from = now()`, `effective_to = NULL`).
- Currency_year set to `2025` for Q7, Q22, Q26, Q27, Q31; NULL for everything else (per question-bank.md "Currency-sensitive items" section).
- Unit test: round-trip from a 3-question fixture confirms output SQL parses + executes.
- Implements: spec §4 (initial seed from markdown).
- Depends on: T1.2, T0.2.

### T1.6 Create `20260611_assessment_seed.sql` migration — **S**
- Generated by T1.5; commits the produced SQL as the seed migration.
- Idempotency guard: refuses to insert if any `assessment_questions` row already exists.
- Implements: spec §4 initial seed.
- Depends on: T1.5.

### T1.7 Smoke + RLS integration tests — **M**
- Test: fresh DB → run migrations → SELECT 35 rows from `assessment_questions` joined with current `assessment_question_versions` → verify 35 distinct prompts, correct category distribution (6/6/6/6/6/5), 5 rows with `currency_year = 2025` (Q7, Q22, Q26, Q27, Q31).
- RLS test: anonymous client cannot SELECT `assessment_attempts`; cannot INSERT `assessment_question_versions`; can SELECT `assessment_questions`.
- Implements: Phase 1 gate.
- Depends on: T1.6, T1.4.

**Phase 1 gate**: T1.7 passes — fresh DB returns the full 35-question current-version set; RLS denies the documented forbidden paths.

---

## Phase 2 — Public assessment surface

**Goal**: `/assessment/*` end-to-end. 35 questions presented one per screen with shuffled options, no back-tracking; time-commitment bucket; email-gate; results page with weakest-category callout + citations on wrong + "coming soon" close. Email-marketer push is stubbed (real wire-up in Phase 4).

### T2.1 `lib/assessment/types.ts` — typed contracts — **S**
- Define `Question`, `Option`, `Attempt`, `Response`, `CategoryScore`, `Result`, `TimeBucket` enum (`≤1h` / `half-day` / `1-day` / `multi-day`).
- Implements: OQ-KA-10 (four time buckets).
- Depends on: T1.7.

### T2.2 `lib/assessment/shuffle.ts` + property tests — **S** `[P]`
- Deterministic 4-element shuffle keyed by `attempt_id + question_id` (HMAC-seeded mulberry32 PRNG).
- Property tests: same seed → identical order across 10k iterations; different seeds → distribution across all 24 permutations.
- Implements: OQ-KA-6 anti-cheat (option shuffle per attempt).
- Depends on: T2.1.

### T2.3 `lib/assessment/currency.ts` — currency_year gate — **S** `[P]`
- Pure functions: `currentFy()` (returns int year of current FY's 1 July start), `isCurrencyServeable(question)`.
- Unit tests: 2025-stamped question is serveable in FY2025–26, paused in FY2026–27; NULL `currency_year` always serveable.
- Implements: OQ-KA-5 (hard gate).
- Depends on: T2.1.

### T2.4 `lib/assessment/scoring.ts` — per-category sub-scores + weakest-category — **S** `[P]`
- Compute `{ category_id: { correct, total } }` from a list of responses + their pinned versions.
- Weakest-category resolver: lowest `correct/total` ratio with stable alphabetical tie-break.
- Handles partial-currency-pause (a category with 5 questions still scores correctly as a denominator of 5).
- Unit tests: full sweep / all-wrong / mixed / tied-categories / one-currency-paused.
- Implements: OQ-KA-2 (per-category sub-scores + weakest-domain callouts).
- Depends on: T2.1.

### T2.5 `lib/assessment/question-loader.ts` — server-only loader — **S**
- Reads `assessment_questions` joined with current `assessment_question_versions`, filters archived + currency-paused, orders by `(category.display_order, position_in_category)`.
- Returns the array used by the public assessment surface for the entire 35-question (or fewer if paused) sequence.
- Implements: spec §3 (category-ordered render) + OQ-KA-5 (currency gate applied at load).
- Depends on: T2.3.

### T2.6 `POST /assessment/start` route handler — **S**
- File: `src/app/assessment/start/route.ts`.
- Generates `attempt_id`, INSERTs `assessment_attempts`, sets HMAC-signed cookie, redirects to `/assessment/{id}/question/1`.
- Implements: impl-plan §3.1; spec §3 step 1.
- Depends on: T1.3, T2.1.

### T2.7 Intro page `/assessment` — **S**
- File: `src/app/assessment/page.tsx`.
- Short copy + "Start the assessment" CTA (form POSTing to `/assessment/start`).
- Uses whatever E6.4 public tokens exist; matches LSL Calculator brand.
- Implements: spec §3 step 1, OQ-KA-1 (public marketing surface).
- Depends on: T2.6.

### T2.8 Question page `/assessment/[attemptId]/question/[position]` — **M**
- File: `src/app/assessment/[attemptId]/question/[position]/page.tsx`.
- Server Component shell loads the question via `question-loader`; client `QuestionCard` renders prompt + shuffled options + progress bar.
- Submit calls `recordAnswer` Server Action → router push to next position (or `/time-commitment` after Q35).
- No back-button trap; duplicate-answer rejection from the Server Action surfaces a friendly forward.
- Implements: spec §3 step 3, OQ-KA-6 (shuffled options).
- Depends on: T2.5, T2.2, T2.9.

### T2.9 `recordAnswer` Server Action — **S**
- File: `src/app/assessment/_actions/record-answer.ts`.
- Verifies cookie claim, refuses duplicate `(attempt_id, question_id)`, computes `is_correct` against the pinned `version_id`, INSERTs `assessment_responses`.
- Returns next position or `done` signal.
- Implements: impl-plan §3.3, OQ-KA-8 (version_id pinned at insert time), spec §3 no-back-tracking.
- Depends on: T1.3.

### T2.10 Time-commitment page `/assessment/[attemptId]/time-commitment` — **S**
- File: `src/app/assessment/[attemptId]/time-commitment/page.tsx`.
- `TimeCommitmentPicker` with four radio buckets.
- Submit calls `recordTimeCommitment` Server Action → redirect to email-gate.
- Implements: spec §3 step 4, OQ-KA-10 (four buckets).
- Depends on: T2.1.

### T2.11 `recordTimeCommitment` Server Action — **S** `[P]`
- File: `src/app/assessment/_actions/record-time-commitment.ts`.
- Verifies cookie + all questions answered; UPDATE `assessment_attempts.time_bucket`.
- Implements: impl-plan §3.4, OQ-KA-10.
- Depends on: T1.3.

### T2.12 Email-gate page `/assessment/[attemptId]/email-gate` — **M**
- File: `src/app/assessment/[attemptId]/email-gate/page.tsx`.
- `EmailGateForm` with email input, privacy notice block, consent checkbox.
- Submit calls `submitEmail` Server Action → renders results.
- Implements: spec §3 step 5, OQ-KA-3 (end-gated capture).
- Depends on: T2.1.

### T2.13 `submitEmail` Server Action (stubbed email-marketer push) — **M**
- File: `src/app/assessment/_actions/submit-email.ts`.
- Verifies cookie + time_bucket set; validates email; computes score via `lib/assessment/scoring.ts`; UPDATE `assessment_attempts` (email / completed_at / score_json / weakest_category); stubs email-marketer push as a no-op marked TODO-Phase-4.
- Returns `{ score_json, weakest_category, citations_for_wrong }` for direct render.
- Implements: impl-plan §3.5, OQ-KA-2 + OQ-KA-15 (weakest-category tagging).
- Depends on: T2.4, T2.11.

### T2.14 Results page `/assessment/[attemptId]/results` — **M**
- File: `src/app/assessment/[attemptId]/results/page.tsx`.
- `ResultsBars` (six per-category bars, weakest at top), weakest-category callout headline, list of citations under wrong answers grouped by category, `ComingSoonCard` close.
- No social-share, no booking links, no course CTAs (v0.5 boundary).
- Implements: spec §3 step 6, OQ-KA-2 (weakest callout) + OQ-KA-4 (citations on wrong only) + spec §4 "coming soon" close.
- Depends on: T2.13.

### T2.15 Phase 2 Playwright happy-path test — **M**
- E2E: navigate `/assessment` → start → answer all 35 (mix of correct/incorrect) → pick time bucket → enter email → see results with weakest-category callout + at least one wrong-answer citation + "coming soon" close.
- Anti-cheat verification: start a second attempt with the same email; verify at least 50% of questions show a different option order than the first attempt.
- Implements: Phase 2 gate.
- Depends on: T2.14.

**Phase 2 gate**: T2.15 green. Single-attempt happy path covers the full public flow; anti-cheat shuffle verified; no question shown without current `currency_year`. Email-marketer push is still stubbed.

---

## Phase 3 — Admin surface (HR-1 fulfilment)

**Goal**: `/app/admin/assessment/*` end-to-end: list view with filters, edit page with publish (versioned with in-flight pin), pause/unpause, audit log view, `currency_review_due` filter.

### T3.1 Admin route guard — **S**
- File: `src/app/app/admin/assessment/layout.tsx` (or shared admin layout if one exists from E5.1).
- Server-component guard: redirect to `/app/` if user is not authenticated OR `org_members.role !== 'admin'`.
- Implements: spec §4 admin surface placement; reuses E5.1 auth.
- Depends on: T1.7.

### T3.2 Admin list view — **M**
- File: `src/app/app/admin/assessment/page.tsx`.
- Table of 35 (or whatever exists) questions joined with current versions. Columns: category, position, prompt (truncated), currency_year, `currency_review_due` badge, `archived_at` badge, last-modified-by, last-modified-at.
- Filters: category dropdown, `currency_review_due` toggle, archived toggle.
- Click row → edit page.
- Implements: spec §5.4 + OQ-KA-5 (`currency_review_due` filter is a hard requirement).
- Depends on: T3.1, T1.7.

### T3.3 Admin edit page — **M**
- File: `src/app/app/admin/assessment/questions/[questionId]/page.tsx`.
- `QuestionEditor` form: prompt (markdown), 4 options + correct-option toggle, category dropdown, citation text + url, currency_year nullable.
- "Publish" button → confirmation `AlertDialog` → `publishQuestion` Server Action.
- "Pause" button → `archiveQuestion` Server Action.
- `VersionHistoryList` below the form (read-only chronological list of prior versions; click → modal showing the prior wording).
- Implements: spec §4 HR-1 + OQ-KA-7.
- Depends on: T3.1.

### T3.4 `publishQuestion` Server Action — **M**
- File: `src/app/app/admin/assessment/_actions/publish-question.ts`.
- Admin role check → single transaction: INSERT new `assessment_question_versions` row → UPDATE prior version's `effective_to = now()` → UPDATE `assessment_questions.current_version_id` → UPDATE `currency_year` if changed → INSERT `assessment_audit_log` row.
- Returns new `version_id`; surfaces toast on success / rollback on any failure.
- Implements: OQ-KA-8 (versioning + Publish semantics); mirrors E5.3 AC-MAP-5.
- Depends on: T1.2, T1.4.

### T3.5 `archiveQuestion` / `unarchiveQuestion` Server Actions — **S** `[P]`
- File: `src/app/app/admin/assessment/_actions/archive-question.ts`.
- UPDATE `assessment_questions.archived_at`; INSERT audit log.
- Implements: spec §4 currency_year gate (pause-when-stale + manual pause for editorial reasons).
- Depends on: T1.2, T1.4.

### T3.6 Admin audit log page — **S** `[P]`
- File: `src/app/app/admin/assessment/audit/page.tsx`.
- Read-only paginated table of `assessment_audit_log` rows. Columns: time, actor (email lookup), action, question (link to edit page), change reason.
- Implements: spec §4 HR-1 audit-logged.
- Depends on: T3.1, T1.4.

### T3.7 In-flight version pin integration test — **M**
- vitest + Supabase test container.
- Scenario: Respondent A starts attempt → answers Q1–Q4 → admin publishes a new Q5 version → Respondent A loads Q5 → verify the prompt text matches the PRIOR version (the one current at attempt-start) → A answers Q5 → verify `assessment_responses.version_id` matches the prior version, NOT the new one.
- Implements: OQ-KA-8 in-flight pin (the load-bearing semantics check).
- Depends on: T3.4, T2.8.

### T3.8 Cross-role admin RLS test — **S** `[P]`
- vitest + Supabase test container.
- Scenario: authenticated user with `role = 'payroll_user'` (not admin) attempts to call `publishQuestion` → rejected with admin-required error.
- Implements: HR-1 admin-only-write guarantee.
- Depends on: T3.4.

### T3.9 Phase 3 Playwright happy-path test — **M**
- E2E: admin user signs in → navigates to `/app/admin/assessment` → opens Q5 → edits the prompt → clicks Publish → confirms in dialog → toast appears → returns to list → opens Q5 again → confirms new prompt + version history shows 2 entries.
- Filter test: applies `currency_review_due` filter and confirms only paused/stale questions render.
- Implements: Phase 3 gate.
- Depends on: T3.7, T3.8, T3.6.

**Phase 3 gate**: T3.9 green; in-flight pin integration test (T3.7) passes; cross-role RLS test (T3.8) passes; admin can publish a new version without touching code or breaking respondents in flight.

---

## Phase 4 — Email-marketer wiring + weakest-category tagging

**Goal**: real push to the email-marketer pool (vendor confirmed in T0.3). Merge fields written. Soft-fail behaviour verified.

### T4.1 Build `src/server/email-marketer-client.ts` — **M**
- Singleton client for whichever vendor was chosen in T0.3 (Brevo or Resend SDK).
- Env var: `BREVO_API_KEY` or `RESEND_API_KEY` (one of the two) — added to Vercel + `.env.example`.
- Exposes `addContactToPool(payload)` interface that's vendor-agnostic at the call site.
- Implements: spec §3, §4 (email-marketer pool integration); resolves D02.
- Depends on: T0.3.

### T4.2 Build `lib/assessment/email-marketer/push-completion.ts` — **M**
- Composes the payload (email, attempt_id, time_bucket, weakest_category, six per-category numeric merge fields, `consent_v0_5_followup = true`) and calls `email-marketer-client.addContactToPool`.
- Retry-once-then-soft-fail per impl-plan §1.5.
- Unit tests with mocked client: happy / first-failure-retry-success / both-failures-soft-fail.
- Implements: OQ-KA-15 (weakest-category tagging) + spec §4 per-category merge fields.
- Depends on: T4.1, T2.4.

### T4.3 Wire `push-completion` into `submitEmail` Server Action (remove Phase 2 stub) — **S**
- Edit `src/app/assessment/_actions/submit-email.ts` to call `push-completion` (replacing the TODO-Phase-4 stub from T2.13).
- On soft-fail, set `assessment_attempts.email_marketer_status = 'failed'` and surface the warning in the response.
- Implements: spec §4 email-marketer integration.
- Depends on: T4.2, T2.13.

### T4.4 Results page warning state for email-marketer soft-fail — **S** `[P]`
- Edit `src/app/assessment/[attemptId]/results/page.tsx` to render a small banner if `email_marketer_status = 'failed'` ("we saved your results — there was a small hiccup adding you to our follow-up list…").
- Results render regardless of email-marketer success (per impl-plan §1.5 — capture-rate-first).
- Implements: impl-plan §1.5 soft-fail UX.
- Depends on: T4.3.

### T4.5 End-to-end email-marketer push test — **M**
- Test against the email-marketer sandbox / test pool (or against a mock matching the vendor's response shape if no sandbox available).
- Verifies the contact lands with all six per-category numeric merge fields, `weakest_category` tag, and `time_bucket` enum.
- Operator-runnable smoke test on the live sandbox before Phase 4 ships: complete an assessment with a test email; operator confirms the merge fields in the vendor dashboard.
- Implements: Phase 4 gate.
- Depends on: T4.4.

**Phase 4 gate**: T4.5 confirms merge fields land in the email-marketer pool; soft-fail path renders the right warning without breaking the results page.

---

## Phase 5 — FY-rollover safety + accessibility audit

**Goal**: currency gate verified end-to-end; axe-core clean; keyboard walkthrough documented.

### T5.1 Currency-pause Playwright path — **M**
- Seed DB fixture: Q7 with `currency_year = 2024` while the test clock is set to FY2026–27 (so Q7 is paused).
- E2E: start an assessment → verify only 34 questions render → answer them → results page shows Super category as `correct/5` (not `correct/6` with a phantom hole).
- Implements: OQ-KA-5 hard gate; R1 mitigation.
- Depends on: T2.15.

### T5.2 Admin currency_review_due verification — **S** `[P]`
- E2E (extending T3.9): seed Q7 as currency-paused → admin loads `/app/admin/assessment` → `currency_review_due` filter shows Q7 with a 🚨 badge → operator publishes a new version with `currency_year = <current FY year>` → public surface starts serving Q7 again.
- Implements: spec §5.4 + OQ-KA-5 admin filter requirement.
- Depends on: T5.1, T3.9.

### T5.3 axe-core WCAG 2.1 AA audit (public surface) — **M**
- `@axe-core/playwright` runs on `/assessment`, the question page, the time-commitment page, the email-gate page, and the results page.
- Zero violations. Fix any surfaced issues.
- Implements: spec ship-quality baseline.
- Depends on: T2.15.

### T5.4 axe-core WCAG 2.1 AA audit (admin surface) — **S** `[P]`
- `@axe-core/playwright` runs on `/app/admin/assessment` list, edit, audit pages.
- Zero violations.
- Depends on: T3.9.

### T5.5 Keyboard-only walkthrough — **S** `[P]`
- Manual run-through of public + admin flows using only keyboard. Document in `docs/qa/E8-v0.5-keyboard-walkthrough.md`. Fix any focus-management or tab-trap issues.
- Implements: spec ship-quality baseline.
- Depends on: T5.3.

**Phase 5 gate**: T5.1 currency-pause path passes; axe-core zero violations on T5.3 + T5.4; keyboard walkthrough documented.

---

## Phase 6 — QA handoff + ship

**Goal**: QA verifies; bugs triaged + fixed; PR merged to `main`; live on Vercel.

### T6.1 Dev handoff doc — **S**
- Run `dev-handoff` skill. Write `docs/engineering/changes/2026-XX-XX-E8-v0.5/HANDOFF.md` covering: what shipped, what's stubbed (nothing left stubbed after Phase 4), test plan summary, known issues (E6.4 token-update follow-up), env var additions (Brevo or Resend key).
- Implements: dev → QA handoff per `dev-qa-delegation`.
- Depends on: T5.5.

### T6.2 QA delegation — **M** (QA agent owns, dev unblocks)
- Invoke `dev-qa-delegation`. QA writes test plan from spec §6 in-scope list + tests it. QA report lands in `docs/engineering/changes/2026-XX-XX-E8-v0.5/QA-REPORT.md`.
- Dev fixes any P0/P1 bugs surfaced by QA.
- Implements: project ship gate.
- Depends on: T6.1.

### T6.3 PR open + Vercel preview verification — **S**
- Open PR on branch `008-knowledge-assessment`. CI gate: gold-standard + RLS + axe-core tests green. Vercel preview URL works end-to-end (public flow + admin flow on the preview).
- Implements: project deploy discipline.
- Depends on: T6.2.

### T6.4 Operator sign-off + merge — **S** (operator + dev)
- Operator reviews the Vercel preview, signs off, dev merges the PR (squash). Vercel auto-deploys to production. Smoke-test on the live URL: start a real assessment, confirm the email-marketer pool receives the contact.
- Implements: project ship gate.
- Depends on: T6.3.

**Phase 6 gate**: PR merged to `main`; production URL serves the assessment; first live response writes to `assessment_attempts` + the email-marketer pool.

---

## Task summary

| Phase | Tasks | Notes |
|---|---|---|
| 0 — Sub-spec resolution | 4 | Citations file is the launch-gate artifact |
| 1 — Migrations + seed | 7 | Mirrors E5.3 versioning pattern |
| 2 — Public assessment surface | 15 | Real implementation; email-marketer push stubbed |
| 3 — Admin surface (HR-1) | 9 | In-flight version pin is the load-bearing test |
| 4 — Email-marketer wiring | 5 | Removes the Phase 2 stub |
| 5 — FY-rollover + a11y | 5 | Currency gate verified end-to-end |
| 6 — QA handoff + ship | 4 | dev-qa-delegation → operator → merge |
| **Total** | **49** | Under the 50 ceiling — no scope drift into v1.0 |

## Dependencies between phases

- **Phase 0 → 1**: citation copy locked; no migration writes citation_text without it.
- **Phase 1 → 2**: schema + seed exist before any UI binds to it.
- **Phase 2 → 3**: public surface works end-to-end before admin surface starts (admin is for editing what public renders).
- **Phase 2 → 3 admin run in parallel from T3.1 onward**: only the in-flight pin integration test (T3.7) hard-depends on Phase 2's `recordAnswer` Server Action existing.
- **Phase 3 → 4**: email-marketer push wired after admin works (so a real publish doesn't compete with the stub).
- **Phase 4 → 5**: currency-pause + a11y tests cover the fully-wired stack.
- **Phase 5 → 6**: QA handoff covers the full-stack ship-ready system.

## Cross-cutting references

- Spec: `.specify/features/008-knowledge-assessment/spec.md` v0.5 SPEC LOCKED 2026-06-10 (the 9 locked OQ resolutions live in spec §7).
- Question bank: `.specify/features/008-knowledge-assessment/question-bank.md` (locked 2026-06-10).
- Impl plan (this file's sibling): `.specify/features/008-knowledge-assessment/impl-plan.md`.
- E5.3 versioning pattern this tasks file mirrors: `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` §4.1–4.2.
- E5.1 auth gate (admin role check): `.specify/features/005-lsl-platform/sub-specs/auth.md`.
- Git + deploy discipline: `~/.claude/rules/global-engineering.md`. No `--no-verify`, no `git add .`, no direct push to `main`, no `vercel deploy`, no `.env` commits. Every commit explicit-files staged; commits only when operator requests.
- v1.0 work (NOT in this task list): course catalogue ingestion, recommender, booking CTAs, re-engagement broadcast. See spec §6 + §8.
