# Feature 008 · Payroll Knowledge Assessment

**Slug:** `knowledge-assessment`
**Feature number:** 008
**Status:** **v0.5 SPEC LOCKED — operator-signed-off 2026-06-10.** Phase-split: v0.5 (assessment lead-magnet, ships standalone) + v1.0 (recommender layer, ships when ≥ 6 courses exist). Question bank locked. Nine v0.5 OQs operator-resolved (§7); four OQs deferred to v1.0 (§8); two carried OQs (OQ-KA-14/15) tracked for awareness.
**Author:** Product Manager (scaffold 2026-06-10; phase-split + narrative pass 2026-06-10)
**Owner:** Tracy Angwin (austpayroll.com.au)
**Depends on:** E6.4 (public re-skin tokens) for visual coherence on the marketing surface. No platform dependency for v0.5 — assessment lives on `lslcalculator.com.au` as a stateless flow with email capture into the existing email-marketer pool. v1.0 recommender layer depends on the APA course catalogue existing.
**Related epic:** E8 · Payroll Knowledge Assessment (see `docs/product/epics.md` — narrative there is the previous all-in-one version; this spec supersedes the phasing inside it).

---

## 1. Executive summary

A free, browser-based 35-question multiple-choice payroll-compliance assessment, gated on email, scored per-category, with citations on incorrect answers and a self-declared "how much time can you commit to upskilling?" input collected before the score is shown. Ships in two phases:

- **v0.5 — Assessment lead-magnet (ships first, standalone).** The 35 questions, scoring, per-category gap analysis, citations on incorrect answers, email capture, time-commitment input *collected but not yet acted on*, and an editable-content surface (HR-1). The results page closes with "detailed course recommendations are coming soon — we'll email you when they're ready." That sentence is the bridge to v1.0 and the consent hook for a re-engagement broadcast later.
- **v1.0 — Recommender layer (ships when ≥ 6 APA courses exist, one per category, with `course_id` / `duration_bucket` / `booking_url`).** Recommender wired against the real catalogue. Time-budget filter applied. Booking-link CTAs on the results page. Re-engagement broadcast to every v0.5 respondent.

The phase split exists because the APA video courses **do not exist yet** as of 2026-06-10. The original epic assumed a populated catalogue; that assumption is dead. Rather than block the whole feature on course production, we ship the lead-magnet now and treat v0.5 itself as a **market-research instrument** — real respondent data tells the operator which category is most-failed in the wild, which is the signal for which course to film first.

**The wedge for v0.5 specifically.** The assessment is the cheapest, sharpest path to two outcomes that compound: (a) email captures from the exact buyer the LSL Calculator already converts (payroll managers and team leads), enriched with per-category gap data the existing nurture pool does not have, and (b) a real-world failure histogram across the six payroll-compliance domains that tells the operator where to invest scarce video-production budget first. v0.5 does not depend on the v1.0 recommender to be valuable; v1.0 depends on v0.5 having shipped to be possible.

---

## 2. Problem (v0.5)

Payroll managers and team leads have nowhere to self-diagnose their own knowledge gaps across the load-bearing compliance domains — Fair Work, Super, Payroll Tax, Leave, Terminations, and end-of-year STP. The cost of not knowing isn't abstract: an SG-rate miss is an SG-charge plus interest; an LSL accrual error is the entire variance E5.6 is designed to surface; a wrongly-classified termination payment is a tax-office finding. Industry bodies publish general guidance and run paid workshops; neither produces a personalised "here's where you specifically are weak" diagnostic in 10 minutes for free.

The buyer the LSL Calculator already converts (payroll manager) is also the buyer who would self-administer a short knowledge assessment if the brand promise behind it were "deterministic, defensible, legislation-traceable" — the same promise the LSL engines already keep. We have the audience, the channel (APA member portal + organic), the citation pattern, and the editorial credibility. We do not yet have a diagnostic instrument. v0.5 is that instrument.

