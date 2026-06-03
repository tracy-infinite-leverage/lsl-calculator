# Virtus Health canonical fixtures — E5.3 Pay-Code Mapping

**Source:** `~/Downloads/Virtus Health - LSL calculation/Sample run/` (operator's local
copy, not committed). These fixtures are **anonymised derivatives** committed to
the repo for test use.

## Files

| File | Source | Shape | Purpose |
|---|---|---|---|
| `virtus-3sheet.xlsx` | `Virtus Health LSL - Sample run.xlsx` | 3-sheet Excel (Sheet1 reconciliation summary, Sheet2 employee-master / position-history, Sheet3 payroll-export) | Canonical Excel-multi-sheet fixture. AC-MAP-13 + AC-MAP-15. |
| `virtus-payhistory.csv` | `Virtus SAMPLE PayHistorySampleFile(in).csv` | Per-period rows: `Employee ID, Cohort, System, Pay Period Start, Pay Period End, Pay Date, Pay Code, Pay Code Description, Units, Amount, Pay Run` | Canonical multi-file relational primary (pay-period source). AC-MAP-14. |
| `virtus-payratehistory.csv` | `Virtus SAMPLE PayRateHistorySampleFile(in).csv` | Effective-dated rate rows: `Employee ID, Company, Effective Date, Hourly, Annual, FTE Salary` | Canonical multi-file relational companion. AC-MAP-14. |
| `virtus-positionhistory.csv` | `Virtus SAMPLE PositionHistorySampleFile(in).csv` | Effective-dated position rows: `Employee ID, [Employee DOB stripped], Cohort, System, Title, Position Effective Date, Position End Date, LSL Instrument, State, Employment Status, Commencement Date, LSL Adjusted Start Date, Termination Date, Termination Reason, Fixed Ordinary Weekly Hours` | Canonical multi-file relational companion. AC-MAP-14 + AC-MAP-15 (state names, employment-type prefixes). |

## Anonymisation pass — 2026-06-02

Applied to source files before commit:

1. **`Employee DOB` column** in `virtus-positionhistory.csv` and Sheet2 of
   `virtus-3sheet.xlsx` — **stripped** (replaced with empty string). DOBs are
   PII per APP 1.4 and the source file is a real customer's data.
2. **`Employee ID` column** preserved — these are internal payroll IDs (numeric
   or short alphanumeric like `AU21005`). Not directly identifying without the
   employee-master row, and the master is already anonymised at source by Virtus.
3. **No names, addresses, TFNs, BSBs, bank accounts, super membership IDs, or
   email addresses** appear in any sheet/file — these fixtures are pre-sanitised
   by Virtus before export. The DOB strip is the only additional pass needed.
4. **`LSL taken.xlsx`** from the same source folder is **NOT committed** — it
   contains 280k+ rows including real employee names in `Master_NH_List`. That
   file is out of scope for E5.3 (it's E5.6 reconciliation territory) and will
   be handled with a separate anonymisation pass if E5.6 needs it.

Anonymisation script: `tests/fixtures/pay-code-mapping/virtus/.anonymise.py`
(committed for reproducibility; re-running it against a fresh export from the
source folder reproduces these fixtures byte-identically modulo Excel encoding).

## Cohort + LSL Instrument surfaces

These fixtures exercise two surfaces unique to the Virtus shape:

- **Cohort column** — hyphenated state pairs like `VIC-TAS`, `NSW-QLD`. OQ-MAP-9
  lock: the value-normalisation pass splits on `-` and resolves each side to a
  canonical state code. (Implementation lands in Phase 2 T2.4.)
- **LSL Instrument column** — 16 distinct values mixing EBA names, award names,
  common-law contracts: `TIVF2024`, `MIVFS2022`, `QN2025`, `TAS`, plus the
  free-text variants. OQ-ING-10 (E5.4) pass-through; not modelled in E5.3.

## Re-export from source

If the source files change in the operator's local copy:

```bash
python3 tests/fixtures/pay-code-mapping/virtus/.anonymise.py
```

The script reads from the hardcoded `~/Downloads/Virtus Health - LSL
calculation/Sample run/` path and writes to this directory.
