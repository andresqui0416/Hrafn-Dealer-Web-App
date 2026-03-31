"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export type ConsoleTableColumn<T> = {
  /** Unique column id */
  id: string;
  /** Column header label */
  header: React.ReactNode;
  /** Optional accessor for basic text cell; ignored if `render` is provided */
  accessor?: (row: T) => React.ReactNode;
  /** Custom cell renderer */
  render?: (row: T) => React.ReactNode;
  /** Optional header / cell alignment & spacing */
  className?: string;
  /** Whether this column is sortable */
  sortable?: boolean;
};

export type ConsoleTableSortState = {
  columnId: string | null;
  direction: "asc" | "desc";
};

export type ConsoleTablePaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type ConsoleDataTableProps<T> = {
  columns: ConsoleTableColumn<T>[];
  rows: T[];
  /** Optional small header area above the table (e.g. filters, summary) */
  header?: React.ReactNode;
  /** Optional custom footer below the table; overrides default pagination footer */
  footer?: React.ReactNode;
  /** Optional empty state message shown when `rows` is empty */
  emptyMessage?: React.ReactNode;
  className?: string;
  loading?: boolean;
  /** Current sort state, if any */
  sort?: ConsoleTableSortState;
  /** Called when user clicks a sortable column header */
  onSortChange?: (next: ConsoleTableSortState) => void;
  /** Optional row key extractor (default: index-based) */
  getRowKey?: (row: T, index: number) => React.Key;
  /** Optional row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Optional built-in pagination; when provided, a default footer is rendered */
  pagination?: ConsoleTablePaginationState | null;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageInput?: string;
  setPageInput?: (value: string) => void;
  pageSizeOptions?: number[];
  /** Label used in "Showing X–Y of N ..." (default: "records") */
  itemsLabel?: string;
};

export function ConsoleDataTable<T>({
  columns,
  rows,
  header,
  footer,
  emptyMessage,
  className,
  loading = false,
  sort,
  onSortChange,
  getRowKey,
  onRowClick,
  pagination,
  onPageChange,
  onPageSizeChange,
  pageInput,
  setPageInput,
  pageSizeOptions = [25, 50, 100, 200],
  itemsLabel = "records",
}: ConsoleDataTableProps<T>) {
  const handleHeaderClick = (col: ConsoleTableColumn<T>) => {
    if (!col.sortable || !onSortChange) return;
    if (!sort || sort.columnId !== col.id) {
      onSortChange({ columnId: col.id, direction: "asc" });
    } else {
      const nextDir = sort.direction === "asc" ? "desc" : "asc";
      onSortChange({ columnId: col.id, direction: nextDir });
    }
  };

  return (
    <div className={cn("rounded-lg border border-white/10 overflow-hidden", className)}>
      {header && (
        <div className="px-4 py-3 border-b border-white/10 text-xs text-muted-foreground">
          {header}
        </div>
      )}

      <div className="overflow-x-auto relative">
        <table className="w-full text-sm">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.columnId === col.id;
                const sortIndicator =
                  isSorted && sort?.direction === "asc"
                    ? " ▲"
                    : isSorted && sort?.direction === "desc"
                      ? " ▼"
                      : "";
                return (
                  <th
                    key={col.id}
                    className={cn(
                      "px-4 py-3 text-left text-sm font-semibold select-none",
                      col.sortable && "cursor-pointer hover:text-foreground",
                      col.className,
                    )}
                    onClick={() => handleHeaderClick(col)}
                  >
                    <span>
                      {col.header}
                      {sortIndicator && (
                        <span className="ml-1 text-[0.7rem] align-middle">{sortIndicator}</span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-sm text-muted-foreground"
                >
                  {/* Spacer row keeps table height stable while overlay centers loader in viewport */}
                  <span className="sr-only">Loading...</span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage ?? "No records found."}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={getRowKey ? getRowKey(row, index) : index}
                  className={cn(
                    "hover:bg-white/5 transition-colors",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.id} className={cn("px-4 py-2 align-middle", col.className)}>
                      {col.render
                        ? col.render(row)
                        : col.accessor
                          ? col.accessor(row)
                          : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {loading && (
          <div className="absolute left-1/2 top-2/3 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="inline-flex items-center gap-2 rounded-md bg-background/70 px-3 py-2 text-sm text-muted-foreground backdrop-blur">
              <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          </div>
        )}
      </div>

      {footer ? (
        <div className="px-4 py-3 bg-white/5 text-xs text-muted-foreground">{footer}</div>
      ) : pagination &&
        onPageChange &&
        onPageSizeChange &&
        typeof pageInput === "string" &&
        setPageInput ? (
        <div className="px-4 py-3 bg-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <div>
              {pagination.totalCount > 0 ? (
                <>
                  Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.totalCount)}-
                  {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of{" "}
                  {pagination.totalCount} {itemsLabel}
                </>
              ) : (
                <>Showing 0 {itemsLabel}</>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="page-size" className="text-xs whitespace-nowrap">
                Items per page:
              </label>
              <Select
                id="page-size"
                name="page-size"
                value={String(pagination.pageSize)}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value, 10);
                  if (!Number.isNaN(newSize)) {
                    onPageSizeChange(newSize);
                  }
                }}
                className="h-8 px-3 text-xs"
                options={pageSizeOptions.map((size) => ({
                  value: size,
                  label: String(size),
                }))}
              />
            </div>
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-3 w-max">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
                disabled={pagination.page <= 1}
                className="cursor-pointer h-10 px-3 rounded-md border border-white bg-background text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
              >
                Previous
              </button>
              <div className="flex flex-row items-center gap-2">
                <span className="text-xs">Page</span>
                <Input
                  id="pageNumber"
                  name="pageNumber"
                  type="number"
                  min={1}
                  max={pagination.totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={(e) => {
                    const pageNum = parseInt(e.target.value, 10);
                    if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= pagination.totalPages) {
                      onPageChange(pageNum);
                    } else {
                      setPageInput(String(pagination.page));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const pageNum = parseInt(pageInput, 10);
                      if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= pagination.totalPages) {
                        onPageChange(pageNum);
                      } else {
                        setPageInput(String(pagination.page));
                      }
                    }
                  }}
                  className="w-[72px] h-8 text-xs text-center"
                />
                <div className="text-xs w-16">{`of ${pagination.totalPages}`}</div>
              </div>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="cursor-pointer h-10 px-3 rounded-md border border-white bg-background text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

