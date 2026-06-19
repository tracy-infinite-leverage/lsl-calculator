# Course Mapping — Data Shape (Placeholder)

**Status:** Scaffolded 2026-06-10. **Data shape only — no real catalogue ingested yet.** **HELD until v1.0 (the recommender layer).** Per the phase split in `./spec.md` (2026-06-10), the APA video courses do not yet exist, so this file stays in placeholder form. v0.5 ships the assessment lead-magnet *without* a recommender — the time-commitment input is collected but no courses are surfaced. This file is reopened when ≥ 6 APA courses exist (one per category) with stable `course_id` / `title` / `duration_bucket` / `booking_url` fields.

The four open questions blocking population (OQ-KA-9, OQ-KA-11, OQ-KA-12, OQ-KA-13) are explicitly deferred to v1.0 — see `./spec.md` §8.

This file defines the shape the recommender consumes. Real course IDs / titles / durations / booking links go here once the APA catalogue is confirmed in v1.0.

## 1. Course catalogue

The recommender reads from a flat list of courses. Each course has the shape below.

| Field | Type | Notes |
|---|---|---|
| `course_id` | string | Stable APA course code (e.g. `APA-TRM-101`). Source of truth. |
| `title` | string | Display name. |
| `category_tags` | string[] | One or more of: `fair-work`, `super`, `payroll-tax`, `leave`, `terminations`, `end-of-year`. Used by the recommender to match against weak categories. |
| `duration_hours` | number | Estimated time to complete. Used to filter against the respondent's declared time budget. |
| `duration_bucket` | enum | Derived (or stored): `≤1h` / `half-day` / `1-day` / `multi-day`. Bucket boundaries: ≤ 1 / 1–4 / 4–8 / > 8 hours. |
| `format` | enum | `self-paced` / `live-online` / `in-person`. |
| `price_aud` | number \| null | If applicable. |
| `booking_url` | string | Deep-link to the booking page; primary CTA in the recommendation card. |
| `prereq_course_ids` | string[] | Optional. Don't recommend a course if its prereqs are unmet (treat respondent's "correct" categories as proxy for prereq-met). |
| `priority_weight` | number | Optional. Tie-breaker when multiple courses match a gap; higher wins. |

### Example row (illustrative — not a real APA course)

```yaml
- course_id: APA-TRM-101
  title: "Termination Payments — Tax & ETP Essentials"
  category_tags: [terminations]
  duration_hours: 2
  duration_bucket: half-day
  format: self-paced
  price_aud: 295
  booking_url: https://austpayroll.com.au/courses/trm-101
  prereq_course_ids: []
  priority_weight: 10
```

## 2. Question / category → course mapping

Per OQ-KA-11, the recommended default is **category-level primary with per-question overrides for high-signal items**. Concretely:

### 2a. Category-level mapping (primary)

Each of the 6 categories maps to one or more courses. If a respondent gets, say, 4/6 wrong in Terminations, the recommender pulls every course tagged `terminations` and filters/ranks by their time budget.

| Category | Default course tag | Notes |
|---|---|---|
| Fair Work Compliance | `fair-work` | |
| Superannuation | `super` | |
| Payroll Tax | `payroll-tax` | |
| Leave | `leave` | |
| Terminations | `terminations` | |
| End of Year / STP | `end-of-year` | |

### 2b. Per-question override (optional, for high-signal items)

Some questions probe a *specific* topic precise enough to warrant a more targeted course than the category default. Example: Q22 (LSL accrual exceptions for NT + SA) maps to a state-specific LSL module rather than the generic Leave bundle. Per-question overrides are sparse; most questions inherit the category mapping.

Shape:

```yaml
- question_id: Q22
  override_course_ids: [APA-LSL-NT-101, APA-LSL-SA-101]
  rationale: "State-specific LSL accrual is a sharper recommendation than the generic Leave bundle."
```

The recommender resolves a question's recommended courses by: `override_course_ids ?? courses_matching(category_tag)`.

## 3. Recommender logic (provisional)

Given a completed assessment:

1. **Compute gap profile.** Per category: `incorrect_count / total_in_category`. Categories with `gap_ratio ≥ 0.34` (≥ 2/6 wrong, or ≥ 2/5 for End-of-Year) are "weak"; `0.17 ≤ gap_ratio < 0.34` is "borderline"; below that is "strong".
2. **Pull candidate courses.** For every weak category, gather all courses with that category tag. Apply per-question overrides for any incorrect high-signal questions, replacing the category default.
3. **Filter by time budget.** Drop any course whose `duration_bucket` exceeds the respondent's declared budget. Exception: if the result set is empty after filtering, surface the smallest-bucket course per weak category under a "stretch recommendations" section labelled "these exceed your stated time but address your largest gaps".
4. **Rank.** Sort by (gap severity desc, priority_weight desc, duration_hours asc).
5. **Cap.** Surface the top N (default N=3 for short attention spans; configurable per OQ-KA-2 scoring-rubric outcome).
6. **Empty-result fallback.** If the respondent has no weak categories, fall back to the OQ-KA-12 decision (advanced modules / membership upsell / silent skip).

## 4. Editing this file (HR-1)

Both the catalogue and the mapping must be editable without a code deploy. Resolution of OQ-KA-7 (markdown PR vs admin UI vs Supabase + CMS) decides where the canonical store lives. Until then, this markdown file is the placeholder canonical source.

## 5. Open items blocking population

All v1.0 — held until ≥ 6 APA courses exist and the v1.0 spec is opened.

- **OQ-KA-9** — get the real APA catalogue (course IDs, durations, booking URLs). v1.0 prerequisite.
- **OQ-KA-11** — confirm mapping granularity (category vs question-level overrides). v1.0; depends on catalogue shape.
- **OQ-KA-12** — empty-recommendation fallback semantics. v1.0; depends on whether the catalogue offers advanced/CE tiers.
- **OQ-KA-13** — zero-time-budget fallback semantics. v1.0; depends on whether the catalogue has any sub-hour modules.
- **OQ-KA-10** — confirm the four time-commitment buckets. **Resolved in v0.5 spec §7** — four buckets locked (`≤ 1 hour` / `half-day (2–4 hours)` / `1 full day (6–8 hours)` / `multi-day (>1 day)`), pending operator sign-off. Recorded here for cross-reference.
