'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, ChevronDown, ChevronRight, Lock, Unlock } from '@/components/brand/Icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CitationBlock } from '@/components/lsl/citation-block';
import { cn } from '@/lib/utils';
import type { Result } from '@/lib/lsl/engine/types';

export interface BulkResultsTableProps {
  results: Result[];
  /** Optional name lookup keyed by employee_id — populates the Name column. */
  namesById?: Record<string, string | undefined>;
  /** Called when the user clicks the unblock CTA on a blocked row. */
  onUnblock?: (employeeId: string) => void;
}

/**
 * BulkResultsTable per impl-plan §5.4 / D18.
 *
 * Columns: expand · employee_id · name · status · category · weeks · $
 *   plus an action column for blocked rows (jurisdiction unblock).
 *
 * Behaviour:
 *   - Sort by clicking any column header.
 *   - Filter by text — matches employee_id, name, or status.
 *   - Virtualised via TanStack Virtual when rows > 50 (P2).
 *   - Expand chevron reveals citations + warnings + diagnostics
 *     for that employee (D18).
 *   - Status badges colour-coded; blocked rows surface an Unblock
 *     button that fires `onUnblock(employeeId)`.
 *   - Keyboard nav: Enter / Space toggles the expand row when focused
 *     on the chevron cell (A4).
 */
