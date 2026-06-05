/**
 * Unit tests for E5.3 Phase 2 T2.5 — `detectPayCodes`.
 *
 * Coverage:
 *   - Historical mapping precedence (silent resolution).
 *   - System-alias match by code_value / code_prefix / code_suffix.
 *   - Tie-break: more-specific kind wins; longer pattern wins.
 *   - Threshold gate at PAY_CODE_VALUE_PROPOSE_THRESHOLD (0.6).
 *   - Archived mappings do NOT shadow.
 *   - header_name rows in the alias set are ignored safely.
 */

import { describe, expect, it } from "vitest";
import type { MappingRow, PayCodeAliasRow } from "@/lib/db/types";
import { detectPayCodes } from "@/lib/lsl/mapping/detect/pay-codes";

// ─── Helpers ──────────────────────────────────────────────────────────

let aliasIdCounter = 0;
function makeAlias(
  patternKind: "code_value" | "code_prefix" | "code_suffix" | "header_name",
  pattern: string,
  bucket: string,
  confidence: number,
): PayCodeAliasRow {
  aliasIdCounter += 1;
  return {
    id: `00000000-0000-0000-0000-${String(aliasIdCounter).padStart(12, "0")}`,
    pattern_kind: patternKind,
    pattern,
    bucket,
    confidence,
    source: "system_seed",
    created_at: "2026-06-02T00:00:00Z",
  };
}