Adjacent to the respondent's problem is the operator's. The APA video-course catalogue is currently empty. There are six categories of payroll-compliance pain we *could* film a course for. We don't know which to film first. A diagnostic completed by hundreds of payroll managers tells us — directly, by category-level failure rates — which course will have the largest addressable market on day one. v0.5 doubles as that signal-collector.

---

## 3. Mechanism (v0.5)

A stateless Next.js page on the public marketing surface (`lslcalculator.com.au/assessment` — surface decision below). The respondent:

1. Lands on a short intro page describing what the assessment is and how long it takes (~10 minutes). One CTA: "Start the assessment."
2. **Email is captured at the end, not the front** (see §6 OQ-KA-3 resolution). The respondent works through the assessment without friction.
3. Works through 35 multiple-choice questions, six categories, presented in category order with a category header on each block (Fair Work → Super → Payroll Tax → Leave → Terminations → End of Year / STP). One question per screen. Progress bar at top. No back-tracking in v0.5 — once a question is answered the respondent moves forward (anti-cheating posture; see §6 OQ-KA-6).
4. Reaches the **time-commitment input** before scoring: "How much time can you commit to upskilling in the next 90 days?" with four buckets (≤ 1 hour / half-day 2–4 hours / 1 full day 6–8 hours / multi-day > 1 day). This input is **collected on v0.5 even though the recommender that consumes it does not exist yet**. The value: (a) it's the consent hook for the v1.0 re-engagement broadcast ("based on the time budget you told us about, here's the course"); (b) it segments the respondent in the email-marketer pool; (c) collecting it now means v1.0 ships with historical time-budget data on every existing respondent.
5. Reaches the **email gate**: "Enter your email to see your score and your personalised gap analysis." This is where the email capture happens. The respondent has invested 10 minutes; the friction cost of dropping out at this point is high; we maximise capture rate by gating the *reveal* rather than the *attempt*.
6. Sees the **results page**: per-category sub-scores with weakest-domain callouts (§6 OQ-KA-2 resolution), citations on incorrect answers (§6 OQ-KA-4 resolution), and a closing "Course recommendations are coming soon — we'll email you when they're ready."

Underneath:

- The question bank lives in a Supabase table edited via a thin admin UI under `/app/admin/assessment` (§6 OQ-KA-7 resolution). Versioned + audit-logged; in-flight sessions complete on the version they started with (§6 OQ-KA-8 resolution).
- Five FY-dated questions ship with a `currency_year` field; an annual refresh task on 1 July checks them against current legislation before reuse (§6 OQ-KA-5 resolution).
- Email capture flows straight into the existing email-marketer pool (Brevo or Resend, whichever the email-marketer agent is already on) with per-category sub-score and weakest-category as merge fields. This enables tailored nurture sequences per weak domain without writing six campaigns by hand.
- No course catalogue. No recommender. No booking links. The course-mapping data shape at `./course-mapping.md` stays in placeholder form until v1.0.

---

## 4. What it bundles (v0.5)

