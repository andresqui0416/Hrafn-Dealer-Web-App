"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminPagination } from "@/components/admin-pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faRotateRight,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

type FortellisApiLogRow = {
  id: string;
  createdAt: string;
  requestId: string | null;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
};

type ApiResponse = {
  success: boolean;
  total: number;
  page: number;
  pageSize: number;
  rows: FortellisApiLogRow[];
  error?: string;
};

// Fortellis logs page component continues below

export default function AdminFortellisLogsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FortellisApiLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [requestIdFilter, setRequestIdFilter] = useState("");
  const [selectedRow, setSelectedRow] = useState<FortellisApiLogRow | null>(null);
  const [pageInput, setPageInput] = useState("1");

  const loadData = async (opts?: { page?: number }) => {
    const targetPage = opts?.page ?? page;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(pageSize));
      if (requestIdFilter.trim()) {
        params.set("requestId", requestIdFilter.trim());
      }

      const res = await fetch(`/api/admin/fortellis-logs?${params.toString()}`);
      const data: ApiResponse = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load Fortellis logs.");
        return;
      }

      setRows(data.rows || []);
      setTotal(data.total || 0);
      const newPage = data.page || 1;
      setPage(newPage);
      setPageInput(String(newPage));
    } catch (err) {
      setError("Failed to load Fortellis logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const formatDateTime = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  const prettyPrintJson = (raw: string | null) => {
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and summary */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            View Fortellis request/response logs for certification and support using Request-Id.
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div className="flex-1 space-y-1 max-w-full md:max-w-xl">
            <label className="text-xs font-medium text-muted-foreground mb-1">
              Request-Id (exact match)
            </label>
            <Input
              placeholder="Paste Fortellis Request-Id to look up a single transaction…"
              value={requestIdFilter}
              onChange={(e) => setRequestIdFilter(e.target.value)}
              className="w-full md:max-w-xl"
            />
          </div>
          <div className="flex flex-row items-center gap-2 pt-1 md:pt-6 self-end md:self-auto">
            <Button
              variant="outline"
              onClick={() => loadData({ page: 1 })}
              disabled={loading}
              className={cn(loading ? "cursor-not-allowed" : "cursor-pointer")}
            >
              <FontAwesomeIcon
                icon={loading ? faSpinner : faRotateRight}
                className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
              />
              Search / Refresh
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRequestIdFilter("");
                loadData({ page: 1 });
              }}
              disabled={loading}
              className="cursor-pointer whitespace-nowrap hover:bg-white/10 transition-colors duration-200"
            >
              Clear
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 py-3 px-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <AdminPagination
          total={total}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          loading={loading}
          pageInput={pageInput}
          setPageInput={setPageInput}
          onPageChange={(nextPage) => loadData({ page: nextPage })}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            loadData({ page: 1 });
          }}
        />
      </div>

      {/* Table of logs */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 px-4 text-left">Time</th>
                  <th className="py-2 px-4 text-left">Request-Id</th>
                  <th className="py-2 px-4 text-left">Method</th>
                  <th className="py-2 px-4 text-left">URL</th>
                  <th className="py-2 px-4 text-left">Status</th>
                  <th className="py-2 px-4 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                      Loading logs…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No logs found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2 px-4 whitespace-nowrap">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="py-2 px-4 font-mono text-xs max-w-[220px] truncate">
                        {row.requestId || "—"}
                      </td>
                      <td className="py-2 px-4">{row.method}</td>
                      <td className="py-2 px-4 max-w-[260px] truncate" title={row.url}>
                        {row.url}
                      </td>
                      <td className="py-2 px-4">
                        <span
                          className={
                            row.responseStatus >= 200 && row.responseStatus < 300
                              ? "text-emerald-400"
                              : row.responseStatus >= 400
                                ? "text-red-400"
                                : "text-amber-300"
                          }
                        >
                          {row.responseStatus}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-xs cursor-pointer"
                          onClick={() => setSelectedRow(row)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail view */}
      {selectedRow && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Log details – {selectedRow.method} {selectedRow.url}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Request</div>
                <div className="text-xs">
                  <div>
                    <span className="font-semibold">Request-Id: </span>
                    <span className="font-mono">{selectedRow.requestId || "—"}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Method: </span>
                    {selectedRow.method}
                  </div>
                  <div className="break-all">
                    <span className="font-semibold">URL: </span>
                    {selectedRow.url}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold">Headers</div>
                  <Textarea
                    readOnly
                    className="h-40 text-xs font-mono"
                    value={JSON.stringify(selectedRow.requestHeaders ?? {}, null, 2)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold">Body</div>
                  <Textarea
                    readOnly
                    className="h-40 text-xs font-mono"
                    value={prettyPrintJson(selectedRow.requestBody)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Response</div>
                <div className="text-xs">
                  <div>
                    <span className="font-semibold">Status: </span>
                    <span
                      className={
                        selectedRow.responseStatus >= 200 && selectedRow.responseStatus < 300
                          ? "text-emerald-400"
                          : selectedRow.responseStatus >= 400
                            ? "text-red-400"
                            : "text-amber-300"
                      }
                    >
                      {selectedRow.responseStatus}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold">Headers</div>
                  <Textarea
                    readOnly
                    className="h-40 text-xs font-mono"
                    value={JSON.stringify(selectedRow.responseHeaders ?? {}, null, 2)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold">Body</div>
                  <Textarea
                    readOnly
                    className="h-40 text-xs font-mono"
                    value={prettyPrintJson(selectedRow.responseBody)}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setSelectedRow(null)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

