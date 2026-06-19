# Implementation Plan: Payroll Knowledge Assessment v0.5 (E8)

**Version**: 0.1
**Status**: Draft — for operator review
**Date**: 2026-06-10
**Owner**: Developer agent
**Spec**: `.specify/features/008-knowledge-assessment/spec.md` — v0.5 SPEC LOCKED 2026-06-10
**Question bank (locked)**: `.specify/features/008-knowledge-assessment/question-bank.md`
**Course mapping (HELD until v1.0)**: `.specify/features/008-knowledge-assessment/course-mapping.md`
**Tasks**: `.specify/features/008-knowledge-assessment/tasks.md`
**Branch**: `008-knowledge-assessment`

> This plan covers **v0.5 only** — the lead-magnet assessment that ships standalone, without any course recommender, catalogue, or booking links. v1.0 (recommender layer) is explicitly out of scope and will get its own impl plan when ≥ 6 APA courses exist (per spec §8/§9). Read `spec.md` first; this document assumes its vocabulary (six categories, 35 questions, end-gated email capture, weakest-category callouts, in-flight session pinning, `currency_year` hard gate, four time-commitment buckets).

---

## 1. Architecture overview

### 1.1 Folder structure under `website/src/`

```
website/
├── src/
│   ├── app/
│   │   ├── assessment/                              ← PUBLIC marketing surface (anonymous, no auth)
│   │   │   ├── page.tsx                             ← Intro / "Start the assessment" landing
│   │   │   ├── start/
│   │   │   │   └── route.ts                         ← POST: creates an assessment_attempts row, returns attempt_id + first question
│   │   │   ├── [attemptId]/
│   │   │   │   ├── question/
│   │   │   │   │   └── [position]/
│   │   │   │   │       └── page.tsx                 ← One question per screen (Server Component shell + Client form)
│   │   │   │   ├── time-commitment/
│   │   │   │   │   └── page.tsx                     ← Four-bucket selector (after Q35)
│   │   │   │   ├── email-gate/
│   │   │   │   │   └── page.tsx                     ← Email capture before scoring is revealed
│   │   │   │   └── results/
│   │   │   │       └── page.tsx                     ← Per-category bars + weakest callout + citations on wrong + "coming soon"
│   │   │   ├── _actions/
│   │   │   │   ├── start-attempt.ts                 ← Server Action: create attempt, pin version_id
│   │   │   │   ├── record-answer.ts                 ← Server Action: append to assessment_responses, advance position
│   │   │   │   ├── record-time-commitment.ts        ← Server Action: write time_bucket on attempt
│   │   │   │   └── submit-email.ts                  ← Server Action: validate email, score, push to email-marketer pool
│   │   │   ├── _components/
│   │   │   │   ├── QuestionCard.tsx                 ← Question prompt + 4 shuffled options + progress bar
│   │   │   │   ├── CategoryHeader.tsx               ← "Fair Work Compliance · 1 of 6"
│   │   │   │   ├── ProgressBar.tsx                  ← X of 35
│   │   │   │   ├── TimeCommitmentPicker.tsx         ← Four radio buckets (≤1h / half-day / 1-day / multi-day)
│   │   │   │   ├── EmailGateForm.tsx                ← Email + consent checkbox
│   │   │   │   ├── ResultsBars.tsx                  ← Six per-category bars + weakest callout at top
│   │   │   │   ├── CitationLine.tsx                 ← One-line authority cite under wrong answers
│   │   │   │   └── ComingSoonCard.tsx               ← Closing "course recommendations coming soon" block
│   │   │   └── _lib/
│   │   │       ├── shuffle.ts                       ← Deterministic option shuffle keyed by (attempt_id, question_id)
│   │   │       └── currency-gate.ts                 ← Helper: filter out FY-dated questions failing the currency_year check
│   │   │
│   │   └── app/
│   │       └── admin/
│   │           └── assessment/
│   │               ├── page.tsx                     ← List view: 35 questions, filters (category, currency_review_due)
│   │               ├── questions/
│   │               │   └── [questionId]/
│   │               │       ├── page.tsx             ← Edit form: prompt, options, correct answer, category, citation, currency_year
│   │               │       └── _components/
│   │               │           ├── QuestionEditor.tsx
│   │               │           ├── PublishButton.tsx
│   │               │           └── VersionHistoryList.tsx
│   │               ├── audit/
│   │               │   └── page.tsx                 ← Audit log view (read-only): who changed what when
│   │               └── _actions/
│   │                   ├── publish-question.ts      ← Server Action: write a new assessment_question_versions row + flip current_version_id
│   │                   └── pause-question.ts        ← Server Action: archive a question (returns null to public render layer)
│   │
│   ├── lib/
│   │   └── assessment/
│   │       ├── types.ts                             ← Question, Option, Attempt, Response, Result, TimeBucket, CategoryScore
│   │       ├── scoring.ts                           ← Per-category sub-scores + weakest-category resolver
│   │       ├── shuffle.ts                           ← Pure deterministic shuffle (seeded by attempt_id + question_id)
│   │       ├── currency.ts                          ← currentFy() + currency_year gate (returns serveable: boolean)
│   │       ├── question-loader.ts                   ← Server-only: load current question versions in category order; apply currency gate
│   │       ├── seed-from-markdown.ts                ← One-shot seed util: parses question-bank.md → 35 question rows + 35 v1 rows
│   │       └── email-marketer/
│   │           └── push-completion.ts               ← Writes email + merge fields into the existing email-marketer pool
│   │
│   ├── server/
│   │   ├── supabase-server.ts                       ← Existing (E5.1)
│   │   └── email-marketer-client.ts                 ← Brevo OR Resend client singleton (whichever email-marketer agent already uses)
│   │
│   └── components/
│       └── ui/                                      ← Existing shadcn primitives (reused)
│
└── supabase/
    └── migrations/
        ├── 20260611_assessment_categories.sql           ← Enum + categories lookup
        ├── 20260611_assessment_questions.sql            ← Live view table + RLS
        ├── 20260611_assessment_question_versions.sql    ← Immutable history table + RLS
        ├── 20260611_assessment_attempts.sql             ← One row per started assessment
        ├── 20260611_assessment_responses.sql            ← One row per answered question; pins version_id
        ├── 20260611_assessment_audit_log.sql            ← Admin edits, read-only from the app
        └── 20260611_assessment_seed.sql                 ← Seed the 35 questions + their v1 versions from question-bank.md
```