- **Question bank (locked).** 35 questions × 6 categories (Fair Work × 6, Super × 6, Payroll Tax × 6, Leave × 6, Terminations × 6, End-of-Year/STP × 5). Canonical source at `./question-bank.md`. Locked 2026-06-10.
- **Currency annotations.** Five FY-dated items flagged for annual review (Q7 SG rate, Q22 LSL state exceptions, Q26 redundancy indexation, Q27 WOI cap, Q31 STP finalisation due date). `currency_year` field on every question row; 1 July refresh SLA.
- **Editable content surface (HR-1).** Supabase `assessment_questions` table + `assessment_versions` table + thin admin UI at `/app/admin/assessment`. Operator edits a question; clicks "Publish"; new sessions see the new version; in-flight sessions complete on the version they started with. Every change is row-versioned and audit-logged (who, when, what changed). Initial seed is the markdown bank in `./question-bank.md`.
- **Time-commitment input (collected, not yet acted on).** Four buckets — `≤ 1 hour` / `half-day (2–4 hours)` / `1 full day (6–8 hours)` / `multi-day (>1 day)` (§6 OQ-KA-10 resolution). Stored on the response row; surfaced in email-marketer merge fields; not yet consumed by any UI on the results page beyond a "we'll match you to courses that fit your time" acknowledgement.
- **Surface.** Public marketing surface only in v0.5 — `lslcalculator.com.au/assessment` (§6 OQ-KA-1 resolution). No in-platform tool under `/app/*` in v0.5; that's revisitable post-v1.0.
- **Scoring rubric.** Per-category sub-scores with weakest-domain callouts (§6 OQ-KA-2 resolution). No single pass/fail threshold; no Beginner/Competent/Expert bands. The result page shows six bars — one per category — with the weakest category called out at the top ("Your biggest gap is Terminations — you got 2/6 correct").
- **Email gate position.** End — results gated behind email capture (§6 OQ-KA-3 resolution).
- **Citation depth.** Incorrect answers only (§6 OQ-KA-4 resolution). Every wrong answer surfaces a one-line citation back to the relevant Fair Work / ATO / state-revenue authority. Correct answers get a green tick with no extra clutter.
- **Re-take policy.** Unrestricted re-takes for the same email; no lockout; option order is **shuffled per attempt** to disincentivise pure memorisation (§6 OQ-KA-6 resolution).
- **Email capture + per-category segmentation.** Completion writes the email + per-category sub-scores + weakest-category + time-bucket into the email-marketer pool. Six pre-tagged nurture sequences (one per weak category) are the v0.5 follow-up mechanism — written by the email-marketer agent post-v0.5-ship.
- **Annual refresh SLA.** Every 1 July, before reuse of the FY-dated items, the operator runs a refresh pass via the admin UI. The refresh is a hard gate on continued use of the FY-dated questions — if the SG rate changes and Q7 hasn't been updated, Q7 is paused (returned `null` to the page rendering layer) until the operator publishes a refreshed version.
- **"Coming soon" close on the results page.** Last block on the result page is a single sentence: "Detailed course recommendations are coming soon — we'll email you when they're ready." This is the consent hook for the v1.0 re-engagement broadcast.

---

## 5. Success criteria (v0.5)

The v0.5 phase succeeds if it produces both a high-converting lead magnet *and* a usable category-failure histogram within 90 days of launch.

