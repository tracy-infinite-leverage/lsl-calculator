# PM sign-off record — pre-launch

For task 6.3 (PM signs off on policy + privacy notice) per
`.specify/features/001-nsw-calculator/tasks.md`.

---

## Privacy notice (`/privacy`)

**Status: SIGNED OFF · Tracy Angwin · 2026-05-23**

Tracy reviewed the rendered `/privacy` page on the dev server and
approved without changes (chat record 2026-05-23: "its fine").

Approved version: commit `9820d6e` and subsequent (no further edits to
the page content; only footer-link addition + new privacy-page a11y
test in commit `556cd28`).

---

## Data-handling policy (`docs/engineering/data-handling-policy.md`)

**Status: SIGNED OFF · Tracy Angwin · 2026-05-23**

The policy doc was lifted directly from impl-plan §8 (which Tracy
previously signed off as part of the planning artifact). The lift
updated it to reflect the actual built state — Vercel-native
telemetry replacing the planned Plausible+Sentry, and server-side
text extraction (binary PDFs never reach Anthropic).

Tracy declined a deep read on the basis that the underlying claims
hadn't changed materially from the impl-plan version and the user-
facing `/privacy` page (which surfaces the same claims in plain
English) was already approved.

Caveat captured in the file itself (and the `docs/launch/LAUNCH-GUARD.md`
file): the claim "Anthropic operates under a no-retention contract"
becomes accurate only once Anthropic confirms ZDR is **active** on
the production API key. This sign-off is conditional on that ZDR
confirmation landing before production traffic starts.

---

## Sign-off chain — full

1. **Privacy notice** ✓ Tracy 2026-05-23 (reviewed on dev server)
2. **Data-handling policy** ✓ Tracy 2026-05-23 (signed off conditional on ZDR)
3. **ZDR active confirmation** ⏳ awaiting Anthropic
4. **Production cutover** ⏳ blocked on #3