let mappingIdCounter = 0;
function makeMapping(
  rawCode: string,
  bucket: string,
  opts: { archived?: boolean; orgId?: string } = {},
): MappingRow {
  mappingIdCounter += 1;
  const id = `11111111-1111-1111-1111-${String(mappingIdCounter).padStart(12, "0")}`;
  return {
    id,
    org_id: opts.orgId ?? "00000000-0000-0000-0000-000000000aaa",
    raw_code: rawCode,
    bucket,
    current_version_id: null,
    archived_at: opts.archived ? "2026-06-01T00:00:00Z" : null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

// ─── Production-mirror alias subset ───────────────────────────────────

const ALIAS_SEED: PayCodeAliasRow[] = [
  makeAlias("code_value", "ORD", "ordinary_time", 0.9),
  makeAlias("code_prefix", "ORDINARY", "ordinary_time", 0.9),
  makeAlias("code_prefix", "OT", "overtime_adhoc", 0.8),
  makeAlias("code_value", "OT15", "overtime_adhoc", 0.9),
  makeAlias("code_value", "OT20", "overtime_adhoc", 0.9),
  makeAlias("code_prefix", "OVERTIME", "overtime_adhoc", 0.9),
  makeAlias("code_suffix", "-OT", "overtime_adhoc", 0.8),
  makeAlias("code_prefix", "PEN", "penalty_rates", 0.75),
  makeAlias("code_prefix", "PUBHOL", "penalty_rates", 0.85),
  makeAlias("code_value", "COMM", "commission", 0.85),
  makeAlias("code_prefix", "BONUS", "bonus_discretionary", 0.85),
  makeAlias("code_value", "CAS_LOAD", "casual_loading", 0.95),
  makeAlias("code_value", "LSL", "leave_lsl", 0.95),
  makeAlias("code_prefix", "LSL", "leave_lsl", 0.9),
  makeAlias("code_prefix", "ANNUAL", "leave_annual", 0.75),
  // header_name row (must be ignored by detectPayCodes).
  makeAlias("header_name", "pay_code", "ordinary_time", 0.9),
];

// ─── Tests ────────────────────────────────────────────────────────────

describe("detectPayCodes — historical precedence", () => {
  it("resolves a historical mapping silently (source = 'historical')", () => {
    const orgMappings = [makeMapping("OT15", "overtime_regular")];
    const result = detectPayCodes(["OT15"], orgMappings, ALIAS_SEED);
    expect(result).toHaveLength(1);
    // Historical overrides system alias even though OT15 matches an alias
    // for `overtime_adhoc` — the org has previously chosen `overtime_regular`.
    expect(result[0]).toEqual({
      rawCode: "OT15",
      bucket: "overtime_regular",
      confidence: 1.0,
      source: "historical",
    });
  });

  it("ignores archived mappings — the archived row does NOT shadow", () => {
    const orgMappings = [makeMapping("OT15", "overtime_regular", { archived: true })];
    const result = detectPayCodes(["OT15"], orgMappings, ALIAS_SEED);
    expect(result[0].source).toBe("auto_mapped");
    expect(result[0].bucket).toBe("overtime_adhoc");
  });

  it("matches historical mapping case-insensitively", () => {
    const orgMappings = [makeMapping("ot15", "overtime_regular")];
    const result = detectPayCodes(["OT15", "Ot15"], orgMappings, ALIAS_SEED);
    expect(result).toHaveLength(1); // case-dedup
    expect(result[0].source).toBe("historical");
    expect(result[0].bucket).toBe("overtime_regular");
  });
});

describe("detectPayCodes — alias matching", () => {
  it("matches code_value (exact) above threshold", () => {
    const result = detectPayCodes(["ORD"], [], ALIAS_SEED);
    expect(result[0]).toMatchObject({
      rawCode: "ORD",
      bucket: "ordinary_time",
      source: "auto_mapped",
      matchedAliasKind: "code_value",
      matchedAliasPattern: "ORD",
    });
  });

  it("matches code_prefix when the raw code starts with the pattern", () => {
    const result = detectPayCodes(["OT-ADHOC"], [], ALIAS_SEED);
    expect(result[0].source).toBe("auto_mapped");
    expect(result[0].bucket).toBe("overtime_adhoc");
    expect(result[0].matchedAliasKind).toBe("code_prefix");
  });

  it("matches code_suffix when the raw code ends with the pattern", () => {
    const result = detectPayCodes(["SAT-OT"], [], ALIAS_SEED);
    expect(result[0].source).toBe("auto_mapped");
    expect(result[0].bucket).toBe("overtime_adhoc");
    expect(result[0].matchedAliasKind).toBe("code_suffix");
  });

  it("is case-insensitive on the raw code", () => {
    const result = detectPayCodes(["ord", "Ot15"], [], ALIAS_SEED);
    expect(result[0].bucket).toBe("ordinary_time");
    expect(result[1].bucket).toBe("overtime_adhoc");
  });
});

describe("detectPayCodes — tie-break", () => {
  it("prefers code_value over code_prefix at the same score", () => {
    // OT15 matches both `code_value 'OT15'` (0.9) and `code_prefix 'OT'`
    // (0.8). Higher score wins: code_value 0.9.
    const result = detectPayCodes(["OT15"], [], ALIAS_SEED);
    expect(result[0].matchedAliasKind).toBe("code_value");
    expect(result[0].matchedAliasPattern).toBe("OT15");
  });

  it("prefers the LONGER pattern within the same kind at the same score", () => {
    // Construct: two code_prefix aliases, same score, different lengths.
    const aliases = [
      makeAlias("code_prefix", "OT", "overtime_adhoc", 0.8),
      makeAlias("code_prefix", "OVER", "overtime_adhoc", 0.8),
    ];
    // Raw code "OVERTIME-PEN" matches both. Longer pattern (`OVER`)
    // should win.
    const result = detectPayCodes(["OVERTIME-PEN"], [], aliases);
    expect(result[0].matchedAliasPattern).toBe("OVER");
  });
});

describe("detectPayCodes — threshold gating", () => {
  it("returns needs_review when no alias scores ≥ 0.6", () => {
    const aliases = [makeAlias("code_prefix", "XYZ", "ordinary_time", 0.5)];
    const result = detectPayCodes(["XYZ_FOO"], [], aliases);
    expect(result[0].source).toBe("needs_review");
    expect(result[0].bucket).toBeNull();
    expect(result[0].confidence).toBe(0);
  });

  it("returns needs_review when no alias matches at all", () => {
    const result = detectPayCodes(["TOTALLY_UNKNOWN_CODE_XYZ"], [], ALIAS_SEED);
    expect(result[0].source).toBe("needs_review");
  });

  it("treats alias scoring exactly at threshold as auto_mapped", () => {
    const aliases = [makeAlias("code_value", "FOO", "ordinary_time", 0.6)];
    const result = detectPayCodes(["FOO"], [], aliases);
    expect(result[0].source).toBe("auto_mapped");
  });
});

describe("detectPayCodes — misc", () => {
  it("ignores header_name aliases in the alias set", () => {
    // ALIAS_SEED includes `header_name 'pay_code'`. Running the detector
    // on the value 'pay_code' must NOT auto-map it to ordinary_time.
    const result = detectPayCodes(["pay_code"], [], ALIAS_SEED);
    expect(result[0].source).toBe("needs_review");
  });

  it("deduplicates codes that differ only by case", () => {
    const result = detectPayCodes(["ORD", "ord", "Ord"], [], ALIAS_SEED);
    expect(result).toHaveLength(1);
  });

  it("ignores empty + whitespace-only raw codes", () => {
    const result = detectPayCodes(["", "  ", "ORD"], [], ALIAS_SEED);
    expect(result).toHaveLength(1);
    expect(result[0].rawCode).toBe("ORD");
  });

  it("returns an empty array on empty input", () => {
    expect(detectPayCodes([], [], ALIAS_SEED)).toEqual([]);
  });
});
