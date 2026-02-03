"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
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
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pageInput, setPageInput] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [offerTypeFilter, setOfferTypeFilter] = useState<string[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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

      const response = await fetch(`/api/offers?${params.toString()}`, { signal });
      if (response.ok) {
        const data = await response.json();
        setOffers(data.offers || []);
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
  }, [currentPage, itemsPerPage, searchQuery, offerTypeFilter]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const offerTypeOptions = [
    { value: "cash", label: "Cash/Credit" },
    { value: "financing", label: "Financing" },
    { value: "lease", label: "Lease" },
  ];

  const handleOfferTypeToggle = (type: string) => {
    setOfferTypeFilter((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
    setCurrentPage(1);
    setPageInput("1");
  };

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
            placeholder="Search by brand, model, or terms..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
              setPageInput("1");
            }}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="gap-2">
          <FontAwesomeIcon
            icon={refreshing ? faSpinner : faRotateRight}
            className={cn("h-4 w-4", refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FontAwesomeIcon icon={faFilter} className="h-4 w-4" />
              Filter by Type
              {offerTypeFilter.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                  {offerTypeFilter.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-background text-foreground">
            <DropdownMenuLabel>Filter by Offer Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {offerTypeOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={offerTypeFilter.includes(option.value)}
                onCheckedChange={() => handleOfferTypeToggle(option.value)}
                className="cursor-pointer"
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
            {offerTypeFilter.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={false}
                  onCheckedChange={() => {
                    setOfferTypeFilter([]);
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

      {/* Table */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Brand</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Year</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Model</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Cash Back</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Trade Discount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">APR</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Term</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Expires</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            {!offersLoading && offers.length !== 0 && (
              <tbody className="divide-y divide-white/10">
                {offers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-sm">{offer.brand}</td>
                    <td className="px-4 py-3 text-sm">{offer.year || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <div className="font-medium">{offer.model || "-"}</div>
                        {offer.trim && (
                          <div className="text-xs text-muted-foreground">{offer.trim}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{getOfferTypeBadge(offer.offerType)}</td>
                    <td className="px-4 py-3 text-sm">
                      {offer.offerType === "lease"
                        ? // For lease, show monthly payment only
                          offer.leaseMonthlyPayment
                          ? formatCurrency(offer.leaseMonthlyPayment)
                          : "-"
                        : offer.offerType === "financing"
                          ? // For financing, show "-"
                            "-"
                          : // For cash offers, show offer amount only
                            offer.offerAmount
                            ? formatCurrency(offer.offerAmount)
                            : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {offer.cashValue ? formatCurrency(offer.cashValue) : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {offer.tradeDiscount ? formatCurrency(offer.tradeDiscount) : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {offer.aprRate ? `${(offer.aprRate * 100).toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {offer.offerType === "lease"
                        ? offer.leaseTermMonths
                          ? `${offer.leaseTermMonths} months`
                          : "-"
                        : offer.offerType === "financing"
                          ? offer.aprTermMonths
                            ? `${offer.aprTermMonths} months`
                            : "-"
                          : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {offer.expirationDate ? (
                        <span
                          className={cn(
                            isExpired(offer.expirationDate) && "text-red-400 line-through",
                          )}
                        >
                          {formatDate(offer.expirationDate)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {offersLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <FontAwesomeIcon icon={faSpinner} className="fa-lg animate-spin" />
              <span>Loading offers...</span>
            </div>
          ) : (
            offers.length === 0 &&
            !offersLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faTag} className="fa-lg" />
                <span>No offers found.</span>
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
                  {pagination.totalCount} offer{pagination.totalCount !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  Showing {offers.length} offer{offers.length !== 1 ? "s" : ""}
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
                disabled={offersLoading}
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
                disabled={!pagination.hasPreviousPage || offersLoading}
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
                  disabled={offersLoading}
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
                disabled={!pagination.hasNextPage || offersLoading}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

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
