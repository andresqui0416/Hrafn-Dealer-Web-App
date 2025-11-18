"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/contexts/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InventoryItem = {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  price: number | null;
  mileage: number;
  status: string;
};

type PaginationInfo = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export default function InventoryPage() {
  const params = useParams();
  const appId = params?.appId as string;
  const { selectedApp } = useApp();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pageInput, setPageInput] = useState("1");


  useEffect(() => {
    if (!appId) return;

    const abortController = new AbortController();

    const loadInventory = async () => {
      try {
        setInventoryLoading(true);
        const response = await fetch(
          `/api/apps/${appId}/inventory?page=${currentPage}&limit=${itemsPerPage}`,
          { signal: abortController.signal }
        );
        if (response.ok) {
          const data = await response.json();
          setInventory(data.inventory || []);
          setPagination(data.pagination || null);
          // Update page input to match current page
          if (data.pagination) {
            setPageInput(data.pagination.page.toString());
          }
        }
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error("Error loading inventory:", error);
      } finally {
        if (!abortController.signal.aborted) {
          setInventoryLoading(false);
        }
      }
    };

    loadInventory();

    // Cleanup function to cancel the request if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [appId, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Inventory</h2>
        <p className="text-sm text-muted-foreground">
          Manage inventory for {selectedApp?.name}
        </p>
      </div>

      {inventoryLoading ? (
        <div className="rounded-lg border border-white/10 p-4 text-sm text-muted-foreground">
          Loading inventory...
        </div>
      ) : inventory.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-4 text-sm text-muted-foreground">
          No inventory items found for this app.
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">VIN</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Year</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Make</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Model</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Trim</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Price</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Mileage</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-sm">{item.vin}</td>
                    <td className="px-4 py-3 text-sm">{item.year}</td>
                    <td className="px-4 py-3 text-sm">{item.make}</td>
                    <td className="px-4 py-3 text-sm">{item.model}</td>
                    <td className="px-4 py-3 text-sm">{item.trim || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      {item.price
                        ? `$${Number(item.price).toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.mileage.toLocaleString()} mi
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === "available"
                            ? "bg-green-500/20 text-green-400"
                            : item.status === "sold"
                              ? "bg-red-500/20 text-red-400"
                              : item.status === "pending"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <div>
                {pagination ? (
                  <>
                    Showing {(pagination.page - 1) * pagination.limit + 1}-
                    {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{" "}
                    {pagination.totalCount} item{pagination.totalCount !== 1 ? "s" : ""}
                  </>
                ) : (
                  <>
                    Showing {inventory.length} item{inventory.length !== 1 ? "s" : ""}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="page-size" className="text-xs">
                  Items per page:
                </label>
                <select
                  id="page-size"
                  value={itemsPerPage}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value, 10);
                    setItemsPerPage(newSize);
                    setCurrentPage(1);
                    setPageInput("1");
                  }}
                  disabled={inventoryLoading}
                  className="px-2 py-1 rounded-md border border-white/10 bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    colorScheme: "dark",
                  }}
                >
                  <option value="25" className="bg-background text-foreground">25</option>
                  <option value="50" className="bg-background text-foreground">50</option>
                  <option value="100" className="bg-background text-foreground">100</option>
                  <option value="200" className="bg-background text-foreground">200</option>
                </select>
              </div>
            </div>
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newPage = Math.max(1, currentPage - 1);
                    setCurrentPage(newPage);
                    setPageInput(newPage.toString());
                  }}
                  disabled={!pagination.hasPreviousPage || inventoryLoading}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-xs">Page</span>
                  <Input
                    id="pageNumber"
                    name="pageNumber"
                    type="number"
                    min="1"
                    max={pagination.totalPages}
                    value={pageInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPageInput(value);
                    }}
                    onBlur={(e) => {
                      const pageNum = parseInt(e.target.value, 10);
                      if (
                        !isNaN(pageNum) &&
                        pageNum >= 1 &&
                        pageNum <= pagination.totalPages
                      ) {
                        setCurrentPage(pageNum);
                      } else {
                        setPageInput(currentPage.toString());
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const pageNum = parseInt(pageInput, 10);
                        if (
                          !isNaN(pageNum) &&
                          pageNum >= 1 &&
                          pageNum <= pagination.totalPages
                        ) {
                          setCurrentPage(pageNum);
                        } else {
                          setPageInput(currentPage.toString());
                        }
                      }
                    }}
                    disabled={inventoryLoading}
                    className="w-16 h-8 text-center text-xs"
                  />
                  <span className="text-xs">of {pagination.totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newPage = Math.min(pagination.totalPages, currentPage + 1);
                    setCurrentPage(newPage);
                    setPageInput(newPage.toString());
                  }}
                  disabled={!pagination.hasNextPage || inventoryLoading}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

