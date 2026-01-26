"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faSpinner, faFilter, faRotateRight, faSearch } from "@fortawesome/free-solid-svg-icons";

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
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pageInput, setPageInput] = useState("1");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadInventory = async (signal?: AbortSignal) => {
    try {
      setInventoryLoading(true);
      setIsRefreshing(true);
      const statusParam =
        statusFilter.length > 0 ? `&${statusFilter.map((s) => `status=${s}`).join("&")}` : "";
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
      const response = await fetch(
        `/api/inventory?page=${currentPage}&limit=${itemsPerPage}${statusParam}${searchParam}`,
        { signal },
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
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Error loading inventory:", error);
    } finally {
      setInventoryLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    loadInventory(abortController.signal);
  };

  useEffect(() => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    loadInventory(abortController.signal);

    // Cleanup function to cancel the request if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [currentPage, itemsPerPage, statusFilter, searchQuery]);

  const statusOptions = [
    { value: "available", label: "Available" },
    { value: "sold", label: "Sold" },
    { value: "pending", label: "Pending" },
    { value: "unavailable", label: "Unavailable" },
  ];

  const handleStatusToggle = (status: string) => {
    setStatusFilter((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status);
      } else {
        return [...prev, status];
      }
    });
    setCurrentPage(1);
    setPageInput("1");
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    setPageInput("1");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Inventory</h2>
          <p className="text-sm text-muted-foreground">Manage your inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Search by VIN, make, model, trim, or year..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              disabled={inventoryLoading}
              className="pl-9 w-64 bg-background text-foreground"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={inventoryLoading || isRefreshing}
            className="flex items-center gap-2"
          >
            <FontAwesomeIcon
              icon={faRotateRight}
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">VIN</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Year</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Make</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Model</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Trim</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Price</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Mileage</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  <div className="flex items-center gap-2 justify-between">
                    <span>Status</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-4 w-4 flex items-center justify-center cursor-pointer hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FontAwesomeIcon
                            icon={faFilter}
                            className="h-3 w-3 text-muted-foreground hover:text-foreground"
                            title="Filter by status"
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 bg-background text-foreground"
                      >
                        <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {statusOptions.map((option) => (
                          <DropdownMenuCheckboxItem
                            key={option.value}
                            checked={statusFilter.includes(option.value)}
                            onCheckedChange={() => handleStatusToggle(option.value)}
                            className="cursor-pointer"
                          >
                            {option.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                        {statusFilter.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                              checked={false}
                              onCheckedChange={() => {
                                setStatusFilter([]);
                                setCurrentPage(1);
                                setPageInput("1");
                              }}
                              className="cursor-pointer text-muted-foreground"
                            >
                              Clear filters
                            </DropdownMenuCheckboxItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </th>
              </tr>
            </thead>
            {!inventoryLoading && inventory.length !== 0 && (
              <tbody className="divide-y divide-white/10">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-sm">{item.vin}</td>
                    <td className="px-4 py-3 text-sm">{item.year}</td>
                    <td className="px-4 py-3 text-sm">{item.make}</td>
                    <td className="px-4 py-3 text-sm">{item.model}</td>
                    <td className="px-4 py-3 text-sm">{item.trim || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      {item.price ? `$${Number(item.price).toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">{item.mileage.toLocaleString()} mi</td>
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
            )}
          </table>
          {inventoryLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <FontAwesomeIcon icon={faSpinner} className="fa-lg animate-spin" />
              <span>Loading inventory...</span>
            </div>
          ) : (
            inventory.length === 0 &&
            !inventoryLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faBoxOpen} className="fa-lg" />
                <span>No inventory items found.</span>
              </div>
            )
          )}
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
                name="page-size"
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
                <option value="25" className="bg-background text-foreground">
                  25
                </option>
                <option value="50" className="bg-background text-foreground">
                  50
                </option>
                <option value="100" className="bg-background text-foreground">
                  100
                </option>
                <option value="200" className="bg-background text-foreground">
                  200
                </option>
              </select>
            </div>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center gap-2 w-max">
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
              <div className="flex flex-row items-center gap-2">
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
                    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pagination.totalPages) {
                      setCurrentPage(pageNum);
                    } else {
                      setPageInput(currentPage.toString());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const pageNum = parseInt(pageInput, 10);
                      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pagination.totalPages) {
                        setCurrentPage(pageNum);
                      } else {
                        setPageInput(currentPage.toString());
                      }
                    }
                  }}
                  disabled={inventoryLoading}
                  className="w-8 h-8 text-center text-xs"
                />
                <div className="text-xs w-16">{`of ${pagination.totalPages}`}</div>
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
    </div>
  );
}
