"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPagination } from "@/components/admin-pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type AdminPaymentRow = {
  id: string;
  userId: string;
  dealerId: string | null;
  dealerName: string | null;
  userEmail: string;
  userName: string;
  plan: string;
  interval: string | null;
  amount: number;
  currency: string;
  issueDate: string;
  paymentMethod: string;
  subscriptionExpiresAt: string | null;
  stripeInvoiceUrl: string | null;
};

type AdminPaymentStats = {
  totalPayments: number;
  totalRevenue: number;
  activeSubscribers: number;
};

type WeeklyStat = {
  weekStart: string;
  totalRevenue: number;
  newSubscribers: number;
};

export default function AdminPaymentsPage() {
  const [stats, setStats] = useState<AdminPaymentStats | null>(null);
  const [rows, setRows] = useState<AdminPaymentRow[]>([]);
  const [weekly, setWeekly] = useState<WeeklyStat[]>(() => {
    // Default: 4 recent weeks with zero values so charts always have data
    const result: WeeklyStat[] = [];
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      result.push({
        weekStart: d.toISOString(),
        totalRevenue: 0,
        newSubscribers: 0,
      });
    }
    return result;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, tableRes] = await Promise.all([
        fetch("/api/admin/payments/stats"),
        fetch("/api/admin/payments/subscriptions"),
      ]);
      const [statsData, tableData] = await Promise.all([statsRes.json(), tableRes.json()]);

      if (!statsRes.ok) {
        setError(statsData.error || "Failed to load payments statistics.");
        return;
      }
      if (!tableRes.ok) {
        setError(tableData.error || "Failed to load payments table.");
        return;
      }

      setStats(statsData.stats || null);
      setRows(tableData.history || []);
      setWeekly(
        (statsData.weeklyStats || []).map((w: any) => ({
          weekStart: w.weekStart,
          totalRevenue: Number(w.totalRevenue ?? 0),
          newSubscribers: Number(w.newSubscribers ?? 0),
        })),
      );
    } catch (err) {
      setError("Failed to load payments data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      return (
        row.dealerName?.toLowerCase().includes(q) ||
        row.userEmail.toLowerCase().includes(q) ||
        row.userName.toLowerCase().includes(q) ||
        row.plan.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  useEffect(() => {
    // Reset to first page when filter changes
    setPage(1);
  }, [search, rows.length]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / pageSize)),
    [filteredRows.length],
  );

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const formatCurrency = (amount: number, currency: string) => {
    if (Number.isNaN(amount)) return "-";
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  };

  const weeklyRevenueChartData = useMemo(() => {
    const lastFour = weekly.slice(-4);
    const labels = lastFour.map((w) => formatDate(w.weekStart));
    return {
      labels,
      datasets: [
        {
          label: "Revenue",
          data: lastFour.map((w) => w.totalRevenue),
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderRadius: 4,
          barThickness: 24,
        },
      ],
    };
  }, [weekly]);

  const weeklyNewSubsChartData = useMemo(() => {
    const lastFour = weekly.slice(-4);
    const labels = lastFour.map((w) => formatDate(w.weekStart));
    return {
      labels,
      datasets: [
        {
          label: "New subscribers",
          data: lastFour.map((w) => w.newSubscribers),
          backgroundColor: "rgba(16, 185, 129, 0.9)",
          borderRadius: 4,
          barThickness: 24,
        },
      ],
    };
  }, [weekly]);

  const weeklyChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, minRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: {
            beginAtZero: true,
            precision: 0,
          },
        },
      },
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const label = ctx.dataset.label || "";
              const value = ctx.parsed.y;
              if (label === "Revenue") {
                return `${label}: ${formatCurrency(value, "usd")}`;
              }
              return `${label}: ${value}`;
            },
          },
        },
      },
    }),
    [],
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Manage payments and subscriptions
      </p>
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? stats.totalPayments : loading ? "…" : "0"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue (last 1 month)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatCurrency(stats.totalRevenue, "usd") : loading ? "…" : "USD 0.00"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? stats.activeSubscribers : loading ? "…" : "0"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly charts (4 weeks, two separate cards side by side) */}
      <div className="grid gap-4 md:grid-cols-2 md:auto-rows-fr">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Weekly revenue (last 4 weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-64 w-full">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                  <FontAwesomeIcon icon={faSpinner} className="h-5 w-5 animate-spin" />
                </div>
              )}
              <Bar data={weeklyRevenueChartData} options={weeklyChartOptions} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Weekly new subscribers (last 4 weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-64 w-full">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                  <FontAwesomeIcon icon={faSpinner} className="h-5 w-5 animate-spin" />
                </div>
              )}
              <Bar data={weeklyNewSubsChartData} options={weeklyChartOptions} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-row items-center gap-3 justify-between">
        <Input
          placeholder="Search by dealer, user, email, or plan…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-lg flex-1"
        />
        <Button
          variant="outline"
          onClick={loadData}
          disabled={loading}
          className={cn(loading ? "cursor-not-allowed" : "cursor-pointer")}
        >
          <FontAwesomeIcon
            icon={loading ? faSpinner : faRotateRight}
            className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 py-3 px-4 text-sm text-destructive">{error}</div>
      )}

      {/* History table */}
      <div className="space-y-2">
        {!loading && filteredRows.length > 0 && (
          <AdminPagination
            total={filteredRows.length}
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            loading={loading}
            pageInput={String(page)}
            setPageInput={(value) => {
              const parsed = Number(value || "1");
              const clamped = Math.min(totalPages || 1, Math.max(1, parsed || 1));
              setPage(clamped);
            }}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
          />
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 px-4 text-left">Date</th>
                  <th className="py-2 px-4 text-left">Dealer</th>
                  <th className="py-2 px-4 text-left">User</th>
                  <th className="py-2 px-4 text-left">Plan</th>
                  <th className="py-2 px-4 text-left">Amount</th>
                  <th className="py-2 px-4 text-left">Payment method</th>
                  <th className="py-2 px-4 text-left">Subscription expires</th>
                  <th className="py-2 px-4 text-left">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                      Loading payments…
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      No payments found.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2 px-4">{formatDate(row.issueDate)}</td>
                      <td className="py-2 px-4">{row.dealerName || "-"}</td>
                      <td className="py-2 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{row.userName || row.userEmail}</span>
                          <span className="text-xs text-muted-foreground">{row.userEmail}</span>
                        </div>
                      </td>
                      <td className="py-2 px-4">{row.plan}</td>
                      <td className="py-2 px-4">
                        {formatCurrency(row.amount, row.currency || "USD")}
                      </td>
                      <td className="py-2 px-4">{row.paymentMethod || "-"}</td>
                      <td className="py-2 px-4">{formatDate(row.subscriptionExpiresAt)}</td>
                      <td className="py-2 px-4">
                        {row.stripeInvoiceUrl ? (
                          <a
                            href={row.stripeInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            View
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

