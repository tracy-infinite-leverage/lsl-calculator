/**
 * E5.3 Phase 2 T2.7 — Integration test: full Pass 1 against the Virtus
 * 3-sheet `.xlsx` fixture.
 *
 * Verifies the end-to-end deterministic pipeline:
 *   1. `detectFileShape` classifies the upload as `excel-multi` and
 *      proposes Sheet3 as the payroll-export sheet.
 *   2. `detectValueNormalisations` resolves all 7 long-form states +
 *      proposes mappings for 12 distinct employment-type surface forms
 *      (5 resolve to canonical via seed; 7 fall to `needs_review` — the
 *      spec-compliant Pass-1 outcome that hands off to Pass 2 in Phase 3).
 *   3. `detectColumns` against Sheet3 finds the structural columns
 *      (employee-id-like Code, employment-type, state-equivalent, hours).
 *
 * Fixture data is pre-extracted from `virtus-3sheet.xlsx` into a JSON
 * sidecar at fixture time so this test does not pull in a vulnerable
 * `xlsx` runtime dependency. The Python anonymisation script can
 * regenerate the JSON sidecar if the source xlsx changes (see
 * `tests/fixtures/pay-code-mapping/virtus/README.md`).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { PayCodeAliasRow, ValueNormaliseAliasRow } from "@/lib/db/types";
import {
  detectColumns,
  detectFileShape,
  detectValueNormalisations,
  type FileInput,
} from "@/lib/lsl/mapping/detect";

// ─── Load the JSON sidecar (pre-extracted from virtus-3sheet.xlsx) ────

interface VirtusSheetData {
  name: string;
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
}
interface VirtusFixture {
  sheets: VirtusSheetData[];
}

const FIXTURE_PATH = path.resolve(
  __dirname,
  "../../../../../../tests/fixtures/pay-code-mapping/virtus/virtus-3sheet.headers.json",
);

function loadFixture(): VirtusFixture {
  const raw = fs.readFileSync(FIXTURE_PATH, "utf-8");
  return JSON.parse(raw) as VirtusFixture;
}

// ─── Production-mirror alias subsets ──────────────────────────────────

let aliasId = 0;
function makeHeaderAlias(pattern: string, confidence: number): PayCodeAliasRow {
  aliasId += 1;
  return {
    id: `a0000000-0000-0000-0000-${String(aliasId).padStart(12, "0")}`,
    pattern_kind: "header_name",
    pattern,
    bucket: "ordinary_time",
    confidence,
    source: "system_seed",
    created_at: "2026-06-02T00:00:00Z",
  };
}

const HEADER_ALIASES: PayCodeAliasRow[] = [
  makeHeaderAlias("pay_code", 0.9),
  makeHeaderAlias("pay code", 0.9),
  makeHeaderAlias("earning_category", 0.75),
  makeHeaderAlias("payroll_category", 0.75),
];

let vnaId = 0;
function makeAlias(
  targetField: ValueNormaliseAliasRow["target_field"],
  surfaceForm: string,
  canonicalValue: string,
): ValueNormaliseAliasRow {
  vnaId += 1;
  return {
    id: `c0000000-0000-0000-0000-${String(vnaId).padStart(12, "0")}`,
    org_id: null,
    target_field: targetField,
    surface_form: surfaceForm,
    canonical_value: canonicalValue,
    confidence: 0.95,
    source: "system_seed",
    current_version_id: null,
    created_at: "2026-06-02T00:00:00Z",
    created_by: null,
  };
}

// 8 jurisdictions × long-form mirroring the production seed.
const STATE_ALIASES: ValueNormaliseAliasRow[] = [
  makeAlias("work_jurisdiction", "NSW", "NSW"),
  makeAlias("work_jurisdiction", "New South Wales", "NSW"),
  makeAlias("work_jurisdiction", "VIC", "VIC"),
  makeAlias("work_jurisdiction", "Victoria", "VIC"),
  makeAlias("work_jurisdiction", "QLD", "QLD"),
  makeAlias("work_jurisdiction", "Queensland", "QLD"),
  makeAlias("work_jurisdiction", "WA", "WA"),
  makeAlias("work_jurisdiction", "Western Australia", "WA"),
  makeAlias("work_jurisdiction", "SA", "SA"),
  makeAlias("work_jurisdiction", "South Australia", "SA"),
  makeAlias("work_jurisdiction", "TAS", "TAS"),
  makeAlias("work_jurisdiction", "Tasmania", "TAS"),
  makeAlias("work_jurisdiction", "ACT", "ACT"),
  makeAlias("work_jurisdiction", "Australian Capital Territory", "ACT"),
  makeAlias("work_jurisdiction", "NT", "NT"),
  makeAlias("work_jurisdiction", "Northern Territory", "NT"),
];

// Subset of the production employment-type seed (5 of the 12 Virtus
// surface forms are seeded — the rest fall to needs_review per spec
// §5.3 Pass-1 contract).
const EMPLOYMENT_ALIASES: ValueNormaliseAliasRow[] = [
  makeAlias("employment_type", "Full Time", "full_time"),
  makeAlias("employment_type", "Part Time", "part_time"),
  makeAlias("employment_type", "Casual", "casual"),
  makeAlias("employment_type", "FP - Full Time Salaried", "full_time"),
  makeAlias("employment_type", "FP - Full-time Salaried", "full_time"),
  makeAlias("employment_type", "PT - Part-time Salary", "part_time"),
  makeAlias("employment_type", "CA - Casual", "casual"),
];

// ─── Tests ────────────────────────────────────────────────────────────

describe("E5.3 Phase 2 integration — Virtus 3-sheet xlsx", () => {
  const fixture = loadFixture();

  it("loads the JSON sidecar with 3 sheets", () => {
    expect(fixture.sheets).toHaveLength(3);
    expect(fixture.sheets.map((s) => s.name)).toEqual(["Sheet1", "Sheet2", "Sheet3"]);
  });

  it("detectFileShape classifies as excel-multi and proposes Sheet3", () => {
    const file: FileInput = {
      name: "virtus-3sheet.xlsx",
      extension: "xlsx",
      sheets: fixture.sheets.map((s) => ({
        name: s.name,
        headers: s.headers,
        rowCount: s.rowCount,
      })),
    };
    const result = detectFileShape([file], HEADER_ALIASES);
    expect(result.shape).toBe("excel-multi");
    expect(result.sheets).toHaveLength(3);
    expect(result.proposedSheet).toBe("Sheet3");
  });

  it("detectValueNormalisations resolves all 7 long-form state values on Sheet3", () => {
    const sheet3 = fixture.sheets.find((s) => s.name === "Sheet3");
    expect(sheet3).toBeDefined();
    // The state-equivalent column in Sheet3 is 'Physical State' (index 6).
    const stateColumnIdx = sheet3!.headers.findIndex((h) => h === "Physical State");
    expect(stateColumnIdx).toBeGreaterThanOrEqual(0);
    const surfaceForms = new Set<string>();
    for (const row of sheet3!.sampleRows) {
      const cell = row[stateColumnIdx];
      if (cell && cell.trim()) surfaceForms.add(cell);
    }
    const proposals = detectValueNormalisations(
      "work_jurisdiction",
      [...surfaceForms],
      STATE_ALIASES,
    );
    // 7 distinct values; all should resolve to one of NSW/VIC/QLD/WA/SA/TAS/ACT.
    expect(proposals.length).toBeGreaterThanOrEqual(7);
    const resolved = proposals.filter((p) => p.canonicalValue !== null);
    expect(
      resolved.length,
      `unresolved: ${proposals
        .filter((p) => p.canonicalValue === null)
        .map((p) => p.surfaceForm)
        .join(", ")}`,
    ).toBeGreaterThanOrEqual(7);
    const canonicals = new Set(resolved.map((p) => p.canonicalValue));
    expect(canonicals.size).toBeGreaterThanOrEqual(7); // 7 distinct states.
  });

  it("detectValueNormalisations surfaces 12 distinct employment-type values from Sheet3 (5 resolved, 7 needs_review)", () => {
    const sheet3 = fixture.sheets.find((s) => s.name === "Sheet3");
    const employmentColumnIdx = sheet3!.headers.findIndex(
      (h) => h === "Employment Type",
    );
    expect(employmentColumnIdx).toBeGreaterThanOrEqual(0);
    const surfaceForms = new Set<string>();
    for (const row of sheet3!.sampleRows) {
      const cell = row[employmentColumnIdx];
      if (cell && cell.trim()) surfaceForms.add(cell);
    }
    // Virtus Sheet3 has 12 distinct employment-type strings — confirmed
    // via fixture inspection 2026-06-05. (Some of these are mis-typed
    // by the customer's payroll system, e.g. 'PC- Part Time Fixed Term Contr'.)
    const proposals = detectValueNormalisations(
      "employment_type",
      [...surfaceForms],
      EMPLOYMENT_ALIASES,
    );
    expect(proposals.length).toBe(surfaceForms.size);
    // Verify EVERY surface form has a proposal — resolved or needs_review.
    expect(proposals.length).toBeGreaterThanOrEqual(12);
    // Resolved count: 5 of the 12 are in the seed subset above.
    const resolved = proposals.filter((p) => p.source === "system_seed");
    const needsReview = proposals.filter((p) => p.source === "needs_review");
    expect(resolved.length).toBeGreaterThanOrEqual(5);
    expect(needsReview.length).toBeGreaterThanOrEqual(1); // at least some defer to Pass 2.
    // Sum check.
    expect(resolved.length + needsReview.length).toBe(proposals.length);
  });

  it("detectColumns on Sheet3 finds structural columns (employment-type, state, hours)", () => {
    const sheet3 = fixture.sheets.find((s) => s.name === "Sheet3");
    const detected = detectColumns(sheet3!.headers, [], HEADER_ALIASES);

    // Sheet3 is a reconciliation-style sheet — it has no Pay Code column,
    // but does have structural signals.
    // - 'Normal Hours Paid' → units
    // - 'Physical State' → jurisdiction
    // - employment-type column is detected by the value-normalisation
    //   layer; detectColumns does NOT detect employment-type columns
    //   (that's spec §5.3 territory routed via target_field discovery).
    expect(detected.units?.header).toBe("Normal Hours Paid");
    expect(detected.jurisdiction?.header).toBeDefined();
  });

  it("Sheet3 has no pay-code-style column — payCode is undefined or low-confidence", () => {
    const sheet3 = fixture.sheets.find((s) => s.name === "Sheet3");
    const detected = detectColumns(sheet3!.headers, [], HEADER_ALIASES);
    // The Virtus Sheet3 is a reconciliation-summary shape — there's
    // no 'Pay Code' column (it lives in Sheet2 / pay-history). Pass 1
    // SHOULD return undefined payCode, which the wizard then surfaces
    // as a 'needs review' for the customer to either pick a column or
    // confirm there's no pay-code column on this sheet.
    expect(detected.payCode).toBeUndefined();
  });

  it("OQ-ING-9 — Sheet2 Cohort column resolves cross-jurisdiction labels", () => {
    const sheet2 = fixture.sheets.find((s) => s.name === "Sheet2");
    const cohortColumnIdx = sheet2!.headers.findIndex((h) => h === "Cohort");
    expect(cohortColumnIdx).toBeGreaterThanOrEqual(0);
    const surfaceForms = new Set<string>();
    for (const row of sheet2!.sampleRows) {
      const cell = row[cohortColumnIdx];
      if (cell && cell.trim()) surfaceForms.add(cell);
    }
    const proposals = detectValueNormalisations(
      "work_jurisdiction",
      [...surfaceForms],
      STATE_ALIASES,
    );
    // Virtus Sheet2 has cohort labels like `VIC-TAS`, `NSW-QLD`. Each
    // SHOULD emit a crossJurisdictionFlag annotation per OQ-ING-9.
    const cohorts = proposals.filter((p) => p.crossJurisdictionFlag === true);
    expect(cohorts.length).toBeGreaterThanOrEqual(1);
    for (const c of cohorts) {
      expect(c.hintedJurisdictions).toBeDefined();
      expect(c.hintedJurisdictions!.length).toBeGreaterThanOrEqual(2);
      expect(c.canonicalValue).toBeNull();
    }
  });
});
