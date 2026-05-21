---
name: pm-epic-writing
description: Full discovery-to-epic workflow. Runs speckit-specify → speckit-git-feature → speckit-clarify → pm-clarify-guard → speckit-analyze → pm-analyze-split → writes Dan Shipper epic entry to docs/product/epics.md → creates/updates docs/product/epic-status.md → hands off to developer agent. Triggered when the PM says "write a new epic", "specify a feature", or when a client interview has produced a new idea.
---

# PM: Epic Writing — Full Discovery Workflow

Translates a client idea into a fully specified epic with a feature branch and a dev handoff package. No client input is required after the initial idea is captured.

Every epic must pass this test: *"If you read only the title and the problem statement, you know exactly what bet we're making."*

---

## Inputs

- **Feature idea**: a sentence or paragraph from the client describing what they want to build
- **Product context**: `docs/product/product.md` (required — read before step 1)
- **Existing epics**: `docs/product/epics.md` (read before step 5 to check for duplication)

---

## Step 1 — Load product context

Read `docs/product/product.md` in full. Confirm you understand:
- The core problem the product solves
- Who the target user is
- What the product is explicitly NOT building

If `docs/product/constitution.md` exists, read it now. Constitution violations are a hard gate later.

---

## Step 2 — Run speckit-specify

Invoke **speckit-specify** to translate the client idea into a structured spec.

Inputs:
- Feature name (slug and display name — derive from the idea if not given)
- The client's feature description as the seed context

Output: `.specify/features/{slug}/spec.md`

The spec must include:
- Executive Summary (one paragraph)
- MUST / SHOULD / MAY requirements
- Success Criteria (user-outcome measurable)
- Acceptance Criteria (testable conditions, one per requirement)

Do not proceed to Step 3 until spec.md is written.

---

## Step 3 — Run speckit-git-feature

Invoke **speckit-git-feature** to create a feature branch for this work.

Branch naming: sequential (`001-{slug}`) or timestamp (`YYYYMMDD-HHMMSS-{slug}`).

If git-feature fails or the project has no git repo: warn and continue on the current branch — do not block the workflow.

---

## Step 4 — Clarify then filter

### 4a — Run speckit-clarify

Invoke **speckit-clarify** on `.specify/features/{slug}/spec.md`.

speckit-clarify generates 5–10 candidate questions. Do NOT present them to the client yet.

### 4b — Run pm-clarify-guard

Invoke **pm-clarify-guard** on the candidate question list.

pm-clarify-guard:
- Removes or rephrases all technical questions (API design, DB choice, framework, architecture, performance SLAs in engineering units)
- Caps output at 5–8 business-level questions
- Rephrases borderline questions in user-outcome terms

Present only the filtered, business-level questions to the client. Collect answers.

### 4c — Write answers back to spec

Apply the client's answers to `.specify/features/{slug}/spec.md`:
- Tighten acceptance criteria
- Add detail to ambiguous sections
- Add a Clarification Summary block at the end of the spec
- Bump the spec version (semver)

---

## Step 5 — Analyze then split

### 5a — Run speckit-analyze

Invoke **speckit-analyze** on `.specify/features/{slug}/spec.md`.

speckit-analyze returns a findings table: ID | Issue | Section | Severity | Remediation.

### 5b — Run pm-analyze-split

Invoke **pm-analyze-split** on the findings table.

pm-analyze-split routes findings to two layers:

**PM layer** (surface to client — business language only):
- Business goal conflicts with `docs/product/product.md`
- Epic-to-epic duplication with `docs/product/epics.md`
- Success criteria unmeasurable from a user/business perspective
- Missing acceptance criteria for a MUST requirement
- Constitution misalignments (if `docs/product/constitution.md` exists)

Present PM-layer findings to the client as a clean business-language table.

**Gate**: If any PM-layer finding is HIGH severity, resolve it before proceeding to Step 6.
MEDIUM and LOW findings: note them, offer to address, but do not block.

