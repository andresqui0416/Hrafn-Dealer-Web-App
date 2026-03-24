"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AdminPagination } from "@/components/admin-pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faRotateRight,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faExclamationTriangle,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

const TAB_IDS = ["scrape-events", "failure-log"] as const;
type TabId = (typeof TAB_IDS)[number];

type ScrapeEventRow = {
  id: string;
  source: string | null;
  brand: string | null;
  startedAt: string;
  completedAt: string | null;
  status: string;
  recordsInserted: number;
  recordsReplaced: number;
  recordsFailed: number;
  errorMessage: string | null;
};

type FailureLogRow = {
  id: string;
  scrapeEventId: string | null;
  brand: string | null;
  source: string | null;
  failureType: string;
  message: string;
  createdAt: string;
};

type PaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export default function ScrapingStatusPage() {
  const [events, setEvents] = useState<ScrapeEventRow[]>([]);
  const [failureLogs, setFailureLogs] = useState<FailureLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("scrape-events");
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPageSize, setEventsPageSize] = useState(20);
  const [eventsPagination, setEventsPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 1,
  });
  const [failuresPage, setFailuresPage] = useState(1);
  const [failuresPageSize, setFailuresPageSize] = useState(10);
  const [failuresPagination, setFailuresPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 1,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const isEvents = activeTab === "scrape-events";
    const page = isEvents ? eventsPage : failuresPage;
    const pageSize = isEvents ? eventsPageSize : failuresPageSize;
    const type = isEvents ? "events" : "failures";
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        type,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/admin/scraping-status?${params.toString()}`, { signal });
      if (!res.ok) {
        setError("Failed to load scraping status");
        return;
      }
      const data = await res.json();
      if (!data.pagination) {
        setError("Invalid response");
        return;
      }
      const pagination = {
        page: data.pagination.page,
        pageSize: data.pagination.pageSize,
        totalCount: data.pagination.totalCount,
        totalPages: data.pagination.totalPages,
      };
      if (isEvents) {
        setEvents(data.events ?? []);
        setEventsPagination(pagination);
      } else {
        setFailureLogs(data.failureLogs ?? []);
        setFailuresPagination(pagination);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError("Failed to load scraping status");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [activeTab, eventsPage, eventsPageSize, failuresPage, failuresPageSize]);

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Recent scrape events and failure log. Alerts are not implemented yet.
      </p>
      <div className="flex items-center justify-end">
        <Button
          onClick={() => load()}
          variant="outline"
          disabled={loading}
          className={cn(loading ? "cursor-not-allowed" : "cursor-pointer")}
        >
          <FontAwesomeIcon
            icon={loading ? faSpinner : faRotateRight}
            className={cn("mr-2 h-4 w-4", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Tabs — same form as fine-tuning page */}
      <div className="border-b border-white/10">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("scrape-events")}
            className={cn(
              "border-b-2 py-4 px-1 text-sm font-medium transition-colors cursor-pointer",
              activeTab === "scrape-events"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            Scrape events
          </button>
          <button
            onClick={() => setActiveTab("failure-log")}
            className={cn(
              "border-b-2 py-4 px-1 text-sm font-medium transition-colors cursor-pointer",
              activeTab === "failure-log"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            Failure log
          </button>
        </nav>
      </div>

      {/* Tab panels */}
      {activeTab === "scrape-events" && (
        <div className="space-y-2">
          <AdminPagination
            total={eventsPagination.totalCount}
            page={eventsPagination.page}
            totalPages={eventsPagination.totalPages}
            pageSize={eventsPagination.pageSize}
            loading={loading}
            pageInput={String(eventsPagination.page)}
            setPageInput={(value) => {
              const parsed = Number(value || "1");
              const clamped = Math.min(
                eventsPagination.totalPages || 1,
                Math.max(1, parsed || 1),
              );
              setEventsPage(clamped);
            }}
            onPageChange={(nextPage) => setEventsPage(nextPage)}
            onPageSizeChange={(nextSize) => {
              setEventsPageSize(nextSize);
              setEventsPage(1);
            }}
          />
          <div className="overflow-x-auto rounded-md border border-white/10">
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Brand</th>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                    <th className="px-3 py-2 text-left font-medium">Started</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Inserted</th>
                    <th className="px-3 py-2 text-right font-medium">Replaced</th>
                    <th className="px-3 py-2 text-left font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                        No scrape events yet
                      </td>
                    </tr>
                  ) : (
                    events.map((ev) => (
                      <tr key={ev.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{ev.brand ?? "—"}</td>
                        <td className="px-3 py-2">{ev.source ?? "—"}</td>
                        <td className="px-3 py-2">{formatDate(ev.startedAt)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium",
                              ev.status === "success" && "bg-green-500/20 text-green-700 dark:text-green-400",
                              ev.status === "failure" && "bg-red-500/20 text-red-700 dark:text-red-400",
                              ev.status === "running" && "bg-amber-500/20 text-amber-700 dark:text-amber-400",
                            )}
                          >
                            {ev.status === "success" && <FontAwesomeIcon icon={faCheckCircle} className="h-3 w-3" />}
                            {ev.status === "failure" && <FontAwesomeIcon icon={faTimesCircle} className="h-3 w-3" />}
                            {ev.status === "running" && <FontAwesomeIcon icon={faClock} className="h-3 w-3" />}
                            {ev.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">{ev.recordsInserted}</td>
                        <td className="px-3 py-2 text-right">{ev.recordsReplaced}</td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground" title={ev.errorMessage ?? undefined}>
                          {ev.errorMessage ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}


      {activeTab === "failure-log" && (
        <div className="space-y-2">
          <AdminPagination
            total={failuresPagination.totalCount}
            page={failuresPagination.page}
            totalPages={failuresPagination.totalPages}
            pageSize={failuresPagination.pageSize}
            loading={loading}
            pageInput={String(failuresPagination.page)}
            setPageInput={(value) => {
              const parsed = Number(value || "1");
              const clamped = Math.min(
                failuresPagination.totalPages || 1,
                Math.max(1, parsed || 1),
              );
              setFailuresPage(clamped);
            }}
            onPageChange={(nextPage) => setFailuresPage(nextPage)}
            onPageSizeChange={(nextSize) => {
              setFailuresPageSize(nextSize);
              setFailuresPage(1);
            }}
          />
          <div className="overflow-x-auto rounded-md border border-white/10">
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Time</th>
                    <th className="px-3 py-2 text-left font-medium">Brand</th>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {failureLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                        No failure log entries yet
                      </td>
                    </tr>
                  ) : (
                    failureLogs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                        <td className="px-3 py-2">{log.brand ?? "—"}</td>
                        <td className="px-3 py-2">{log.source ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-sm font-medium text-red-700 dark:text-red-400">
                            <FontAwesomeIcon icon={faExclamationTriangle} className="h-3 w-3" />
                            {log.failureType}
                          </span>
                        </td>
                        <td className="max-w-[320px] truncate px-3 py-2 text-muted-foreground" title={log.message}>
                          {log.message}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
