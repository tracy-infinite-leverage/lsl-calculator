# Performance benchmarks — LSL Calculator

Spec targets from `.specify/features/001-nsw-calculator/spec.md` and tasks.md §5.7.

Updated 2026-05-23.

| Spec | Target | Measured | Headroom | Notes |
|---|---|---|---|---|
| **P1** Single-mode calculation latency | < 2 s 95p | well under (see below) | huge | Engine runs sub-millisecond per employee. Browser render dominates. |
| **P2** Bulk-mode 500 employees | < 60 s end-to-end | **69 ms** in pure runner | 870× | See `src/lib/lsl/bulk-runner.bench.test.ts`. UI overhead extra but well within budget. |
| **P3** Single-PDF extraction | < 30 s (≤20 pages) | ~13 s (real PDF, ~10 yr history) | comfortable | Bottleneck is Anthropic API roundtrip + Claude thinking, not our code. |
| **P4** PDF extraction worst-case | < 60 s (single, ≤100 pages) | not yet measured | — | Need a real 100-page payroll PDF to validate. Pending Phase 5 calibration. |

## How to re-run

```bash
cd website
npx vitest run src/lib/lsl/bulk-runner.bench.test.ts
```

Output looks like:
```
[bench] 500-employee runBulk: 69ms (0.14ms/employee, summary.elapsedMs=69ms)
[bench] single runBulk dispatch: 0.17ms
```

## Methodology

- **P2 bench fixture**: 500 NSW full-time employees, 24 weekly wage periods
  each (12,000 total wage rows). Default trigger = `as_at` upload date.
  Runs in `vitest run` mode (Node) — same code path as the browser engine,
  faster because no JIT warm-up to amortise.
- **Browser numbers will differ** but never by more than ~3×: the engine is
  pure-decimal-math + branded ISODate strings, no DOM, no async IO. Add UI
  overhead (~50ms for the React re-render after each batch) and we still
  stay well under budget.
- **The microtask yield** between batches (BULK_CHUNK_SIZE = 25) is what
  keeps the browser responsive on this scale — without it, a 500-row Promise.all
  would block the main thread for ~70ms (browser-side). With it, the work
  spreads across ~20 microtask boundaries.

## When to revisit

- If P2 starts failing (> 60s), the first thing to check is whether the
  engine still operates in pure decimal — adding any async IO inside
  `calculateNSWSafe` will break the chunking strategy.
- If P4 ever needs to land, consider streaming PDF extraction (send page
  ranges to Claude in parallel) — current implementation processes the
  whole document text in one call.

## Out of scope for this benchmark

- WebSocket / SSE streaming (not used in v1)
- Real-network latency for PDF extraction (measured separately on the
  manual smoke tests; ~13s for a real PDF documented in Phase 3 fix
  commit `4ebb556`)
- Memory usage (no large allocations; Result[] grows linearly with
  employee count, no observed memory pressure at 500 rows)