**Dev layer** (do not surface to client):
pm-analyze-split writes dev-layer findings (missing data models, ambiguous NFRs, technical underspecification) to `.specify/features/{slug}/dev-findings.md`. This file is consumed by the developer agent in Step 7.

---

## Step 6 — Write the epic entry

### 6a — Read existing epics

Read `docs/product/epics.md`. Check for duplication. If an existing epic covers the same problem space, propose merging — do not create a duplicate.

### 6b — Write the Dan Shipper epic entry

Append to `docs/product/epics.md` (create the file with the opening block if it does not yet exist):

**Opening block** (write once, on file creation):
```
These are thematic bundles of work. Each epic makes a bet on user behavior — a specific problem that, if solved, unlocks a meaningful outcome. Epics are not a sprint backlog.
```

**Epic format** (strict — no deviations):
```
## E{N} · {Epic Name}

**The problem:** {One sentence: the specific user frustration or gap this epic addresses}
**The mechanism:** {One sentence: the causal chain — how solving this produces the outcome}
**What it bundles:**
- {Feature or component 1}
- {Feature or component 2}
**What success looks like:** {Specific, measurable — number + date or behaviour threshold}
**Why it goes first:** {One sentence: dependency, risk reduction, or fastest learning}

_Spec: `.specify/features/{slug}/spec.md`_
```

Never use these fields — they belong in task plans: Thesis, Hypothesis, Acceptance criteria, Definition of done, Priority signal.

After all epics, update (or create) the **Sequence argument** section explaining why this ordering and not another.

### 6c — Assign epic number

Epic numbers are sequential integers (E1, E2, E3…). Read existing epics to determine the next number.

---

## Step 7 — Create or update epic-status.md

If `docs/product/epic-status.md` does not exist, create it with:

```markdown
# {Product Name} · Epic Status · Last updated: {YYYY-MM-DD} · Phase in flight: Phase 1

## Pipeline stages

| Stage | Gate question |
|-------|---------------|
| 1 · Specified | Is there a written spec with acceptance criteria? |
| 2 · In flight | Is active development underway? |
| 3 · Feature-complete | Does it meet every acceptance criterion? |
| 4 · Tested | Have all tests passed? |
| 5 · Shipped | Is it deployed and measurably impacting users? |

Status glyphs: 🔄 in flight · ✅ done · ⏳ partially done · ☐ planned · 🛑 paused

## At a glance

| Epic | Status | % done (est) | Pipeline | Open bugs | Closed bugs | Notes |
|------|--------|--------------|----------|-----------|-------------|-------|

## Drilldown

## Obsolete / won't fix
```

If the file exists, add a new row to the **At a glance** table for the new epic with status `☐ planned` and pipeline `○○○○○`.

---

## Step 8 — Hand off to developer agent

Print the following for the developer agent (not the client):

```
EPIC WRITTEN — DEVELOPER HANDOFF
─────────────────────────────────
Epic    : E{N} · {Epic Name}
Branch  : {branch name from Step 3}
Spec    : .specify/features/{slug}/spec.md
Dev findings : .specify/features/{slug}/dev-findings.md ({count} findings, {HIGH count} HIGH)

TO START DEVELOPMENT:
Invoke dev-planning with this spec path:
  .specify/features/{slug}/spec.md

dev-planning will route to dev-feature-plan, which resolves dev findings and produces:
  .specify/features/{slug}/impl-plan.md
  .specify/features/{slug}/tasks.md
```

---

## Epic writing rules

- **One bet per epic**: each epic addresses exactly one user problem. If a new idea spans two problems, split it.
- **No horizontal slicing**: epics are not tech layers ("Build the API", "Build the UI"). They are user-outcome bundles.
- **Success is measurable**: "improve performance" is not an epic. "Reduce task completion time from 5 minutes to 90 seconds for 80% of users by Q3" is.
- **Sequence argument is required**: every epic must explain why it goes where it does in build order.
- **No timeline in epics.md**: delivery dates belong in `docs/product/01-product-timeline.md`, not in epic entries.
