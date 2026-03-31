"use client";

import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

export type InboxPaginationProps = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  itemLabel?: string;
  className?: string;
};

export function InboxPagination({
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  onPageChange,
  loading = false,
  itemLabel = "chats",
  className,
}: InboxPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const from =
    totalCount === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, totalCount);
  const to = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount);

  const disabled = loading;
  const prevDisabled = disabled || currentPage <= 1;
  const nextDisabled = disabled || currentPage >= safeTotalPages;

  const pageButtonCount = Math.min(5, safeTotalPages);

  const circle =
    "h-9 w-9 shrink-0 rounded-full p-0 text-sm font-medium border border-white/20 bg-transparent text-foreground hover:bg-white/10";
  const circleActive = "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:border-primary";

  return (
    <nav
      role="navigation"
      aria-label="Inbox list pagination"
      className={cn(
        "mt-6 shrink-0 border-t border-white/10 bg-background pt-4",
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-white/60">
        <span>Showing </span>
        <span className="tabular-nums text-foreground">{from}</span>
        <span> to </span>
        <span className="tabular-nums text-foreground">{to}</span>
        <span> of </span>
        <span className="font-medium tabular-nums text-foreground">{totalCount}</span>
        <span> {itemLabel}</span>
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous page"
          disabled={prevDisabled}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className={cn(circle, "cursor-pointer disabled:cursor-not-allowed")}
        >
          <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1.5 px-0.5">
          {Array.from({ length: pageButtonCount }, (_, i) => {
            let pageNum: number;
            if (safeTotalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= safeTotalPages - 2) {
              pageNum = safeTotalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            const isActive = currentPage === pageNum;
            return (
              <Button
                key={pageNum}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Page ${pageNum}`}
                aria-current={isActive ? "page" : undefined}
                disabled={disabled}
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  circle,
                  isActive && circleActive,
                  disabled ? "cursor-not-allowed" : "cursor-pointer",
                )}
              >
                <span className="tabular-nums">{pageNum}</span>
              </Button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next page"
          disabled={nextDisabled}
          onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
          className={cn(circle, "cursor-pointer disabled:cursor-not-allowed")}
        >
          <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