**Why this shape**:

- **Public surface lives at `/assessment/*` (no `/app/` prefix)** — per OQ-KA-1, the assessment is anonymous and lives on the marketing surface. It does NOT sit under `/app/*` (which is the authenticated workspace).
- **Admin surface lives at `/app/admin/assessment/*`** — per OQ-KA-7. Admin reuses the existing E5.1 auth slice (admin role check, already shipped). No new auth code in v0.5.
- **`lib/assessment/` is the pure library** (types, scoring, shuffle, currency gate). No I/O. Tested in isolation.
- **Server Actions over API route handlers**: the public flow is a sequence of small mutations (start attempt → record answer → record time bucket → submit email). Server Actions are the right altitude — no need for a separate REST surface. The one exception is the `start` route which is POST-only and returns the first question (modelled as a route handler to keep the redirect cleanly outside React).
- **Migrations are date-prefixed** matching project convention. All RLS policies applied in the same migration as the table they protect.

### 1.2 Public vs admin auth boundary

| Surface | Path prefix | Auth | RLS |
|---|---|---|---|
| Public assessment flow | `/assessment/*` | Anonymous | Public read on `assessment_questions` + `assessment_question_versions` (current version only); insert-only on `assessment_attempts` + `assessment_responses` via Server Actions running with anon key |
| Admin CRUD | `/app/admin/assessment/*` | Authenticated + `role = 'admin'` (E5.1 enforced) | Service-role writes via Server Actions; reads via authenticated anon-key with policy `current_user_org_role() = 'admin'` |
| Audit log read | `/app/admin/assessment/audit` | Authenticated + `role = 'admin'` | Read-only RLS — no client writes |

**Anonymity model on the public surface.** No login. `attempt_id` is a UUID generated server-side on `/assessment/start`; persisted in an HTTP-only cookie scoped to `/assessment` and as a path param. No PII collected until the email-gate step. Re-takes use a new `attempt_id` (per OQ-KA-6 — same email, shuffled options, fresh row).

### 1.3 Question / version model (mirrors E5.3 pay-code mapping pattern)

This is the load-bearing data design call. **It is intentionally identical in shape to E5.3's `pay_code_mappings` / `pay_code_mapping_versions` split** — proven inside this codebase, same versioning invariant, same in-flight-pin semantics. Operator-locked OQ-KA-8.

- `assessment_questions` (live view, one row per question): holds the stable `question_id`, `category`, `position_in_category`, `current_version_id`, `archived_at`, `currency_year`, `currency_review_due` (computed). **Editing a question never updates this row's content — only its `current_version_id` pointer.**
- `assessment_question_versions` (immutable history, one row per published version): holds the snapshot at version-publish time — `prompt`, `options` (jsonb), `correct_option_key`, `citation_text`, `citation_url`, `effective_from`, `effective_to`, `created_by`, `change_reason`. **For any `question_id`, exactly one version row has `effective_to IS NULL` at any time.** That row is what `current_version_id` points to.
- `assessment_responses` references `version_id` directly — not `question_id`. Replaying or auditing a respondent's result reads the version they actually answered against. Mid-session "Publish" by the operator does NOT change in-flight wording, because the public render layer holds the version_id resolved at attempt-start.

**Why this matters**: it's the same proven pattern E5.3 uses for pay-code mappings, so the operator and dev team already understand the semantics. No reinvention. The "Publish" action atomically writes a new `assessment_question_versions` row, closes the prior version's `effective_to`, and updates `assessment_questions.current_version_id` — single transaction.

### 1.4 Currency-year hard gate

Per OQ-KA-5. The public render layer **never** serves an FY-dated question whose `currency_year` is less than the current FY's start year.

- `assessment_questions.currency_year` is an integer (e.g. `2025` for FY2025–26 items). Non-FY-dated questions have `currency_year = NULL` (always serveable).
- `currency_review_due` is a generated column: `(currency_year IS NOT NULL AND currency_year < currentFy())`. Admin list view filters by this.
- `question-loader.ts` filters out any question with `currency_review_due = true` AND `archived_at IS NULL` before category-ordering. If filtering reduces a category below the expected count, the flow still proceeds — the assessment shrinks gracefully (e.g. 34 questions across 6 categories rather than 35), and a server-side log entry flags the paused question for operator attention.

