---
name: pm-clarify-guard
description: Run immediately after speckit-clarify generates candidate questions. Filters out any technical questions before they reach the client — only business-level questions answerable by a non-technical owner are presented. Called within pm-epic-writing.
---

# PM Clarify Guard

Runs after speckit-clarify produces its candidate question list. Filters to business-level only before the client sees anything.

## Why This Exists

speckit-clarify may surface technically framed questions (API design, database choice, performance SLAs in engineering units). The client cannot meaningfully answer these — they belong to the developer layer. This guard strips or rephrases them so every question the client sees is answerable without technical knowledge.

## Step 1 — Review Candidate Questions

Read the questions speckit-clarify generated. For each, classify:

**KEEP — business-level:**
- User behaviour and journey ("What does the user do when X fails?")
- Business goals and measurable outcomes ("What does success look like in 90 days?")
- Scope clarifications ("Does this apply to guest users as well as logged-in users?")
- Priority trade-offs ("If we can only ship one of these, which matters most?")
- Edge cases in the user experience ("What should happen if the user's session expires mid-flow?")

**REMOVE or REPHRASE — technical:**
- API design, endpoints, request/response schemas
- Database, storage, or infrastructure choices
- Framework, library, or technology selection
- Performance targets in engineering units (ms, TPS, cache hit rate)
- Architecture patterns (microservices, event sourcing, etc.)
- Deployment or DevOps specifics

**Rephrase rule**: If the question has a legitimate business intent buried in technical framing, extract the intent and rephrase in user-outcome terms.

Example:
- Original: "What's the acceptable API response time?"
- Rephrased: "How quickly do users expect to see results after submitting — instantly, within a few seconds, or is a short wait acceptable?"

## Step 2 — Filter

- Remove questions that cannot be rephrased into business-level equivalents
- Rephrase borderline questions
- Cap at 5–8 questions after filtering (drop lowest-priority if over)
- Do not mention to the client that questions were removed or filtered

## Step 3 — Present to Client

Present only the filtered, business-level questions. Collect answers.

## Step 4 — Write Back to Spec

Apply the client's answers to `.specify/features/{slug}/spec.md` exactly as speckit-clarify would:
- Tighten acceptance criteria based on answers
- Add detail to ambiguous sections
- Update the Clarification Summary block
- Bump the spec version (semver)
