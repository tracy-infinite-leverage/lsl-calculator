# PDF Extraction Calibration — D05 / Task 3.9

**Status**: **SKIPPED in v1** — operator decision 2026-05-24. Default thresholds (aggregate `0.85`, per-field `0.7`) ship as-is. The remainder of this document is retained as historical context if calibration is ever revisited post-launch (trigger: production telemetry showing inappropriate banner behaviour).
**Owner**: n/a in v1.
**Linked**: `.specify/features/001-nsw-calculator/tasks.md` §3.9, `dev-findings.md` D05, `impl-plan.md` §4.4, Risk R1, `docs/launch/LAUNCH-GUARD.md` Documented Risk.

---

## Original plan (retained for reference, not executing in v1)

## Why this exists

The confidence-gate thresholds in `website/src/lib/lsl/parsers/pdf/confidence.ts`
are best-guesses, not measured values:

- **Aggregate warn threshold**: `0.85` — banner shown when worst aggregate is below this.
- **Per-field low-confidence threshold**: `0.7` — yellow section badge.

These were picked from Claude's self-reported confidence distribution on synthetic
fixtures during Phase 3 development. We need to verify they're actually useful on
real Australian payroll exports before launch — otherwise we either:

- Over-warn (banner appears on extractions that turn out to be perfectly correct → users learn to ignore it), or
- Under-warn (silent failures slip through the editable preview into the engine).

## What "done" looks like (Phase 6 launch gate)

1. **50 labelled real-world payroll PDFs** sourced from APA member contributions.
   Vendor mix should include Xero, MYOB, KeyPay, ADP, and at least one custom
   spreadsheet-export pattern. PII either redacted at source or processed
   inside Tracy's enterprise no-retention contract.
2. **Each PDF labelled** with the ground-truth values for: legal name, employee
   ID (if present), start date, employment type, current weekly gross, and
   wage-history row count.
3. **Run extraction** against each PDF via `/api/extract-pdf` in `single` mode
   (or `bulk` if multi-employee). Record: aggregate confidence, per-field
   confidence, field-by-field accuracy (exact match / off-by-one-day /
   off-by-cents / wrong / null), extraction time.
4. **Aggregate the results**:
   - Distribution of aggregate confidence across the 50 PDFs.
   - True-positive rate at the 0.85 threshold (how often does aggregate < 0.85
     correlate with at least one wrong field?).
   - False-positive rate at the 0.85 threshold (how often does aggregate ≥ 0.85
     accompany a wrong field that slipped through?).
5. **Tune the threshold** (if needed) and document the decision here. PM signs off
   the launch threshold value.

## Out of scope for this run (2026-05-23)

This calibration cannot be completed inside Phase 3 development because it depends
on real customer data we don't yet have. It's a Phase 6 launch gate — the dev
agent will return to this once the APA-sourced PDFs are available.

The current thresholds are documented as best-guess defaults. If APA sourcing
slips, the launch decision is between:

- (a) Ship with the current 0.85 / 0.7 defaults and gather telemetry post-launch.
- (b) Hold cutover until at least 20 calibration PDFs are processed (a smaller
  sample is still better than none).

PM owns that trade-off.

## Calibration run scaffold (when fixtures arrive)

Suggested layout:

```
docs/engineering/calibration/
├── pdfs/                          # Real PDFs — git-ignored (size + PII).
├── labels/                        # Per-PDF JSON with ground-truth values.
├── results/                       # Per-run extraction outputs + diffs.
└── report.md                      # Aggregated findings + threshold decision.
```

Use the existing extraction route — no new code needed. A small Node script
under `scripts/calibrate-pdfs.ts` will iterate the PDF directory, POST each to
`/api/extract-pdf`, and write the response alongside the label file for diff.

## References

- `confidence.ts` — current thresholds and the revised D05 design rationale.
- Risk R1 in `impl-plan.md` — calibration is the primary mitigation.
- `.specify/features/001-nsw-calculator/tasks.md` §3.9 — the work item this doc tracks.