**Fallback render contract**: if the gate trips for the very first time on 1 July and the operator hasn't refreshed yet, the public surface still works — the category just has one fewer question. The respondent never sees a stale SG rate. The operator's `/app/admin/assessment` list view shows the paused question with a "🚨 currency review due" badge, sortable to the top, so the SLA is enforced by visibility, not by breaking the public surface.

### 1.5 Email-marketer integration

Per spec §3, §4, and the OQ-KA-15 default adoption. On `submit-email` Server Action success:

1. Validate email format + light dedup check (same email + same `attempt_id` is idempotent).
2. Score the attempt — read all `assessment_responses` for this `attempt_id`, group by category, compute per-category `correct / total` and find the lowest (with a stable tie-break: alphabetical category name).
3. Write the attempt row's terminal fields: `email`, `completed_at`, `score_json`, `weakest_category`.
4. Push to email-marketer pool: `lib/assessment/email-marketer/push-completion.ts` calls the platform's existing email-marketer client (`src/server/email-marketer-client.ts`). Payload:
   - `email`
   - `attempt_id`
   - `time_bucket` (one of `≤1h`, `half-day`, `1-day`, `multi-day`)
   - `weakest_category` (one of `fair-work`, `super`, `payroll-tax`, `leave`, `terminations`, `end-of-year`)
   - Per-category sub-scores as numeric merge fields: `score_fair_work`, `score_super`, `score_payroll_tax`, `score_leave`, `score_terminations`, `score_end_of_year`
   - `consent_v0_5_followup` = `true` (the "coming soon" sentence is the consent hook)
5. On email-marketer push failure: log + retry once (5s backoff); on second failure, mark the attempt with `email_marketer_status = 'failed'` and surface a soft warning to the respondent ("we saved your results — there was a small hiccup adding you to our follow-up list, but you can still bookmark this page"). The results page renders regardless — the email-marketer push failure is NOT a hard gate on showing the score, because the respondent has already invested 10 minutes.

**Vendor identification**: spec says "Brevo or Resend, whichever the email-marketer agent is already using." The email-marketer agent's project persona is currently a placeholder (`agents/email-marketer/context/persona.md` is the default template). Confirming the vendor is **Dev finding D03 below** — must be resolved before Phase 4 implementation.

### 1.6 Public surface, design tokens, and the E6.4 dependency

Per spec § Depends-on and the locked epic: the public assessment surface uses E6.4 (public re-skin) tokens for visual coherence with the LSL Calculator brand. E6.4 may not be fully landed by v0.5 ship time — the public assessment surface uses **whatever public-surface tokens exist at the time of implementation** and accepts a follow-up restyle pass once E6.4 finalises. This is called out as Risk R3 below.

---

## 2. Data model

### 2.1 Supabase tables

All tables under the default `public` schema. Migrations are date-prefixed (`20260611_*`). Every table has RLS enabled; policies are spelled out in the same migration file.

#### 2.1.1 `assessment_categories` (system lookup)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | text (PK) | yes | `fair-work` / `super` / `payroll-tax` / `leave` / `terminations` / `end-of-year` |
| `display_name` | text | yes | "Fair Work Compliance" / "Superannuation" / "Payroll Tax" / "Leave" / "Terminations" / "End of Year / STP" |
| `display_order` | int | yes | 1–6, render order on the assessment + results pages |
| `expected_question_count` | int | yes | 6 / 6 / 6 / 6 / 6 / 5 (per question-bank.md) |

Read-only via RLS for all users (anonymous + authenticated). Seeded once in `20260611_assessment_categories.sql`.

#### 2.1.2 `assessment_questions` (live view, one row per question)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | Stable question id; survives all version edits |
| `category_id` | text (FK → `assessment_categories.id`) | yes | |
| `position_in_category` | int | yes | 1-based, within the category. Determines render order inside the category block. |
| `currency_year` | int | no | NULL = not FY-dated. Non-NULL = the FY start year this content is valid for (e.g. `2025` for FY2025–26). |
| `current_version_id` | uuid (FK → `assessment_question_versions.id`) | yes | Points to the live version |
| `archived_at` | timestamptz | no | NULL = active. Non-NULL = paused; never served to public. |
| `created_at` | timestamptz | yes | First creation timestamp |
| `updated_at` | timestamptz | yes | Trigger-maintained |

**Generated columns / views:**
- `currency_review_due` exposed via a view: `(currency_year IS NOT NULL AND currency_year < current_fy_start_year())`.

**Indexes**: `(category_id, position_in_category)`, `(archived_at) WHERE archived_at IS NULL` (partial index for the hot-path public load).

**RLS**:
- `SELECT`: allowed for all (anonymous + authenticated) — needed for the public assessment surface.
- `INSERT` / `UPDATE` / `DELETE`: admin only (`role = 'admin'` in `org_members`) via Server Actions executing under service-role.

