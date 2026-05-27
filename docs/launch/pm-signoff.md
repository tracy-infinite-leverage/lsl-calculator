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

Originally drafted assuming Anthropic ZDR would be active before
launch. Tracy decided 2026-05-23 to launch on Anthropic's standard
tier rather than wait for ZDR — both the policy doc and the
user-facing privacy notice were rewritten to accurately reflect
Anthropic's standard commercial terms (no training on customer
data; up to 30 days retention for service operation and abuse
monitoring).

Standard-tier rewrite approved without further conditions.

---

## Sign-off chain — full

1. **Privacy notice** ✓ Tracy 2026-05-23 (standard-tier rewrite approved)
2. **Data-handling policy** ✓ Tracy 2026-05-23 (standard-tier rewrite approved)
3. **Production cutover** ✓ unblocked 2026-05-27 — `ANTHROPIC_API_KEY` LAUNCH-GUARD gate closed by elimination via PDF Removal slice (`feat/E5.0-pdf-removal`)
4. **ZDR upgrade** N/A — no longer relevant; Anthropic SDK removed from codebase 2026-05-27
