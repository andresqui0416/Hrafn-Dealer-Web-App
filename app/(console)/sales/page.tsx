"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faSearch,
  faChevronLeft,
  faChevronRight,
  faX,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

type SaleDataTable = {
  id: string;
  dealNo: string;
  status: string | null;
  dealStatusDate: string | null;
  changedDate: string | null;
  createdAt: string;
  vehicle: {
    vin: string | null;
    make: string | null;
    makeName: string | null;
    model: string | null;
    modelName: string | null;
    year: number | null;
    color: string | null;
    stockNo: string | null;
  } | null;
  deal: {
    contractDate: string | null;
    salesDate: string | null;
    cashPrice: number | null;
    grossProfit: number | null;
    saleType: string | null;
  } | null;
};

type SaleDataFull = {
  id: string;
  dealNo: string;
  status: string | null;
  dealStatusDate: string | null;
  changedDate: string | null;
  createdAt: string;
  updatedAt: string;
  commission: any;
  deal: any;
  dealAuxiliary: any;
  dealEvents: any[];
  fees: any[];
  incentives: any;
  insurance: any;
  salesPersons: any;
  tax: any;
  totals: any;
  trades: any[];
  vehicle: any;
};

export default function SalesPage() {
  const [salesData, setSalesData] = useState<SaleDataTable[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedSaleData, setSelectedSaleData] = useState<SaleDataFull | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load sales data
  useEffect(() => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const loadSalesData = async () => {
      try {
        setSalesLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (searchQuery.trim()) {
          params.append("search", searchQuery.trim());
        }
        params.append("page", currentPage.toString());
        params.append("pageSize", pageSize.toString());

        const response = await fetch(`/api/sales?${params.toString()}`, {
          signal: abortController.signal,
        });

        if (response.ok) {
          const data = await response.json();
          setSalesData(data.salesData || []);
          setTotalPages(data.pagination.totalPages);
          setTotalCount(data.pagination.totalCount);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to load sales data");
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError("Network error. Please try again.");
      } finally {
        if (!abortController.signal.aborted) {
          setSalesLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadSalesData();

    return () => {
      abortController.abort();
    };
  }, [currentPage, searchQuery, pageSize, refreshToken]);

  // Load sale details when row is clicked
  const handleRowClick = async (saleId: string) => {
    setSelectedSaleId(saleId);
    setLoadingDetails(true);
    setSelectedSaleData(null);

    try {
      const response = await fetch(`/api/sales/${saleId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedSaleData(data.saleData);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to load sale details");
        setSelectedSaleId(null);
      }
    } catch (err) {
      setError("Network error. Please try again.");
      setSelectedSaleId(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "N/A";
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <span className="text-muted-foreground">N/A</span>;
    const statusMap: Record<string, { label: string; className: string }> = {
      C: { label: "Cleared", className: "bg-green-500/20 text-green-400" },
      B: { label: "Booked", className: "bg-blue-500/20 text-blue-400" },
      P: { label: "Pending", className: "bg-yellow-500/20 text-yellow-400" },
      F: { label: "Finalized", className: "bg-purple-500/20 text-purple-400" },
      I: { label: "Intermediate", className: "bg-orange-500/20 text-orange-400" },
      U: { label: "Unwound", className: "bg-red-500/20 text-red-400" },
    };
    const statusInfo = statusMap[status] || {
      label: status,
      className: "bg-gray-500/20 text-gray-400",
    };
    return (
      <span className={cn("px-2 py-1 rounded text-xs font-medium", statusInfo.className)}>
        {statusInfo.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Data</h1>
          <p className="text-sm text-muted-foreground">View and analyze your sales records</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            id="search"
            name="search"
            type="text"
            placeholder="Search by deal number, VIN, make, or model..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setRefreshing(true);
            setRefreshToken((prev) => prev + 1);
          }}
          disabled={refreshing}
          className="gap-2 ml-auto"
        >
          <FontAwesomeIcon
            icon={refreshing ? faSpinner : faRotateRight}
            className={cn("h-4 w-4", refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-red-400">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="h-6 w-6 p-0"
              >
                <FontAwesomeIcon icon={faX} className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Deal No</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">VIN</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Vehicle</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Year</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Sale Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Cash Price</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Gross Profit</th>
              </tr>
            </thead>
            {!salesLoading && salesData.length !== 0 && (
              <tbody className="divide-y divide-white/10">
                {salesData.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => handleRowClick(sale.id)}
                    className="hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm">{sale.dealNo || "N/A"}</td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                      {sale.vehicle?.vin || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {sale.vehicle?.makeName || sale.vehicle?.make || "N/A"}{" "}
                      {sale.vehicle?.modelName || sale.vehicle?.model || ""}
                    </td>
                    <td className="px-4 py-3 text-sm">{sale.vehicle?.year || "N/A"}</td>
                    <td className="px-4 py-3">{getStatusBadge(sale.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      {formatDate(sale.deal?.salesDate || sale.deal?.contractDate || null)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatCurrency(sale.deal?.cashPrice ?? null)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatCurrency(sale.deal?.grossProfit ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {salesLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <FontAwesomeIcon icon={faSpinner} className="fa-lg animate-spin" />
              <span>Loading sales data...</span>
            </div>
          ) : (
            salesData.length === 0 &&
            !salesLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <span>No sales data found</span>
              </div>
            )
          )}
        </div>
        <div className="px-4 py-3 bg-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            {totalCount > 0 ? (
              <>
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, totalCount)} of {totalCount} sale
                {totalCount !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                Showing {salesData.length} sale{salesData.length !== 1 ? "s" : ""}
              </>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || salesLoading}
                className={cn(currentPage === 1 ? "cursor-not-allowed" : "cursor-pointer")}
              >
                <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || salesLoading}
                className={cn(currentPage === totalPages ? "cursor-not-allowed" : "cursor-pointer")}
              >
                Next
                <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <Dialog
        open={selectedSaleId !== null}
        onOpenChange={(open) => !open && setSelectedSaleId(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sale Details - {selectedSaleData?.dealNo || "Loading..."}</DialogTitle>
            <DialogDescription>Complete sale information</DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex justify-center items-center py-10">
              <FontAwesomeIcon
                icon={faSpinner}
                className="h-6 w-6 animate-spin text-muted-foreground"
              />
              <span className="ml-2 text-muted-foreground">Loading details...</span>
            </div>
          ) : selectedSaleData ? (
            <div className="space-y-6 mt-4">
              {/* Vehicle Information */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Vehicle Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">VIN:</span>{" "}
                    <span className="font-mono">{selectedSaleData.vehicle?.vin || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Make:</span>{" "}
                    {selectedSaleData.vehicle?.makeName || selectedSaleData.vehicle?.make || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model:</span>{" "}
                    {selectedSaleData.vehicle?.modelName ||
                      selectedSaleData.vehicle?.model ||
                      "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Year:</span>{" "}
                    {selectedSaleData.vehicle?.year || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Color:</span>{" "}
                    {selectedSaleData.vehicle?.color || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stock No:</span>{" "}
                    {selectedSaleData.vehicle?.stockNo || "N/A"}
                  </div>
                </div>
              </div>

              {/* Deal Information */}
              {selectedSaleData.deal && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Deal Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Deal No:</span>{" "}
                      {selectedSaleData.dealNo}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      {getStatusBadge(selectedSaleData.status)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sale Type:</span>{" "}
                      {selectedSaleData.deal.saleType || "N/A"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contract Date:</span>{" "}
                      {formatDate(selectedSaleData.deal.contractDate)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sales Date:</span>{" "}
                      {formatDate(selectedSaleData.deal.salesDate)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cash Price:</span>{" "}
                      {formatCurrency(selectedSaleData.deal.cashPrice)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gross Profit:</span>{" "}
                      {formatCurrency(selectedSaleData.deal.grossProfit)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Finance Amount:</span>{" "}
                      {formatCurrency(selectedSaleData.deal.financeAmt)}
                    </div>
                  </div>
                </div>
              )}

              {/* Totals */}
              {selectedSaleData.totals && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Totals</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Commission:</span>{" "}
                      {formatCurrency(selectedSaleData.totals.totalCommission)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Gross:</span>{" "}
                      {formatCurrency(selectedSaleData.totals.totalGross)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Down:</span>{" "}
                      {formatCurrency(selectedSaleData.totals.totalDown)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tax:</span>{" "}
                      {formatCurrency(selectedSaleData.totals.tax)}
                    </div>
                  </div>
                </div>
              )}

              {/* Sales Persons */}
              {selectedSaleData.salesPersons && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Sales Persons</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Salesperson 1:</span>{" "}
                      {selectedSaleData.salesPersons.salesperson1 || "N/A"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Salesperson 2:</span>{" "}
                      {selectedSaleData.salesPersons.salesperson2 || "N/A"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sales Manager:</span>{" "}
                      {selectedSaleData.salesPersons.salesMgr || "N/A"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">F&I Manager 1:</span>{" "}
                      {selectedSaleData.salesPersons.fiMgr1 || "N/A"}
                    </div>
                  </div>
                </div>
              )}

              {/* Trades */}
              {selectedSaleData.trades && selectedSaleData.trades.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Trades</h3>
                  <div className="space-y-2">
                    {selectedSaleData.trades.map((trade: any, index: number) => (
                      <div key={index} className="border border-white/10 rounded p-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-muted-foreground">Trade VIN:</span>{" "}
                            {trade.tradeVIN || "N/A"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Trade Year:</span>{" "}
                            {trade.tradeYear || "N/A"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Trade Make:</span>{" "}
                            {trade.tradeMakeName || trade.tradeMake || "N/A"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Trade Model:</span>{" "}
                            {trade.tradeModelName || trade.tradeModel || "N/A"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Net Trade:</span>{" "}
                            {formatCurrency(trade.netTrade)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional sections can be added here for fees, insurance, etc. */}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