#### 2.1.3 `assessment_question_versions` (immutable history)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `question_id` | uuid (FK → `assessment_questions.id`) | yes | |
| `prompt` | text | yes | Markdown allowed (minimal — bold, italic) |
| `options` | jsonb | yes | Array of `{ key: 'A' \| 'B' \| 'C' \| 'D', text: string }`. Order in the array is the canonical answer-letter order. Shuffling is rendered, not stored. |
| `correct_option_key` | text | yes | One of `A`/`B`/`C`/`D` |
| `citation_text` | text | yes | One-line authority reference, shown on incorrect answers (per OQ-KA-4) |
| `citation_url` | text | no | Optional deep-link to Fair Work / ATO / state-revenue source |
| `effective_from` | timestamptz | yes | When this version became current |
| `effective_to` | timestamptz | no | When this version was superseded. NULL = current. |
| `change_reason` | text | no | Free-text operator note |
| `created_by` | uuid (FK → `auth.users.id`) | yes | The admin who published this version |
| `created_at` | timestamptz | yes | |

**Versioning invariant** (mirrors E5.3 AC-MAP-5): for any `question_id`, exactly one version row has `effective_to IS NULL`. The `assessment_questions.current_version_id` always points to that row. Both updates happen in one transaction inside `publish-question.ts`.

**RLS**:
- `SELECT`: allowed for all (anonymous + authenticated). The public flow reads the current version directly; the admin UI reads history.
- `INSERT`: admin only via Server Actions (service-role). Application code never UPDATEs or DELETEs version rows — the table is append-only by convention enforced via a trigger on UPDATE/DELETE that RAISES.

#### 2.1.4 `assessment_attempts` (one row per started assessment)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | Returned to the client as `attemptId` |
| `started_at` | timestamptz | yes | |
| `completed_at` | timestamptz | no | Set on email-gate submission |
| `time_bucket` | enum (`≤1h`, `half-day`, `1-day`, `multi-day`) | no | Set just before email-gate (per OQ-KA-10) |
| `email` | citext | no | Set on email-gate submission. Indexed (non-unique — re-takes allowed per OQ-KA-6) |
| `weakest_category` | text (FK → `assessment_categories.id`) | no | Computed at scoring time |
| `score_json` | jsonb | no | `{ fair_work: { correct: 4, total: 6 }, super: { ... }, ... }`. Set at scoring time. |
| `email_marketer_status` | enum (`pending`, `sent`, `failed`) | no | Set after the email-marketer push attempt |
| `user_agent` | text | no | Lightweight bot-screening signal (not relied on) |

**RLS**:
- `INSERT`: allowed for anonymous (via Server Action with anon key) — required to start an attempt without login.
- `UPDATE`: allowed for anonymous WHERE `id = current_attempt_id_claim` — the attempt cookie carries a signed claim that scopes which row this anonymous session can update. (Implementation: HMAC-signed cookie containing `attempt_id`; Server Action verifies before update.)
- `SELECT`: admin only — anonymous respondents do not need to read their own attempt back (the score is computed in-Server-Action and rendered into the response).

#### 2.1.5 `assessment_responses` (one row per answered question)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `attempt_id` | uuid (FK → `assessment_attempts.id`) | yes | |
| `question_id` | uuid (FK → `assessment_questions.id`) | yes | |
| `version_id` | uuid (FK → `assessment_question_versions.id`) | yes | **Pinned at answer time** — the version the respondent actually saw. Per OQ-KA-8 in-flight pin semantics. |
| `selected_option_key` | text | yes | `A`/`B`/`C`/`D` |
| `is_correct` | bool | yes | Computed at insert time by comparing to `assessment_question_versions.correct_option_key` |
| `answered_at` | timestamptz | yes | |
| `option_order` | jsonb | yes | The shuffled option-key order the respondent actually saw. Stored for audit + replay (e.g. `["C","A","D","B"]`). |

**RLS**: same as `assessment_attempts` — anonymous INSERT scoped by signed cookie claim. No anonymous SELECT.

**Unique constraint**: `(attempt_id, question_id)` — one answer per question per attempt (no back-tracking edits per spec §3).

#### 2.1.6 `assessment_audit_log` (admin edit trail)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `actor_id` | uuid (FK → `auth.users.id`) | yes | The admin |
| `action` | enum (`publish_question`, `archive_question`, `unarchive_question`) | yes | |
| `question_id` | uuid (FK → `assessment_questions.id`) | yes | |
| `version_id` | uuid (FK → `assessment_question_versions.id`) | no | Set when `action = 'publish_question'` |
| `details` | jsonb | no | Free-form audit context (change_reason snapshot, before/after summary) |
| `created_at` | timestamptz | yes | |

**RLS**: admin SELECT, service-role INSERT only. No UPDATE / DELETE.

### 2.2 Seed migration

`20260611_assessment_seed.sql` parses the 35 questions from `question-bank.md` and writes:

- 35 rows into `assessment_questions` (one per question, with `category_id`, `position_in_category`, `currency_year` set to `2025` for Q7/Q22/Q26/Q27/Q31 and NULL elsewhere).
- 35 rows into `assessment_question_versions` (the initial v1 of each question, with `effective_from = now()`, `effective_to = NULL`, `created_by = <seed-system-user>`, `change_reason = 'Initial seed from question-bank.md 2026-06-10'`).
- 6 rows into `assessment_categories` (per question-bank.md category breakdown).

The seed itself is idempotent: it checks for the existence of the system seed user and the categories before inserting, and refuses to re-seed if questions already exist (safety guard for repeated migration application).

`lib/assessment/seed-from-markdown.ts` is the dev-only utility that produces the SQL. The seed SQL itself is committed; the parser is a one-shot helper not run in production.

### 2.3 Citation data

