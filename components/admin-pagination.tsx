"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

export type AdminPaginationProps = {
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  loading?: boolean;
  pageInput: string;
  setPageInput: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
};

export function AdminPagination({
  total,
  page,
  totalPages,
  pageSize,
  loading = false,
  pageInput,
  setPageInput,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100, 200],
}: AdminPaginationProps) {
  return (
    <div className="flex flex-row flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground mt-2">
      <div className="flex items-center gap-2">
        <div className="whitespace-nowrap flex-shrink-0">
          Showing: {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of <span className="font-medium">{total}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="whitespace-nowrap flex-shrink-0">Page size:</span>
          <Select
            className="h-7 w-[72px] px-2 py-1 text-xs"
            value={String(pageSize)}
            disabled={loading}
            onChange={(e) => {
              const nextSize = Number(e.target.value) || pageSize;
              onPageSizeChange(nextSize);
            }}
            options={pageSizeOptions.map((size) => ({
              value: size,
              label: String(size),
            }))}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 justify-start sm:justify-end">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1 || loading}
          className={cn(
            "h-7 w-7",
            page === 1 || loading
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer",
          )}
        >
          <FontAwesomeIcon icon={faChevronLeft} className="h-3 w-3" />
        </Button>
        <div className="flex items-center gap-1">
          <span>Page</span>
          <Input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => {
              const parsed = Number(pageInput);
              if (!parsed || parsed < 1) {
                setPageInput(String(page));
                return;
              }
              const clamped = Math.min(totalPages, parsed);
              if (clamped !== page) {
                onPageChange(clamped);
              } else {
                setPageInput(String(clamped));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const parsed = Number(pageInput);
                if (!parsed || parsed < 1) {
                  setPageInput(String(page));
                  return;
                }
                const clamped = Math.min(totalPages, parsed);
                onPageChange(clamped);
              }
            }}
            disabled={loading || totalPages <= 1}
            className={cn(
              "h-7 w-[80px] px-1 text-xs text-center",
              loading || totalPages <= 1 ? "cursor-not-allowed opacity-50" : "cursor-text",
            )}
          />
          <span className="text-xs whitespace-nowrap">of {totalPages}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages || loading}
          className={cn(
            "h-7 w-7",
            page === totalPages || loading
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer",
          )}
        >
          <FontAwesomeIcon icon={faChevronRight} className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