1. **Completion rate ≥ 55%** on assessments started. (Industry benchmark for a 10-minute quiz-style lead magnet is 40–60%; we target the upper half because the audience is high-intent.)
2. **Completion-to-email-capture ≥ 80%** (with the end-gated capture position, the friction is low and the investment is high — the respondent has already done the work).
3. **≥ 300 completed responses in the first 90 days** — enough sample size to make per-category failure rates statistically meaningful for the "which course should we film first" decision. Below this threshold the histogram is noise.
4. **No FY-dated question is wrong on 1 July of any FY** — annual-refresh SLA is a hard launch gate. The admin UI must include a `currency_review_due` filter so the operator can pull the 5 FY-dated items in one query each 1 July.
5. **No question, option, or category-mapping change requires a code deploy** — HR-1 is a hard launch gate. The operator must be able to fix a typo, swap an option, or re-tag a question in production via the admin UI in under 5 minutes from logging in.
6. **At least one category has a clear failure-rate lead by day 90** — the operator can point to one category and say "this is the course we're filming first" with statistical confidence. (If all six categories cluster within ±5pp of each other, that's also a useful answer — film the broadest course first.)
7. **Per-category nurture sequences are wired and sending within 14 days of v0.5 launch** — the email-marketer agent has the merge-field schema in hand from this spec; the actual content is downstream of v0.5 launch but the wiring is a launch dependency.

Note: v0.5 deliberately does *not* set a course-enrolment success metric — there are no courses to enrol in. That metric arrives with v1.0.

---

## 6. v0.5 phase boundary (in scope vs out of scope)

### In scope for v0.5

- 35-question assessment with locked bank and per-category structure
- Email capture at the end (results gated)
- Per-category sub-score results page with weakest-domain callouts
- Citations on incorrect answers only
- Time-commitment input collected pre-results (not yet acted on)
- Editable content via Supabase + admin UI under `/app/admin/assessment`
- Versioned content with in-flight session pinning
- Annual FY-rollover refresh workflow + admin filter
- Shuffled-option-order re-take policy
- Per-category merge fields written to the email-marketer pool
- "Coming soon" close on the results page
- Public marketing surface only (`lslcalculator.com.au/assessment`)
- E6.4 design tokens applied where they exist

### Out of scope for v0.5 (deferred to v1.0 or beyond)

- Course catalogue ingestion (blocked — catalogue does not yet exist)
- Course recommender logic
- Booking-link CTAs on the results page
- Time-budget filtering against course durations
- Re-engagement broadcast to v0.5 respondents (the *content* is written post-v1.0; the *consent* is captured in v0.5)
- In-platform version of the tool under `/app/*` (revisit post-v1.0)
- Banded scoring (Beginner/Competent/Expert) — explicit decision not to introduce a self-judgement label on top of the diagnostic
- Pass/fail single-threshold scoring — same reason
- Citations on correct answers — adds visual clutter, the brand-of-correctness argument doesn't justify the trade-off in v0.5
- Front-loaded email gate — gives up too much completion volume vs the end-gate
- Mid-quiz email gate — splits the worst-of-both-worlds path (loss to drop-off without gaining either intent signal or capture rate)
- Session lockout on re-takes — unfriendly to the legitimate "I want to share this with my team" use case
- LLM-generated explanation copy on incorrect answers (curated copy from the operator only in v0.5)

---

## 7. Resolutions — operator signed off 2026-06-10

The following resolutions apply to v0.5. Operator signed off on all nine 2026-06-10. The order matches the OQ-KA numbering in the original scaffold.

### OQ-KA-1 · Surface

**Resolution (locked 2026-06-10):** Public marketing surface only (`lslcalculator.com.au/assessment`). Defer in-platform `/app/*` placement until post-v1.0.

**Rationale:** The point of v0.5 is to be a lead magnet — to convert anonymous traffic into emails. Placing it inside the authenticated `/app/*` workspace gates it behind login, which inverts the funnel. The in-platform use case (a payroll manager already inside the workspace wants to test their own knowledge) is real but secondary, and post-v1.0 we can dual-surface trivially because the assessment is a stateless page with no platform dependency. v0.5 single-surface keeps the implementation small.

### OQ-KA-2 · Scoring rubric

**Resolution (locked 2026-06-10):** Per-category sub-scores with weakest-domain callouts. No pass/fail. No Beginner/Competent/Expert bands.

**Rationale:** The whole product promise is "we tell you specifically where you're weak so you can fix it." A single pass/fail score destroys that — a 23/35 score that's evenly distributed (4/6 per category) is not the same shape of weakness as a 23/35 score that's a 0/6 wipeout in Terminations and a 6/6 sweep everywhere else, and the recommender (v1.0) needs the per-category signal to function. Banded labels (Beginner/Competent/Expert) layer a self-judgement frame on top of a diagnostic, which encourages defensive interpretation rather than gap-acknowledgement. Per-category sub-scores with a "your biggest gap is X" callout is the diagnostic shape that maps cleanly to both the v1.0 recommender and the per-category nurture sequences.

### OQ-KA-3 · Email-gate position

**Resolution (locked 2026-06-10):** End — results gated behind email capture.

**Rationale:** The respondent has invested ~10 minutes by the time they hit the results page; the marginal friction of an email entry against the marginal payoff (their personalised gap analysis) is the best capture-rate configuration the funnel allows. Front-loaded email gates lose ~30–50% of starts industry-wide because the respondent has invested nothing and the offer is abstract. Mid-quiz gates are the worst of both — high enough drop-off to lose volume, low enough sunk-cost to fail to drive capture. End-gating is the highest-yield configuration for a 10-minute diagnostic.

### OQ-KA-4 · Citation depth

**Resolution (locked 2026-06-10):** Incorrect answers only.

**Rationale:** The brand-of-correctness argument ("we cite everything, like the LSL calc") is real but doesn't translate intact to a 35-question results page. Citing every correct answer adds 35 lines of legislation references to a page whose primary job is to highlight gaps — citations on correct answers compete for attention with citations on incorrect answers, which are the ones the respondent actually needs to read. Incorrect-only also encodes the editorial stance: we explain *why* you got it wrong with a one-line authority reference; we don't need to prove we know what right looks like on the things you already got right.

### OQ-KA-5 · FY-rollover SLA

**Resolution (locked 2026-06-10):** Annual refresh task scheduled for 1 July each year, executed before any FY-dated question is served on or after 1 July. Hard gate: an FY-dated question without an updated `currency_year` field returns `null` to the page-rendering layer rather than serving stale content. Admin UI exposes a `currency_review_due` filter that lists the 5 FY-dated items in one click.

**Rationale:** Five questions are FY-dated (Q7 SG rate, Q22 LSL exceptions, Q26 redundancy indexation, Q27 WOI cap, Q31 STP finalisation). Three of them are indexed/legislated annually (Q7, Q26, Q27); one is a stable rule that needs verification only (Q22, Q31). A passive "we should check these on 1 July" practice will silently fail one year and the assessment will serve a stale SG rate to a customer who notices. A hard refusal-to-serve gate is the only mechanism that guarantees correctness — it's the same brand-of-correctness logic that drives the LSL engines' deployment-gating test suite, applied to a much smaller content surface.

### OQ-KA-6 · Re-take policy

**Resolution (locked 2026-06-10):** Unrestricted re-takes for the same email. Option order shuffled per attempt. No session lockout.

**Rationale:** The assessment isn't an exam — it's a diagnostic, and we want the respondent to retake it to *measure progress*, not to *cheat* their way to a high score. Shuffled options between attempts disincentivises pure memorisation (you can't memorise "B is the answer to Q7" because B was a different option last time) while preserving the legitimate retake use case ("I took the courses, let me re-test"). Lockouts would punish the team-sharing use case ("I want to send this to my whole payroll team via my own login") and add support burden for no diagnostic value.

### OQ-KA-7 · Content-edit surface (HR-1)

**Resolution (locked 2026-06-10):** Supabase `assessment_questions` + `assessment_versions` tables, edited via a thin admin UI under `/app/admin/assessment`. Markdown bank in `./question-bank.md` is the initial seed and stays as the human-readable canonical reference for source-of-record arguments.

**Rationale:** Three options were on the table: markdown-PR (free audit trail, high author friction), in-app admin UI (low friction, needs build), CMS (lowest friction, vendor cost + adds infrastructure). For a 35-row content set that the operator personally maintains and edits maybe once a quarter (plus 5 rows annually for FY refresh), the admin-UI path is the right size — light enough to build inside a v0.5 sprint, native enough to the existing Supabase + Next.js stack to not add infrastructure, structured enough to enforce versioning + audit logging that markdown-PR alone doesn't give cleanly. A vendor CMS is overkill for 35 rows. Markdown-PR is too high-friction for the "operator notices typo at 9pm, fixes it in 2 minutes" use case the operator explicitly cares about.

### OQ-KA-8 · Edit-propagation semantics (HR-1)

**Resolution (locked 2026-06-10):** Versioned with in-flight session pinning. Edits go live on a "Publish" action. New sessions started after publish see the new version; in-flight sessions complete on the version they started with.

**Rationale:** The three options were (a) immediate visibility, (b) queue-until-publish, (c) versioned with in-flight pinning. Option (a) breaks in-flight sessions if the operator publishes a typo fix mid-session — the respondent sees question N in old wording and question N+1 in new wording, with internal inconsistency on the result page. Option (b) is functional but adds operator cognitive overhead (separate "edit" and "publish" steps for trivial fixes). Option (c) is the only one that lets the operator publish freely without breaking respondent experience, *and* preserves clean audit semantics — every response row stores the `version_id` it was scored against. This is the same versioning pattern E5.3 uses for pay-code mappings, so the implementation pattern is already proven inside this codebase.

### OQ-KA-10 · Time-commitment buckets

**Resolution (locked 2026-06-10):** Four buckets — `≤ 1 hour` / `half-day (2–4 hours)` / `1 full day (6–8 hours)` / `multi-day (>1 day)`. Stored as a typed enum on the response row.

**Rationale:** Four buckets is the right granularity — enough resolution for the v1.0 recommender to do meaningful filtering (a 30-minute module vs a 3-day workshop are clearly differentiated) without forcing the respondent into a fake precision they don't actually have ("can I commit 6 hours or 8 hours?" is not a question anyone can answer honestly). Bucket boundaries align with how APA already structures its training catalogue (short modules / half-day workshops / full-day intensives / multi-day certifications), so the v1.0 recommender's `duration_bucket` field maps one-to-one onto the respondent's declared bucket without conversion. Collecting this in v0.5 is value-additive (it's a segmentation signal for nurture sequences) and is the consent hook for v1.0's "based on the time you told us you have, here's the course" re-engagement broadcast.

---

## 8. Deferred to v1.0

The following open questions are blocked on the APA course catalogue existing. They cannot be answered in v0.5 because the answer requires inspecting the actual catalogue — which courses exist, how long each is, what the booking URL pattern looks like, and whether there are courses to recommend for every category. All four are reopened the moment ≥ 6 courses exist (one per category) with `course_id` / `title` / `duration_bucket` / `booking_url` fields populated.

- **OQ-KA-9 · APA catalogue source-of-truth.** Where the catalogue lives (Supabase table vs YAML in-repo vs external CMS vs APA-API). Defer until at least one real course exists to ground the choice in actual fields and update cadence.
- **OQ-KA-11 · Mapping granularity (category vs per-question overrides).** The recommendation in the scaffold (category-level primary with per-question overrides for high-signal items) is sound *in principle* but cannot be locked without seeing the actual catalogue shape. If the catalogue has six courses (one per category), per-question overrides are noise; if the catalogue has 30 courses with finer granularity, overrides become valuable.
- **OQ-KA-12 · Empty-recommendation fallback (100% score).** Decision shape depends on whether the catalogue offers "advanced / continuing-education" tiers worth recommending to a perfect-score respondent vs the "no courses needed — here's an APA membership" upsell path.
- **OQ-KA-13 · Zero-time-budget fallback.** What's shown to a respondent who picks `≤ 1 hour` and has six categories of gaps. Depends on whether the catalogue has any sub-hour modules — if it doesn't, the fallback shape is fundamentally different (curated micro-content snippets vs single highest-priority short module vs "the rest needs more time, bookmark it").

These four are explicitly held until the v1.0 prerequisites are met. The PM agent should not attempt to resolve them in v0.5.

---

## 9. v1.0 prerequisites (not v0.5 blockers)

For v1.0 to ship, the following must exist:

- ≥ 6 APA courses produced and bookable, with at least one course in each of the six categories
- Each course has stable `course_id`, `title`, `category_tags` (matching the assessment's category list), `duration_hours`, `duration_bucket` (matching the four time buckets), `booking_url`, and pricing
- An ingestion path for the catalogue (resolved as part of OQ-KA-9 at v1.0 spec time)
- Re-engagement broadcast content authored by the email-marketer agent ("your course is ready — based on your gap profile and the time budget you told us about, here's what we recommend")

None of these block v0.5. They are listed here so the operator knows what triggers v1.0 spec work.

---

## 10. Hard requirements (operator-locked) — applied to v0.5

- **HR-1: Editable at any time.** Questions, options, correct-answer designation, category mapping, citation text, and FY-dated `currency_year` field are all editable via the admin UI without a code deploy. Edits are row-versioned and audit-logged. In-flight sessions are pinned to the version they started with. Resolution per OQ-KA-7 and OQ-KA-8.
- **HR-2: Time-budgeted course recommendation.** Time commitment is **collected in v0.5** as the consent hook for v1.0 and as a segmentation signal in the email-marketer pool. The recommender layer itself ships in v1.0. The user-visible language on the v0.5 results page acknowledges "we'll match you to courses that fit your time" without surfacing courses — this is honest and sets up the re-engagement broadcast.

---

## 11. Files in this feature folder

- `./spec.md` — this file
- `./question-bank.md` — canonical locked source for the 35-question bank
- `./course-mapping.md` — data shape for the v1.0 recommender; stays in placeholder form until v1.0 is unblocked

---

## 12. What's done / What's not

### Done

- Question bank captured and locked (35 Qs × 6 categories, 2026-06-10)
- Currency-sensitive items flagged
- Phase split (v0.5 / v1.0) defined 2026-06-10 after operator confirmed APA video courses do not yet exist
- Resolutions proposed for the 9 v0.5-blocking open questions (this file, §7)
- 4 v1.0-blocked open questions explicitly deferred (this file, §8)
- Spec narrative upgraded to Dan-Shipper-style problem/mechanism/bundle/success/sequence pass

### Not done

- Operator sign-off on §7 proposed resolutions
- `docs/product/epics.md` E8 narrative refresh to reflect the phase split (held until operator signs off on §7 — this is intentional)
- `docs/product/epic-status.md` E8 row refresh to reflect the phase split (same hold)
- `speckit-plan` and `speckit-tasks` for v0.5 (held until §7 sign-off)
- UX wireframes for the assessment flow
- Email-marketer per-category sequence content
- Admin UI design + tokens (waits on E6.4 token availability for visual coherence)
- Timeline insertion in `docs/product/01-product-timeline.md` (held — operator owns timeline decisions)

---

## 13. Open questions surfaced during this pass (new — not in original 13)

Two open questions emerged while writing the phase-split that the operator should weigh in on before v0.5 implementation kicks off. Neither blocks the §7 sign-off but both will need answers before code lands.

- **OQ-KA-14 · v0.5 quiet-launch vs paid-acquisition test.** Is v0.5 supposed to live on the public marketing surface as an organic-traffic lead magnet only, or should we run a small paid-acquisition test (LinkedIn + Meta) to push enough volume through it inside 90 days to hit the ≥ 300 completions threshold for statistical significance? Organic traffic alone may not clear the threshold inside 90 days, which means the "which course should we film first" signal lags. PM recommendation pending data on current `lslcalculator.com.au` traffic — if monthly organic is ≥ 500 unique visitors, organic alone clears it; if not, a small paid test (~$500 budget) likely does.
- **OQ-KA-15 · Cohort tagging for v1.0 re-engagement broadcast.** When v1.0 ships, do we send the re-engagement broadcast to *every* v0.5 respondent, or only those who scored < 100% in the category we're announcing a course for? PM recommendation: tag every v0.5 response with weakest-category at completion time so the v1.0 broadcast can target precisely. This is a no-op for v0.5 dev work (already part of the per-category merge-field plan) but worth flagging so the email-marketer agent designs the segmentation up front.