export function BulkResultsTable({ results, namesById, onUnblock }: BulkResultsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggleExpand = React.useCallback((employeeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }, []);

  const columns = React.useMemo<ColumnDef<Result>[]>(
    () => [
      {
        id: 'expand',
        header: '',
        size: 32,
        cell: ({ row }) => {
          const isOpen = expanded.has(row.original.employeeId);
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(row.original.employeeId);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleExpand(row.original.employeeId);
                }
              }}
              className="p-0.5 rounded hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isOpen ? 'Collapse row' : 'Expand row'}
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden />
              )}
            </button>
          );
        },
      },
      {
        id: 'employeeId',
        accessorKey: 'employeeId',
        header: ({ column }) => (
          <SortableHeader column={column} label="Employee ID" />
        ),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        id: 'name',
        accessorFn: (r) => namesById?.[r.employeeId] ?? '',
        header: ({ column }) => <SortableHeader column={column} label="Name" />,
        cell: ({ getValue }) => {
          const name = getValue<string>();
          return name ? (
            <span>{name}</span>
          ) : (
            <span className="text-muted-foreground italic">—</span>
          );
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: ({ column }) => <SortableHeader column={column} label="Status" />,
        cell: ({ row }) => <StatusBadge result={row.original} />,
        filterFn: (row, _id, value: string) =>
          row.original.status.toLowerCase().includes(value.toLowerCase()),
      },
      {
        id: 'category',
        accessorFn: (r) => r.category ?? '',
        header: ({ column }) => <SortableHeader column={column} label="Cat." />,
        cell: ({ getValue }) =>
          getValue<string>() ? (
            <span className="font-mono">{getValue<string>()}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'years',
        accessorFn: (r) =>
          r.diagnostics?.yearsOfContinuousService
            ? Number(r.diagnostics.yearsOfContinuousService.toFixed(2))
            : null,
        header: ({ column }) => <SortableHeader column={column} label="Years" align="right" />,
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          return (
            <span className="font-mono tabular-nums">{v == null ? '—' : v.toFixed(2)}</span>
          );
        },
      },
      {
        id: 'weeks',
        accessorFn: (r) =>
          r.outputs ? Number(r.outputs.totalEntitlement.weeks.value.toFixed(4)) : null,
        header: ({ column }) => <SortableHeader column={column} label="Weeks" align="right" />,
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {row.original.outputs?.totalEntitlement.weeks.display ?? '—'}
          </span>
        ),
      },
      {
        id: 'dollars',
        accessorFn: (r) =>
          r.outputs ? Number(r.outputs.totalEntitlement.dollars.value.toFixed(2)) : null,
        header: ({ column }) => (
          <SortableHeader column={column} label="$ entitlement" align="right" />
        ),
        cell: ({ row }) => (
          <span className="font-mono tabular-nums font-medium">
            {row.original.outputs?.totalEntitlement.dollars.display ?? '—'}
          </span>
        ),
      },
      {
        id: 'action',
        header: '',
        size: 110,
        cell: ({ row }) => {
          if (row.original.status === 'blocked_cross_jurisdiction' && onUnblock) {
            return (
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnblock(row.original.employeeId);
                }}
                className="h-7 text-xs"
              >
                <Unlock className="h-3 w-3 mr-1" aria-hidden /> Unblock
              </Button>
            );
          }
          return null;
        },
      },
    ],
    [expanded, toggleExpand, onUnblock, namesById]
  );

  const table = useReactTable({
    data: results,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _id, value: string) => {
      const v = value.toLowerCase();
      return (
        row.original.employeeId.toLowerCase().includes(v) ||
        row.original.status.toLowerCase().includes(v) ||
        (row.original.category ?? '').toLowerCase().includes(v)
      );
    },
  });

  const rows = table.getRowModel().rows;
  // Virtualise the row list once we have enough rows that DOM cost matters.
  // Under 50 rows, native rendering is faster and avoids the absolute-position
  // shenanigans that conflict with collapsible row expansion.
  const shouldVirtualise = rows.length > 50;
  const parentRef = React.useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
    enabled: shouldVirtualise,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Filter by employee ID, name, or status…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm h-8 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {rows.length} of {results.length} rows
        </p>
      </div>

      <div
        ref={parentRef}
        className={cn(
          'rounded-md border overflow-auto',
          shouldVirtualise ? 'max-h-[600px]' : ''
        )}
        role="region"
        aria-label="Bulk LSL results"
      >
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="text-left p-2 text-xs font-semibold"
                    style={{ width: h.column.columnDef.size }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {!shouldVirtualise &&
              rows.map((row) => {
                const isOpen = expanded.has(row.original.employeeId);
                return (
                  <React.Fragment key={row.id}>
                    <tr className="border-t hover:bg-muted/30 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-2 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {isOpen && (
                      <tr className="border-t bg-muted/20">
                        <td colSpan={row.getVisibleCells().length} className="p-3">
                          <ExpandedRow result={row.original} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            {shouldVirtualise && (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <div
                    style={{
                      height: rowVirtualizer.getTotalSize(),
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((vi) => {
                      const row = rows[vi.index];
                      return (
                        <div
                          key={row.id}
                          className="absolute left-0 right-0 grid border-t hover:bg-muted/30"
                          style={{
                            top: 0,
                            transform: `translateY(${vi.start}px)`,
                            height: vi.size,
                            gridTemplateColumns: '32px 1fr 1fr 110px 80px 100px 110px 130px 110px',
                          }}
                          role="row"
                        >
                          {row.getVisibleCells().map((cell) => (
                            <div
                              key={cell.id}
                              className="p-2 self-center text-sm"
                              role="cell"
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-muted-foreground">
                  No rows match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {shouldVirtualise && (
        <p className="text-xs text-muted-foreground italic">
          Row virtualisation active (rows &gt; 50). Expand details only visible in
          non-virtualised mode — sort or filter down to ≤50 rows to inspect.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ result }: { result: Result }) {
  if (result.status === 'computed') {
    return <Badge variant="success">computed</Badge>;
  }
  if (result.status === 'blocked_cross_jurisdiction') {
    return (
      <span className="inline-flex items-center gap-1">
        <Badge variant="warning">
          <Lock className="h-3 w-3 mr-1" aria-hidden /> blocked
        </Badge>
      </span>
    );
  }
  return <Badge variant="destructive">failed</Badge>;
}

function SortableHeader<TData, TValue>({
  column,
  label,
  align,
}: {
  column: { toggleSorting: (asc?: boolean) => void; getIsSorted: () => false | 'asc' | 'desc' };
  label: string;
  align?: 'right';
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className={cn(
        'flex items-center gap-1 hover:text-foreground',
        align === 'right' ? 'ml-auto' : ''
      )}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <ArrowUpDown
        className={cn('h-3 w-3 opacity-50', sorted && 'opacity-100')}
        aria-hidden
      />
    </button>
  );
}

function ExpandedRow({ result }: { result: Result }) {
  const allCitations = React.useMemo(() => {
    if (!result.outputs) return [];
    return [
      ...result.outputs.valueOfWeek.citations,
      ...result.outputs.valueOfDay.citations,
      ...result.outputs.totalEntitlement.weeks.citations,
      ...result.outputs.totalEntitlement.dollars.citations,
    ];
  }, [result]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Diagnostics
        </p>
        {result.diagnostics ? (
          <dl className="space-y-1 text-xs">
            <DiagRow
              label="Years of continuous service"
              value={result.diagnostics.yearsOfContinuousService.toFixed(2)}
            />
            <DiagRow
              label="Days of continuous service"
              value={result.diagnostics.daysOfContinuousService.toString()}
            />
            <DiagRow
              label="Days excluded from service"
              value={result.diagnostics.daysNotCountedInService.toString()}
            />
            <DiagRow
              label="Weekly avg (12-month)"
              value={`$${result.diagnostics.weeklyAvg12mo.toFixed(2)}`}
            />
            <DiagRow
              label="Weekly avg (5-year)"
              value={`$${result.diagnostics.weeklyAvg5yr.toFixed(2)}`}
            />
            <DiagRow
              label="Payable?"
              value={
                result.diagnostics.payableIndicator === 'payable'
                  ? 'Yes'
                  : 'Accrued, not currently payable'
              }
            />
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No diagnostics — calculation didn&apos;t complete.
          </p>
        )}

        {result.error && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
            <p className="font-semibold">Error: {result.error.code}</p>
            <p className="text-muted-foreground">{result.error.userMessage}</p>
          </div>
        )}

        {result.warnings.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Warnings ({result.warnings.length})
            </p>
            <ul className="space-y-1 text-xs">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-foreground">
                  <span className="font-mono text-[10px] text-muted-foreground mr-1">
                    {w.code}
                  </span>
                  {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Citations
        </p>
        {allCitations.length > 0 ? (
          <CitationBlock citations={allCitations} />
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No citations available for this row.
          </p>
        )}
      </div>
    </div>
  );
}

function DiagRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