Citation text + URL is stored per-version (`assessment_question_versions.citation_text`, `.citation_url`). The seed migration populates these from operator-provided copy (Phase 0 deliverable below). Spec §4 says "every wrong answer surfaces a one-line citation back to the relevant Fair Work / ATO / state-revenue authority" — the operator owns the source-of-truth copy. **Dev finding D02** below tracks this.

---

## 3. API surface (Server Actions + one route handler)

All public-surface mutations are Server Actions defined under `src/app/assessment/_actions/`. Admin mutations are Server Actions under `src/app/app/admin/assessment/_actions/`. The only route handler is `POST /assessment/start` because the redirect-after-start is cleanest outside React.

### 3.1 `POST /assessment/start` (route handler)

Inputs: none (anonymous; optional `referrer` query param logged).
Behaviour:
1. Generate `attempt_id` (uuid v4).
2. INSERT into `assessment_attempts` with `started_at = now()`.
3. Set HMAC-signed HTTP-only cookie `assessment_attempt` with payload `{ attempt_id, issued_at }` and 2-hour expiry (matches roughly the assessment session window — long enough for a 10-minute session + slack).
4. 302 → `/assessment/{attempt_id}/question/1`.

### 3.2 `startAssessment()` (Server Action, called only from the intro page CTA → posts to `/assessment/start`)

This is the form-action partner to 3.1. Form on `/assessment/page.tsx` posts to `/assessment/start` so the cookie can be set before the redirect resolves.

### 3.3 `recordAnswer({ attempt_id, question_id, version_id, selected_option_key, option_order })` (Server Action)

1. Verify cookie claim matches `attempt_id`.
2. Verify `(attempt_id, question_id)` does NOT already exist (no back-tracking).
3. Read `correct_option_key` from `assessment_question_versions` for this `version_id`.
4. INSERT into `assessment_responses` with computed `is_correct`.
5. Return `{ next_position, total_questions }` — client uses this to navigate forward.

### 3.4 `recordTimeCommitment({ attempt_id, time_bucket })` (Server Action)

1. Verify cookie claim.
2. Verify all 35 (or fewer if currency-paused) questions answered.
3. UPDATE `assessment_attempts.time_bucket`.
4. Redirect to `/assessment/{attempt_id}/email-gate`.

### 3.5 `submitEmail({ attempt_id, email })` (Server Action)

1. Verify cookie claim.
2. Verify `time_bucket` is set.
3. Validate email format (RFC-5322 conservative regex + DNS MX check via lightweight library — Phase 4 task selects library).
4. Score: read all responses for this attempt, compute per-category subscores + weakest category.
5. UPDATE `assessment_attempts` with `email`, `completed_at`, `score_json`, `weakest_category`.
6. Call `push-completion.ts` to send to email-marketer pool (with retry-once-then-soft-fail per §1.5).
7. Return `{ score_json, weakest_category, citations_for_wrong: [{ question_id, citation_text, citation_url }] }`. The client renders the results page from this server-action return value — no second round-trip.

### 3.6 Admin: `publishQuestion({ question_id, prompt, options, correct_option_key, citation_text, citation_url, currency_year, change_reason })` (Server Action)

1. Verify `role = 'admin'`.
2. In one transaction:
   - INSERT new row into `assessment_question_versions` with `effective_from = now()`, `effective_to = NULL`, `created_by = auth.uid()`.
   - UPDATE the prior current version's `effective_to = now()`.
   - UPDATE `assessment_questions.current_version_id` to the new version row.
   - UPDATE `assessment_questions.currency_year` if changed.
   - INSERT `assessment_audit_log` row with `action = 'publish_question'`.
3. Return the new `version_id`.

### 3.7 Admin: `archiveQuestion({ question_id, change_reason })` / `unarchiveQuestion(...)` (Server Actions)

UPDATE `assessment_questions.archived_at` + audit log. Archived questions are not served to the public render layer.

---

## 4. UI structure

### 4.1 Public surface

