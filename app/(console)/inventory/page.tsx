"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faSpinner,
  faFilter,
  faRotateRight,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pageInput, setPageInput] = useState("1");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [makeFilter, setMakeFilter] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<number[]>([]);
  const [availableMakes, setAvailableMakes] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [priceSort, setPriceSort] = useState<"asc" | "desc" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadInventory = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setInventoryLoading(true);
        setIsRefreshing(true);
        const statusParam =
          statusFilter.length > 0 ? `&${statusFilter.map((s) => `status=${s}`).join("&")}` : "";
        const makeParam =
          makeFilter.length > 0
            ? `&${makeFilter.map((m) => `make=${encodeURIComponent(m)}`).join("&")}`
            : "";
        const yearParam =
          yearFilter.length > 0 ? `&${yearFilter.map((y) => `year=${y}`).join("&")}` : "";
        const sortParam = priceSort ? `&sort=price&order=${priceSort}` : "";
        const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
        const response = await fetch(
          `/api/inventory?page=${currentPage}&limit=${itemsPerPage}${statusParam}${makeParam}${yearParam}${sortParam}${searchParam}`,
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
    },
    [currentPage, itemsPerPage, statusFilter, makeFilter, yearFilter, priceSort, searchQuery],
  );

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
  }, [
    loadInventory,
    currentPage,
    itemsPerPage,
    statusFilter,
    makeFilter,
    yearFilter,
    priceSort,
    searchQuery,
  ]);

  const loadFilters = useCallback(async () => {
    setFiltersLoading(true);
    try {
      const response = await fetch("/api/inventory/filters");
      if (response.ok) {
        const data = await response.json();
        setAvailableMakes(data.makes || []);
        setAvailableYears(data.years || []);
      }
    } catch (error) {
      console.error("Error loading inventory filters:", error);
    } finally {
      setFiltersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    if (!searchParams) return;

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const searchParam = searchParams.get("search") || "";
    const statusParams = searchParams.getAll("status");
    const makeParams = searchParams.getAll("make");
    const yearParams = searchParams.getAll("year");
    const sortParam = searchParams.get("sort");
    const orderParam = searchParams.get("order");

    if (pageParam && !Number.isNaN(parseInt(pageParam, 10))) {
      const pageNum = parseInt(pageParam, 10);
      setCurrentPage(pageNum);
      setPageInput(pageNum.toString());
    }
    if (limitParam && !Number.isNaN(parseInt(limitParam, 10))) {
      setItemsPerPage(parseInt(limitParam, 10));
    }
    setSearchQuery(searchParam);
    setStatusFilter(statusParams);
    setMakeFilter(makeParams);
    setYearFilter(
      yearParams.map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value)),
    );
    if (sortParam === "price" && (orderParam === "asc" || orderParam === "desc")) {
      setPriceSort(orderParam);
    } else {
      setPriceSort(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searchParams) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("page", currentPage.toString());
    params.set("limit", itemsPerPage.toString());

    if (searchQuery) {
      params.set("search", searchQuery);
    } else {
      params.delete("search");
    }

    params.delete("status");
    statusFilter.forEach((status) => params.append("status", status));

    params.delete("make");
    makeFilter.forEach((make) => params.append("make", make));

    params.delete("year");
    yearFilter.forEach((year) => params.append("year", year.toString()));

    if (priceSort) {
      params.set("sort", "price");
      params.set("order", priceSort);
    } else {
      params.delete("sort");
      params.delete("order");
    }

    router.replace(`?${params.toString()}`, { scroll: false });
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    statusFilter,
    makeFilter,
    yearFilter,
    priceSort,
    router,
    searchParams,
  ]);

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

  const handleMakeToggle = (make: string) => {
    setMakeFilter((prev) => {
      if (prev.includes(make)) {
        return prev.filter((m) => m !== make);
      } else {
        return [...prev, make];
      }
    });
    setCurrentPage(1);
    setPageInput("1");
  };

  const handleYearToggle = (year: number) => {
    setYearFilter((prev) => {
      if (prev.includes(year)) {
        return prev.filter((y) => y !== year);
      } else {
        return [...prev, year];
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

  const togglePriceSort = () => {
    setPriceSort((prev) => {
      if (prev === "asc") return "desc";
      if (prev === "desc") return null;
      return "asc";
    });
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
      </div>
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
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
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2 ml-auto"
        >
          <FontAwesomeIcon
            icon={isRefreshing ? faSpinner : faRotateRight}
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          />
          <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
        </Button>
      </div>

      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">VIN</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  <div className="flex items-center gap-2 justify-between">
                    <span>Year</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-4 w-4 flex items-center justify-center cursor-pointer hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FontAwesomeIcon
                            icon={faFilter}
                            className={cn(
                              "h-3 w-3 text-muted-foreground hover:text-foreground",
                              yearFilter.length > 0 && "text-primary",
                            )}
                            title="Filter by year"
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 bg-background text-foreground"
                      >
                        <DropdownMenuLabel>Filter by Year</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="max-h-48 overflow-y-auto">
                          {filtersLoading ? (
                            <div className="py-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                              Loading...
                            </div>
                          ) : availableYears.length === 0 ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                              No years found
                            </div>
                          ) : (
                            availableYears.map((year) => (
                              <label
                                key={year}
                                className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-white/10 focus-within:bg-white/10"
                              >
                                <input
                                  type="checkbox"
                                  checked={yearFilter.includes(year)}
                                  onChange={() => handleYearToggle(year)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-4 rounded border-white/20 bg-background text-primary focus:ring-white/20 cursor-pointer shrink-0"
                                />
                                <span className="truncate">{year}</span>
                              </label>
                            ))
                          )}
                        </div>
                        {yearFilter.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setYearFilter([]);
                                  setCurrentPage(1);
                                  setPageInput("1");
                                }}
                                className="text-muted-foreground hover:underline cursor-pointer"
                              >
                                Clear selection
                              </button>
                            </div>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  <div className="flex items-center gap-2 justify-between">
                    <span>Make</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-4 w-4 flex items-center justify-center cursor-pointer hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FontAwesomeIcon
                            icon={faFilter}
                            className={cn(
                              "h-3 w-3 text-muted-foreground hover:text-foreground",
                              makeFilter.length > 0 && "text-primary",
                            )}
                            title="Filter by make"
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 bg-background text-foreground"
                      >
                        <DropdownMenuLabel>Filter by Make</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="max-h-48 overflow-y-auto">
                          {filtersLoading ? (
                            <div className="py-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                              Loading...
                            </div>
                          ) : availableMakes.length === 0 ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                              No makes found
                            </div>
                          ) : (
                            availableMakes.map((make) => (
                              <label
                                key={make}
                                className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-white/10 focus-within:bg-white/10"
                              >
                                <input
                                  type="checkbox"
                                  checked={makeFilter.includes(make)}
                                  onChange={() => handleMakeToggle(make)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-4 rounded border-white/20 bg-background text-primary focus:ring-white/20 cursor-pointer shrink-0"
                                />
                                <span className="truncate">{make}</span>
                              </label>
                            ))
                          )}
                        </div>
                        {makeFilter.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setMakeFilter([]);
                                  setCurrentPage(1);
                                  setPageInput("1");
                                }}
                                className="text-muted-foreground hover:underline cursor-pointer"
                              >
                                Clear selection
                              </button>
                            </div>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Model</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Trim</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  <button
                    type="button"
                    onClick={togglePriceSort}
                    className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors"
                    title="Sort by price"
                  >
                    <span>Price</span>
                    <span className="text-xs text-muted-foreground">
                      {priceSort === "asc" ? "↑" : priceSort === "desc" ? "↓" : ""}
                    </span>
                  </button>
                </th>
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
                        <div className="max-h-48 overflow-y-auto">
                          {statusOptions.map((option) => (
                            <label
                              key={option.value}
                              className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-white/10 focus-within:bg-white/10"
                            >
                              <input
                                type="checkbox"
                                checked={statusFilter.includes(option.value)}
                                onChange={() => handleStatusToggle(option.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 rounded border-white/20 bg-background text-primary focus:ring-white/20 cursor-pointer shrink-0"
                              />
                              <span className="truncate">{option.label}</span>
                            </label>
                          ))}
                        </div>
                        {statusFilter.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setStatusFilter([]);
                                  setCurrentPage(1);
                                  setPageInput("1");
                                }}
                                className="text-muted-foreground hover:underline cursor-pointer"
                              >
                                Clear selection
                              </button>
                            </div>
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
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.status === "available"
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
