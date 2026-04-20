"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsoleDataTable, ConsoleTableColumn } from "@/components/console-data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faSearch,
  faFilter,
  faTag,
  faCalendarAlt,
  faDollarSign,
  faInfoCircle,
  faX,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

type Offer = {
  id: string;
  brand: string;
  year: number | null;
  make: string | null;
  model: string | null;
  modelCode: string | null;
  trim: string | null;
  offerType: string;
  offerAmount: number | null;
  aprRate: number | null;
  aprTermMonths: number | null;
  leaseTermMonths: number | null;
  cashValue: number | null;
  tradeDiscount: number | null;
  leaseDueAtSigning: number | null;
  leaseMonthlyPayment: number | null;
  milesPerYear: number | null;
  expirationDate: string | null;
  terms: string | null;
  finePrint: string | null;
  scrapedAt: string;
  sourceUrl: string | null;
  loyaltyBonus: number | null;
  conquestBonus: number | null;
  militaryDiscount: number | null;
  collegeGrad: number | null;
  firstResponder: number | null;
};

type PaginationInfo = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export default function OffersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pageInput, setPageInput] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [offerTypeFilter, setOfferTypeFilter] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [pendingBrands, setPendingBrands] = useState<string[]>([]);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [pendingOfferTypes, setPendingOfferTypes] = useState<string[]>([]);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const brandSearchInputRef = useRef<HTMLInputElement | null>(null);

  const loadOffers = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setOffersLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      if (offerTypeFilter.length > 0) {
        offerTypeFilter.forEach((type) => {
          params.append("offerType", type);
        });
      }

      brandFilter.forEach((b) => params.append("brand", b));

      if (includeExpired) {
        params.append("includeExpired", "true");
      }
      if (includeUnverified) {
        params.append("includeUnverified", "true");
      }

      const response = await fetch(`/api/incentives?${params.toString()}`, { signal });
      if (response.ok) {
        const data = await response.json();
        setOffers(data.incentives || []);
        setPagination(data.pagination || null);
        // Update page input to match current page
        if (data.pagination) {
          setPageInput(data.pagination.page.toString());
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Error loading offers:", error);
    } finally {
      if (!signal.aborted) {
        setOffersLoading(false);
      }
    }
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    offerTypeFilter,
    brandFilter,
    includeExpired,
    includeUnverified,
  ]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const loadBrands = useCallback(async () => {
    setBrandsLoading(true);
    try {
      const res = await fetch("/api/incentives/brands");
      if (res.ok) {
        const data = await res.json();
        setAvailableBrands(data.brands || []);
      }
    } catch (err) {
      console.error("Error loading brands:", err);
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    if (!searchParams) return;

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const searchParam = searchParams.get("search") || "";
    const offerTypeParams = searchParams.getAll("offerType");
    const brandParams = searchParams.getAll("brand");
    const includeExpiredParam = searchParams.get("includeExpired");
    const includeUnverifiedParam = searchParams.get("includeUnverified");

    if (pageParam && !Number.isNaN(parseInt(pageParam, 10))) {
      const pageNum = parseInt(pageParam, 10);
      setCurrentPage(pageNum);
      setPageInput(pageNum.toString());
    }
    if (limitParam && !Number.isNaN(parseInt(limitParam, 10))) {
      setItemsPerPage(parseInt(limitParam, 10));
    }
    setSearchQuery(searchParam);
    setOfferTypeFilter(offerTypeParams);
    setBrandFilter(brandParams);
    setIncludeExpired(includeExpiredParam === "true");
    setIncludeUnverified(includeUnverifiedParam === "true");
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

    params.delete("offerType");
    offerTypeFilter.forEach((type) => params.append("offerType", type));

    params.delete("brand");
    brandFilter.forEach((brand) => params.append("brand", brand));

    if (includeExpired) {
      params.set("includeExpired", "true");
    } else {
      params.delete("includeExpired");
    }

    if (includeUnverified) {
      params.set("includeUnverified", "true");
    } else {
      params.delete("includeUnverified");
    }

    router.replace(`?${params.toString()}`, { scroll: false });
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    offerTypeFilter,
    brandFilter,
    includeExpired,
    includeUnverified,
    router,
    searchParams,
  ]);

  const handleBrandDropdownOpenChange = useCallback(
    (open: boolean) => {
      setBrandDropdownOpen(open);
      if (open) {
        setPendingBrands([...brandFilter]);
      } else {
        setBrandSearchQuery("");
      }
    },
    [brandFilter],
  );

  const applyBrandFilter = useCallback(() => {
    setBrandFilter(pendingBrands);
    setCurrentPage(1);
    setPageInput("1");
    setBrandDropdownOpen(false);
  }, [pendingBrands]);

  const resetBrandFilter = useCallback(() => {
    setPendingBrands([]);
    setBrandFilter([]);
    setCurrentPage(1);
    setPageInput("1");
    setBrandDropdownOpen(false);
  }, []);

  const filteredBrandsForDropdown = availableBrands.filter((b) =>
    b.toLowerCase().includes(brandSearchQuery.trim().toLowerCase()),
  );

  // Keep focus on search input when typing; Radix moves focus to first menu item when list updates
  useEffect(() => {
    if (brandDropdownOpen && brandSearchInputRef.current) {
      const el = brandSearchInputRef.current;
      requestAnimationFrame(() => el.focus());
    }
  }, [brandSearchQuery, brandDropdownOpen]);

  const offerTypeOptions = [
    { value: "cash", label: "Cash/Credit" },
    { value: "financing", label: "Financing" },
    { value: "lease", label: "Lease" },
  ];

  const handleTypeDropdownOpenChange = useCallback(
    (open: boolean) => {
      setTypeDropdownOpen(open);
      if (open) {
        setPendingOfferTypes([...offerTypeFilter]);
      }
    },
    [offerTypeFilter],
  );

  const applyTypeFilter = useCallback(() => {
    setOfferTypeFilter(pendingOfferTypes);
    setCurrentPage(1);
    setPageInput("1");
    setTypeDropdownOpen(false);
  }, [pendingOfferTypes]);

  const resetTypeFilter = useCallback(() => {
    setPendingOfferTypes([]);
    setOfferTypeFilter([]);
    setCurrentPage(1);
    setPageInput("1");
    setTypeDropdownOpen(false);
  }, []);

  const getOfferTypeBadge = (type: string) => {
    const typeInfo: Record<string, { label: string; className: string }> = {
      cash: { label: "Cash/Credit", className: "bg-green-500/20 text-green-400" },
      financing: { label: "Financing", className: "bg-blue-500/20 text-blue-400" },
      lease: { label: "Lease", className: "bg-purple-500/20 text-purple-400" },
    };

    const info = typeInfo[type] || { label: type, className: "bg-gray-500/20 text-gray-400" };

    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
          info.className,
        )}
      >
        {info.label}
      </span>
    );
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "-";
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isExpired = (expirationDate: string | null) => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadOffers();
    } catch (error: any) {
      console.error("Error refreshing offers:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const offerColumns: ConsoleTableColumn<Offer>[] = [
    {
      id: "brand",
      header: (
        <span className="flex items-center gap-1.5">
          <span>Brand</span>
          <DropdownMenu open={brandDropdownOpen} onOpenChange={handleBrandDropdownOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 cursor-pointer"
                title="Filter by brand"
              >
                <FontAwesomeIcon
                  icon={faFilter}
                  className={cn(
                    "h-3.5 w-3.5",
                    brandFilter.length > 0 && "text-primary",
                  )}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-56 bg-background text-foreground"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div className="p-2">
                <Input
                  ref={brandSearchInputRef}
                  placeholder="Search brands..."
                  value={brandSearchQuery}
                  onChange={(e) => setBrandSearchQuery(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <DropdownMenuSeparator />
              {!brandsLoading && filteredBrandsForDropdown.length > 0 && (
                <div className="px-2 py-1 flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setPendingBrands((prev) => {
                        const combined = new Set([...prev, ...filteredBrandsForDropdown]);
                        return [...combined];
                      })
                    }
                    className="text-primary hover:underline cursor-pointer"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingBrands([])}
                    className="text-muted-foreground hover:underline cursor-pointer"
                  >
                    Clear selection
                  </button>
                </div>
              )}
              <div className="max-h-48 overflow-y-auto">
                {brandsLoading ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    Loading…
                  </div>
                ) : filteredBrandsForDropdown.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    No brands found
                  </div>
                ) : (
                  filteredBrandsForDropdown.map((brand) => (
                    <label
                      key={brand}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-white/10 focus-within:bg-white/10"
                    >
                      <input
                        type="checkbox"
                        checked={pendingBrands.includes(brand)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setPendingBrands((prev) =>
                            checked ? [...prev, brand] : prev.filter((b) => b !== brand),
                          );
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-white/20 bg-background text-primary focus:ring-white/20 cursor-pointer shrink-0"
                      />
                      <span className="truncate">{brand}</span>
                    </label>
                  ))
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="p-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={resetBrandFilter}
                >
                  Reset
                </Button>
                <Button size="sm" className="flex-1" onClick={applyBrandFilter}>
                  Filter
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ),
      render: (offer) => offer.brand,
      className: "py-3 text-sm",
    },
    { id: "year", header: "Year", render: (offer) => offer.year || "-", className: "py-3 text-sm" },
    {
      id: "model",
      header: "Model",
      render: (offer) => (
        <div>
          <div className="font-medium">{offer.model || "-"}</div>
          {offer.trim && <div className="text-xs text-muted-foreground">{offer.trim}</div>}
        </div>
      ),
      className: "py-3 text-sm",
    },
    {
      id: "offerType",
      header: (
        <span className="flex items-center gap-1.5">
          <span>Type</span>
          <DropdownMenu
            open={typeDropdownOpen}
            onOpenChange={handleTypeDropdownOpenChange}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 cursor-pointer"
                title="Filter by offer type"
              >
                <FontAwesomeIcon
                  icon={faFilter}
                  className={cn(
                    "h-3.5 w-3.5",
                    offerTypeFilter.length > 0 && "text-primary",
                  )}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 bg-background text-foreground"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div className="max-h-48 overflow-y-auto py-1">
                {offerTypeOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-white/10 focus-within:bg-white/10"
                  >
                    <input
                      type="checkbox"
                      checked={pendingOfferTypes.includes(option.value)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPendingOfferTypes((prev) =>
                          checked ? [...prev, option.value] : prev.filter((t) => t !== option.value),
                        );
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-white/20 bg-background text-primary focus:ring-white/20 cursor-pointer shrink-0"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <DropdownMenuSeparator />
              <div className="p-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={resetTypeFilter}
                >
                  Reset
                </Button>
                <Button size="sm" className="flex-1" onClick={applyTypeFilter}>
                  Filter
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ),
      render: (offer) => getOfferTypeBadge(offer.offerType),
      className: "py-3 text-sm",
    },
    {
      id: "amount",
      header: "Amount",
      render: (offer) => (offer.offerAmount != null ? formatCurrency(offer.offerAmount) : "-"),
      className: "py-3 text-sm",
    },
    {
      id: "leaseMonthly",
      header: "Lease/mo",
      render: (offer) => (offer.leaseMonthlyPayment != null ? formatCurrency(offer.leaseMonthlyPayment) : "-"),
      className: "py-3 text-sm",
    },
    {
      id: "cashValue",
      header: "Cash Back",
      render: (offer) => (offer.cashValue ? formatCurrency(offer.cashValue) : "-"),
      className: "py-3 text-sm",
    },
    {
      id: "aprRate",
      header: "APR",
      render: (offer) => (offer.aprRate ? `${(offer.aprRate * 100).toFixed(2)}%` : "-"),
      className: "py-3 text-sm",
    },
    {
      id: "term",
      header: "Term",
      render: (offer) =>
        offer.offerType === "lease"
          ? offer.leaseTermMonths
            ? `${offer.leaseTermMonths} months`
            : "-"
          : offer.offerType === "financing"
            ? offer.aprTermMonths
              ? `${offer.aprTermMonths} months`
              : "-"
            : "-",
      className: "py-3 text-sm",
    },
    {
      id: "expirationDate",
      header: "Expires",
      render: (offer) =>
        offer.expirationDate ? (
          <span className={cn(isExpired(offer.expirationDate) && "text-red-400 line-through")}>
            {formatDate(offer.expirationDate)}
          </span>
        ) : (
          "-"
        ),
      className: "py-3 text-sm",
    },
    {
      id: "actions",
      header: "Actions",
      render: (offer) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedOffer(offer);
            setShowDetailsModal(true);
          }}
          className="gap-2 hover:cursor-pointer"
        >
          <FontAwesomeIcon icon={faInfoCircle} className="h-4 w-4" />
          Details
        </Button>
      ),
      className: "py-3 text-sm",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Offers</h2>
          <p className="text-sm text-muted-foreground">
            View current vehicle offers and incentives (public data)
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:gap-4">
        <div className="relative min-w-0 w-full lg:flex-1 lg:max-w-md">
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            id="search"
            name="search"
            type="text"
            placeholder="Search by brand, model, or terms..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
              setPageInput("1");
            }}
            className="min-h-10 pl-10 w-full"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2 lg:flex-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
          <label className="flex min-w-0 items-start gap-3 text-sm cursor-pointer select-none sm:items-center">
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={(e) => {
                setIncludeExpired(e.target.checked);
                setCurrentPage(1);
                setPageInput("1");
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-background text-primary focus:ring-white/20 sm:mt-0"
            />
            <span className="min-w-0 leading-snug">Include expired offers</span>
          </label>
          <label className="flex min-w-0 items-start gap-3 text-sm cursor-pointer select-none sm:items-center">
            <input
              type="checkbox"
              checked={includeUnverified}
              onChange={(e) => {
                setIncludeUnverified(e.target.checked);
                setCurrentPage(1);
                setPageInput("1");
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-background text-primary focus:ring-white/20 sm:mt-0"
            />
            <span className="min-w-0 leading-snug">Include unverified offers</span>
          </label>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="min-h-10 w-full shrink-0 gap-2 lg:ml-auto lg:w-auto"
        >
          <FontAwesomeIcon
            icon={refreshing ? faSpinner : faRotateRight}
            className={cn("h-4 w-4", refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <ConsoleDataTable
        columns={offerColumns}
        rows={offers}
        loading={offersLoading}
        getRowKey={(row) => row.id}
        pagination={
          pagination
            ? {
                page: pagination.page,
                pageSize: pagination.limit,
                totalCount: pagination.totalCount,
                totalPages: pagination.totalPages,
              }
            : null
        }
        pageInput={pageInput}
        setPageInput={setPageInput}
        onPageChange={(pageNum) => {
          setCurrentPage(pageNum);
          setPageInput(pageNum.toString());
        }}
        onPageSizeChange={(size) => {
          setItemsPerPage(size);
          setCurrentPage(1);
          setPageInput("1");
        }}
        pageSizeOptions={[25, 50, 100, 200]}
        itemsLabel="offers"
      />

      {/* Offer Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-white/10 pb-4 px-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Offer Details</DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetailsModal(false)}
                className="h-8 w-8 p-0 cursor-pointer"
              >
                <FontAwesomeIcon icon={faX} className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedOffer && (
            <div className="space-y-6 pt-4">
              {/* Vehicle Information */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Vehicle</label>
                  <p className="text-base font-medium mt-1">
                    {selectedOffer.year && `${selectedOffer.year} `}
                    {selectedOffer.brand} {selectedOffer.model || ""}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {selectedOffer.make && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Make</label>
                      <p className="text-sm mt-1">{selectedOffer.make}</p>
                    </div>
                  )}
                  {selectedOffer.modelCode && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Model Code
                      </label>
                      <p className="text-sm mt-1">{selectedOffer.modelCode}</p>
                    </div>
                  )}
                  {selectedOffer.trim && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Trim</label>
                      <p className="text-sm mt-1">{selectedOffer.trim}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Offer Type</label>
                    <div className="mt-1">{getOfferTypeBadge(selectedOffer.offerType)}</div>
                  </div>
                  {selectedOffer.expirationDate && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Expiration
                      </label>
                      <p className="text-sm mt-1">
                        <span
                          className={cn(
                            isExpired(selectedOffer.expirationDate) && "text-red-400 line-through",
                          )}
                        >
                          {formatDate(selectedOffer.expirationDate)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Details */}
              {(selectedOffer.cashValue !== null ||
                selectedOffer.tradeDiscount !== null ||
                selectedOffer.offerAmount !== null ||
                selectedOffer.aprRate !== null ||
                selectedOffer.aprTermMonths !== null ||
                selectedOffer.leaseTermMonths !== null ||
                selectedOffer.leaseDueAtSigning !== null ||
                selectedOffer.leaseMonthlyPayment !== null ||
                selectedOffer.milesPerYear !== null) && (
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-lg font-semibold mb-4">Financial Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedOffer.offerAmount !== null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <FontAwesomeIcon icon={faDollarSign} className="h-3 w-3" />
                          Offer Amount
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {formatCurrency(selectedOffer.offerAmount)}
                        </p>
                      </div>
                    )}
                    {selectedOffer.leaseMonthlyPayment !== null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Monthly Payment
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {formatCurrency(selectedOffer.leaseMonthlyPayment)}
                        </p>
                      </div>
                    )}
                    {selectedOffer.leaseTermMonths !== null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Lease Term
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {selectedOffer.leaseTermMonths} months
                        </p>
                      </div>
                    )}
                    {selectedOffer.aprTermMonths !== null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          APR Term
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {selectedOffer.aprTermMonths} months
                        </p>
                      </div>
                    )}
                    {selectedOffer.leaseDueAtSigning !== null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Due at Signing
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {formatCurrency(selectedOffer.leaseDueAtSigning)}
                        </p>
                      </div>
                    )}
                    {selectedOffer.cashValue !== null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <FontAwesomeIcon icon={faDollarSign} className="h-3 w-3" />
                          Cash Value
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {formatCurrency(selectedOffer.cashValue)}
                        </p>
                      </div>
                    )}
                    {selectedOffer.tradeDiscount !== null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <FontAwesomeIcon icon={faDollarSign} className="h-3 w-3" />
                          Trade Discount
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {formatCurrency(selectedOffer.tradeDiscount)}
                        </p>
                      </div>
                    )}
                    {selectedOffer.aprRate !== null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">APR</label>
                        <p className="text-lg font-semibold mt-1">
                          {(selectedOffer.aprRate * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}
                    {selectedOffer.milesPerYear !== null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Miles/Year
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {selectedOffer.milesPerYear.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bonuses & Discounts */}
              {(selectedOffer.loyaltyBonus != null ||
                selectedOffer.conquestBonus != null ||
                selectedOffer.militaryDiscount != null ||
                selectedOffer.collegeGrad != null ||
                selectedOffer.firstResponder != null) && (
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-lg font-semibold mb-4">Bonuses & Discounts</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedOffer.loyaltyBonus != null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <FontAwesomeIcon icon={faDollarSign} className="h-3 w-3" />
                          Loyalty Bonus
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {formatCurrency(Number(selectedOffer.loyaltyBonus))}
                        </p>
                      </div>
                    )}
                    {selectedOffer.conquestBonus != null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <FontAwesomeIcon icon={faDollarSign} className="h-3 w-3" />
                          Conquest Bonus
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {formatCurrency(Number(selectedOffer.conquestBonus))}
                        </p>
                      </div>
                    )}
                    {selectedOffer.militaryDiscount != null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <FontAwesomeIcon icon={faDollarSign} className="h-3 w-3" />
                          Military Discount
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {formatCurrency(Number(selectedOffer.militaryDiscount))}
                        </p>
                      </div>
                    )}
                    {selectedOffer.collegeGrad != null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <FontAwesomeIcon icon={faDollarSign} className="h-3 w-3" />
                          College Grad
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {formatCurrency(Number(selectedOffer.collegeGrad))}
                        </p>
                      </div>
                    )}
                    {selectedOffer.firstResponder != null && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <FontAwesomeIcon icon={faDollarSign} className="h-3 w-3" />
                          First Responder
                        </label>
                        <p className="text-lg font-semibold mt-1">
                          {formatCurrency(Number(selectedOffer.firstResponder))}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Terms and Conditions */}
              {(selectedOffer.terms || selectedOffer.finePrint) && (
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-lg font-semibold mb-4">Terms & Conditions</h3>
                  {selectedOffer.terms && (
                    <div className="mb-4">
                      <label className="text-sm font-medium text-muted-foreground">
                        Description
                      </label>
                      <div className="text-sm mt-1 whitespace-pre-wrap">
                        <div dangerouslySetInnerHTML={{ __html: selectedOffer.terms }}></div>
                      </div>
                    </div>
                  )}
                  {selectedOffer.finePrint && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Fine Print
                      </label>
                      <div className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground">
                        <div dangerouslySetInnerHTML={{ __html: selectedOffer.finePrint }}></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalendarAlt} className="h-3 w-3" />
                    Last Scraped
                  </label>
                  <p className="text-sm mt-1">{formatDate(selectedOffer.scrapedAt)}</p>
                </div>
                {selectedOffer.sourceUrl && (
                  <div className="text-right">
                    <a
                      href={selectedOffer.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-muted-foreground block hover:underline"
                    >
                      Source Link
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