- **`/assessment`** — intro page. Short copy: "Test your payroll-compliance knowledge in 10 minutes." One CTA: "Start the assessment." Brand-aligned with whatever E6.4 public tokens exist at ship time.
- **`/assessment/{attemptId}/question/{position}`** — one question per screen.
  - Top: `CategoryHeader` ("Fair Work Compliance · Q2 of 6 in this category") + `ProgressBar` (X of 35 overall).
  - Middle: `QuestionCard` with prompt + 4 radio options (order shuffled deterministically per attempt — same shuffle every render so re-rendering doesn't reshuffle mid-question).
  - Bottom: "Next" button. Disabled until an option is selected. On click → `recordAnswer()` → router push to next position.
  - **No back button.** Browser-back is not blocked (spec is silent; we don't aggressively trap), but the route handler refuses to UPSERT — if the respondent goes back and re-submits, the unique constraint surfaces a friendly "you've already answered this question" message and forwards to the next.
- **`/assessment/{attemptId}/time-commitment`** — `TimeCommitmentPicker` with the four buckets (per OQ-KA-10). Submit → next.
- **`/assessment/{attemptId}/email-gate`** — `EmailGateForm` with email input + privacy notice + consent checkbox ("I agree to receive my results and a follow-up when course recommendations are available"). Submit → results.
- **`/assessment/{attemptId}/results`** — `ResultsBars` with six per-category bars sorted with weakest at top, weakest-category callout headline, list of incorrect-answer citations grouped by category, closing `ComingSoonCard`. No social-share buttons in v0.5.

### 4.2 Admin surface (`/app/admin/assessment/*`)

- **List view** — table of 35 questions. Columns: category, position, prompt (truncated), `currency_year`, `currency_review_due` badge, `archived_at` badge, last-modified-by, last-modified-at. Filters: category, `currency_review_due` (per spec §5.4 + OQ-KA-5), archived. Click row → edit page.
- **Edit page** — `QuestionEditor` form (prompt, 4 options + correct toggle, category dropdown, citation text + url, currency_year). "Publish" button → `publishQuestion()` Server Action → success toast + redirect to list. "Pause" button → `archiveQuestion()`. Below the form: `VersionHistoryList` (read-only chronological list of prior versions, click to view in modal).
- **Audit page** — read-only table of `assessment_audit_log` rows. Columns: time, actor, action, question (with link), change reason.

### 4.3 shadcn primitives reused

Card, Button, RadioGroup, Form, Input, Label, Select, Dialog, AlertDialog (publish confirmation), Toast, Table, Badge, Tooltip, Progress. No new shadcn primitives needed.

---

## 5. Anti-cheat + shuffle determinism

Per OQ-KA-6, option order is shuffled per attempt. Determinism matters: the same `attempt_id + question_id` must produce the same shuffle every time the question is rendered (so navigating away and back, or rapid double-clicks, don't reshuffle mid-decision).

Implementation in `lib/assessment/shuffle.ts`:

```ts
// Conceptual signature — do NOT take as final code
function shuffleOptions(
  options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[],
  seed: string,  // attempt_id + question_id
): typeof options;
```

Uses a deterministic PRNG (e.g. mulberry32 keyed by HMAC of seed). Pure function. Property test: same seed → same order, every time. Different seeds (i.e., different attempts) almost-always produce a different order (collision rate < 1/24 expected for 4-element shuffles, which is acceptable).

The shuffled order is stored in `assessment_responses.option_order` at answer-record time. This lets the admin audit log reconstruct what the respondent actually saw.

---

## 6. Testing strategy

### 6.1 Unit (vitest)

- `lib/assessment/scoring.ts` — per-category sub-score computation; weakest-category tie-break; handles partial-currency-pause (a category with 5 questions of 6 still works).
- `lib/assessment/shuffle.ts` — determinism property test; reasonable distribution across many seeds.
- `lib/assessment/currency.ts` — gate trips on 2025-dated question after FY2026 start; gate does not trip on NULL `currency_year`.
- `lib/assessment/question-loader.ts` — orders by category display_order then position_in_category; filters archived; filters currency-paused.

### 6.2 Integration (vitest + Supabase test container)

- `publishQuestion` Server Action: emits the version row, closes the prior `effective_to`, updates `current_version_id`, writes audit log row — all in one transaction. Rollback on any failure leaves DB unchanged.
- `recordAnswer` Server Action: rejects duplicate (`attempt_id`, `question_id`); rejects mismatched cookie claim; correctly computes `is_correct` against the pinned `version_id` (NOT current).
- **In-flight version pin test** (the key OQ-KA-8 verification): start an attempt; admin publishes a new version of Q5 mid-session; the respondent's render of Q5 still shows the original wording; their `assessment_responses.version_id` points to the original version row.

### 6.3 RLS (vitest + Supabase test container)

- Anonymous user cannot SELECT `assessment_attempts` (privacy — no enumeration of respondent emails).
- Anonymous user cannot UPDATE `assessment_attempts` rows other than their own attempt (cookie-claim enforcement).
- Non-admin authenticated user cannot UPDATE `assessment_questions` or INSERT `assessment_question_versions`.

### 6.4 End-to-end (Playwright)

- **Happy path**: start → answer 35 questions → pick time bucket → enter email → see results with weakest callout + citations on wrong answers + "coming soon" card.
- **Currency-pause path**: seed DB with Q7 marked currency-paused; start an assessment; verify only 34 questions render and the Super category shows 5/5 in the results (not 5/6 with a phantom missing question).
- **Mid-session publish path** (in-flight pin): start an attempt on position 3; admin publishes a new Q5 version in a parallel tab; respondent continues to Q5 and sees the original wording.
- **Anti-cheat path**: complete an assessment; immediately start a new one with the same email; verify a Q-by-Q diff that at least some option orders differ.

### 6.5 Accessibility (axe-core via Playwright)

- Public assessment surface and results page: zero violations at WCAG 2.1 AA.
- Admin edit page: zero violations.
- Keyboard-only walkthrough documented in `docs/qa/`.

### 6.6 No paid-API tests in CI

There are no LLM calls in v0.5 (no PDF extraction, no LLM explanations — spec §6 explicitly excludes "LLM-generated explanation copy" from v0.5). This keeps CI cheap and offline-stable.

---

## 7. Cross-cutting concerns

### 7.1 Auth boundary

- Public `/assessment/*` is anonymous. The HMAC-signed cookie scoping anonymous writes to their own attempt row is the only auth-adjacent primitive needed.
- Admin `/app/admin/assessment/*` sits behind the E5.1 auth slice (already shipped). The middleware in `src/middleware.ts` is already configured to gate `/app/*`. We add a role-check guard in the admin page server components — redirect to `/app/` if `org_members.role !== 'admin'`.

### 7.2 Design tokens (E6.4 dependency, R3)

The public surface uses E6.4 public-re-skin tokens where they exist; falls back to current public-surface tokens otherwise. Once E6.4 finalises, a follow-up "token-update" task is queued (NOT part of v0.5 ship — listed in §10 below).

### 7.3 Privacy + APP compliance

- Email captured at the end of the flow is the only PII. No name, no phone, no identifier beyond email.
- Per APP 1: a user-facing privacy notice block is rendered on the email-gate page describing what's collected and that it goes into the existing email-marketer pool. Copy is operator-owned; default draft is part of Phase 4.
- Per APP 6: data is used only for results delivery + the v1.0 re-engagement broadcast. The consent checkbox on the email gate is the lawful basis.
- Per APP 11: HTTPS-only; service-role keys never exposed client-side; no third-party analytics on the public surface beyond the existing project setup.

### 7.4 Telemetry

Reuse the project's existing telemetry layer (Plausible + Sentry from E1). Events:
- `assessment_started`
- `assessment_question_answered` (no question content; just category + correctness)
- `assessment_time_bucket_selected` (bucket only)
- `assessment_completed` (with anonymised category-failure profile — no email)

**Never logged**: email, individual answers, attempt_id-to-email linkage.

### 7.5 Bot screening

v0.5 ships without aggressive bot screening. Lightweight signals only: store `user_agent`; soft rate-limit on `/assessment/start` (one new attempt per IP per 5 min). If post-launch reveals significant bot traffic skewing the histogram, hCaptcha or similar can be added in v0.5.x — listed as Risk R4 below.

---

## 8. Phase plan

The phase split below is the **proposed shape** the operator approves. Each phase has a clear exit gate.

### Phase 0 — Pre-implementation sub-spec resolution (dev findings)

**Goal**: resolve the small set of dev-layer findings raised in §9 below before any code is written. PM/operator answers the 3 D-questions; dev locks the citation copy with operator input.

**Gate**: `tasks.md` Phase 0 closed; citation text for all 35 questions exists in operator-approved form.

### Phase 1 — Supabase migrations + seed (data layer)

**Goal**: all six tables exist with RLS; the 35 questions are seeded as v1 rows.

**Gate**: smoke test reads 35 question current-versions from a fresh DB. RLS test confirms anonymous cannot SELECT `assessment_attempts`.

### Phase 2 — Public assessment surface (the lead magnet itself)

**Goal**: `/assessment/*` works end-to-end: start → 35 questions → time-commitment → email-gate → results page with per-category bars + weakest callout + citations on wrong + "coming soon" close. Email-marketer push is stubbed (no real wire-up yet).

**Gate**: Playwright happy path green; manual run-through confirms the UX matches spec §3.

### Phase 3 — Admin surface (HR-1 fulfilment)

**Goal**: `/app/admin/assessment/*` works end-to-end: list, edit, publish (versioned with in-flight pin), pause/unpause, audit log view. The `currency_review_due` filter is wired.

**Gate**: Playwright happy path covers a full edit cycle; in-flight pin integration test (§6.2) passes; cross-tenant admin RLS test passes (a non-admin user cannot publish).

### Phase 4 — Email-marketer wiring + weakest-category tagging

**Goal**: real push to the email-marketer pool (vendor-confirmed in D03). Merge fields written. Soft-fail behaviour verified.

**Gate**: end-to-end test against the email-marketer sandbox (or test pool); operator confirms the merge fields landed correctly in the pool dashboard.

### Phase 5 — FY-rollover safety + accessibility audit

**Goal**: currency gate verified end-to-end (paused question → category shrinks, no stale serve); axe-core clean on public + admin; keyboard walkthrough documented.

**Gate**: WCAG 2.1 AA zero violations on the audit; currency-pause Playwright path passes; admin filter shows paused question with a clear badge.

### Phase 6 — QA handoff + ship

**Goal**: developer hands off to QA per `dev-qa-delegation`; QA report green; PR opened and merged.

**Gate**: PR merged to `main`; Vercel preview deploy verified; operator signs off on the live surface.

---

## 9. Dev findings (raised during this planning pass)

Three findings surfaced while writing this plan. Severity: how much they block v0.5 implementation.

### D01 · HIGH · Citation copy source-of-truth ownership

**Finding**: spec §4 specifies "every wrong answer surfaces a one-line citation back to the relevant Fair Work / ATO / state-revenue authority", but the question bank itself (`question-bank.md`) does not include citation text. The seed migration (`20260611_assessment_seed.sql`) cannot populate `assessment_question_versions.citation_text` without that copy.

**Severity**: HIGH — blocks Phase 1 (the seed migration). v0.5 cannot ship without citation text.

**Resolution path**: operator drafts a one-line citation per question (35 lines total) before Phase 1 starts. Recommended format: `<Source> — <Section/topic>` (e.g. "Fair Work Act 2009 s.536 — payslip timing"). Dev pre-fills a draft for operator review based on the question content.

### D02 · MEDIUM · Email-marketer vendor not yet identified

**Finding**: spec §3 names "Brevo or Resend, whichever the email-marketer agent is already on", but the email-marketer agent's project persona (`agents/email-marketer/context/persona.md`) is still the default template — no vendor committed. The push-completion client (`src/server/email-marketer-client.ts`) cannot be written without knowing which SDK to bind to.

**Severity**: MEDIUM — blocks Phase 4 (the email-marketer wire-up). Phases 1–3 can proceed in parallel without resolving this. By Phase 4 start, the operator/email-marketer agent must have chosen.

**Resolution path**: operator confirms vendor before Phase 4 kicks off. Both SDKs are well-supported; the choice is operational (which existing pool do we want this audience added to). Dev recommendation: whichever vendor is already wired up for the existing newsletter (zero net-new integration work).

### D03 · LOW · Public-surface design tokens partially in flight (E6.4 dependency)

**Finding**: spec depends on E6.4 (public re-skin tokens). E6.4 may not be fully landed at v0.5 ship time. The public assessment surface needs a coherent visual language at launch even if E6.4 isn't fully ready.

**Severity**: LOW — does not block Phases 1–4. Can ship with whatever public-surface tokens exist at the time; a follow-up restyle task is appended to v0.5.x.

**Resolution path**: dev applies whatever public-surface tokens exist; flags any visual coherence gaps in the QA handoff; a "token-update pass" task is queued in `docs/plans/` for after E6.4 finalises.

---

## 10. Out of scope (explicitly v1.0 work — do NOT plan in v0.5)

The following are deferred to v1.0 per spec §6 and §8. They are flagged here so any v0.5 task referencing them is treated as scope drift:

- **Course catalogue ingestion** — no `assessment_courses` table, no YAML, no APA-API integration in v0.5.
- **Recommender layer** — no scoring → course mapping logic, no "Top 3 recommended courses" component.
- **Booking-link CTAs** on the results page — replaced by the "coming soon" close.
- **Time-budget filtering against course durations** — the time bucket is collected but not consumed.
- **Re-engagement broadcast** — the email-marketer pool gets the consent + segmentation data, but the broadcast itself is post-v1.0.
- **In-platform `/app/*` placement** of the assessment for authenticated users — v0.5 is public-surface only (OQ-KA-1).
- **Banded scoring** (Beginner / Competent / Expert) — explicitly excluded per spec §6.
- **Pass/fail single threshold** — explicitly excluded.
- **Citations on correct answers** — explicitly excluded.
- **Mid-quiz or front-loaded email gate** — explicitly excluded.
- **Session lockout on re-takes** — explicitly excluded.
- **LLM-generated explanation copy** — explicitly excluded; citations are curated operator copy only.

---

## 11. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Currency-pause behaviour mismatches operator expectation on 1 July (operator expects a fail-safe shutdown, gets a graceful category-shrink, or vice versa) | Medium | Medium | Explicit operator review of the §1.4 fallback contract at the end of Phase 0; Phase 5's currency-pause Playwright test exercises the actual behaviour for operator sign-off; admin list view shows paused questions with a 🚨 badge so the SLA is visible-by-default |
| R2 | In-flight version pin breaks under unexpected race (e.g., admin publishes between answer record and next-question fetch) | Low | High (silent inconsistency in a respondent's session — spec §3 forbids) | Pinning happens at attempt-start: `assessment_attempts` could optionally cache the version_id map for the attempt's lifetime (small jsonb column). Alternative: every question render reads the version that was current at `attempt.started_at`, not `now()`. Phase 2 task explicitly tests the race; Phase 3 task adds the integration test |
| R3 | E6.4 public re-skin tokens not landed at v0.5 ship time, leaving the public assessment surface visually inconsistent with the LSL calculator brand | Medium | Low–Medium (cosmetic, not functional) | Accept the cosmetic risk; queue a v0.5.x follow-up "token-update pass" once E6.4 finalises; do NOT block v0.5 ship on E6.4 |
| R4 | Bot traffic skews the per-category failure histogram, undermining the market-research signal that v0.5 is partly there to produce | Medium | High (the histogram is the load-bearing v0.5 success metric per spec §5) | Lightweight v0.5 defences (rate limit, user_agent log); add hCaptcha or equivalent in v0.5.x if post-launch telemetry shows skew; analytical view filters obvious bot signatures before histogram computation |
| R5 | Email-marketer vendor (Brevo vs Resend) chosen late, delays Phase 4 | Low | Medium (Phase 4 cannot start without it) | D02 resolution path makes vendor choice a Phase 0 deliverable, not a Phase 4 blocker — operator confirms before code is written |
| R6 | Citation copy for some questions is contentious (e.g. multi-source rules where one citation feels inadequate) and operator + dev disagree on wording | Medium | Low | D01 has dev draft + operator review built in; Phase 0 ends with all 35 citations operator-approved; disagreements escalate to the PM agent if blocked > 2 days |

---

## 12. References

- Spec: `.specify/features/008-knowledge-assessment/spec.md` v0.5 SPEC LOCKED 2026-06-10
- Question bank: `.specify/features/008-knowledge-assessment/question-bank.md` (locked 2026-06-10)
- Course mapping (HELD): `.specify/features/008-knowledge-assessment/course-mapping.md`
- E5.3 versioning pattern this plan mirrors: `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` §4.1–4.2
- E5.1 auth slice (admin gate): `.specify/features/005-lsl-platform/sub-specs/auth.md`
- Gold-standard impl plan reference: `.specify/features/001-nsw-calculator/impl-plan.md`
- Epics: `docs/product/epics.md` E8 narrative
- Product: `docs/product/product.md`
- Folder structure: `templates/project-scaffold/FOLDER-STRUCTURE.md`
- Engineering rules: `~/.claude/rules/global-engineering.md`
