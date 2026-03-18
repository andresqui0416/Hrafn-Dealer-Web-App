"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faEdit,
  faTrash,
  faPlus,
  faX,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";

type Dealer = {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    inventory: number;
    userRoles: number;
  };
  userRoles?: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string;
    };
  }>;
};

export default function DealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [dealersLoading, setDealersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadDealers();

    // Cleanup: abort any pending requests when component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadDealers = async () => {
    // Abort previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setDealersLoading(true);
      const response = await fetch("/api/admin/dealers", {
        signal,
      });
      if (response.ok) {
        const data = await response.json();
        setDealers(data.dealers || []);
      } else {
        setError("Failed to load dealers");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Request was aborted, don't update state
      }
      if (!signal.aborted) {
        setError("Failed to load dealers");
      }
    } finally {
      if (!signal.aborted) {
        setDealersLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = editingDealer ? `/api/admin/dealers/${editingDealer.id}` : "/api/admin/dealers";
      const method = editingDealer ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to save dealer");
        return;
      }

      setShowForm(false);
      setEditingDealer(null);
      setFormData({ name: "", address: "" });
      loadDealers();
    } catch (err) {
      setError("Failed to save dealer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRowClick = (dealer: Dealer, e: React.MouseEvent) => {
    // Don't open modal if clicking on action buttons
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("svg") || target.closest("path")) {
      return;
    }
    setSelectedDealer(dealer);
    setShowModal(true);
  };

  const handleEdit = (dealer: Dealer, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setEditingDealer(dealer);
    setFormData({ name: dealer.name, address: dealer.address });
    setShowForm(true);
    setShowModal(false);
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!confirm("Are you sure you want to delete this dealer? This action cannot be undone.")) {
      return;
    }

    // Abort previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setDealersLoading(true);
      const response = await fetch(`/api/admin/dealers/${id}`, {
        method: "DELETE",
        signal,
      });
      if (response.ok) {
        loadDealers();
      } else {
        if (!signal.aborted) {
          const data = await response.json();
          setError(data.error || "Failed to delete dealer");
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Request was aborted, don't update state
      }
      if (!signal.aborted) {
        setError("Failed to delete dealer");
      }
    } finally {
      if (!signal.aborted) {
        setDealersLoading(false);
      }
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingDealer(null);
    setFormData({ name: "", address: "" });
    setError(null);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Manage dealers and their information
      </p>
      {error && (
        <div className="rounded-md bg-destructive/15 py-3 text-sm text-destructive">{error}</div>
      )}
      <div className="flex justify-end gap-2">
        {!showForm && (
          <>
            <Button
              variant="outline"
              onClick={loadDealers}
              disabled={dealersLoading}
              className="cursor-pointer transition-colors duration-200 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon
                icon={faRotateRight}
                className={`h-4 w-4 mr-2 ${dealersLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              className="cursor-pointer transition-colors duration-200"
            >
              <FontAwesomeIcon icon={faPlus} className="h-4 w-4 mr-2" />
              Add Dealer
            </Button>
          </>
        )}
      </div>
      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingDealer ? "Edit Dealer" : "Add New Dealer"}</CardTitle>
            <CardDescription>
              {editingDealer
                ? "Update dealer information"
                : "Create a new dealership in the system"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Dealer Name *
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ABC Auto Dealership"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="address" className="text-sm font-medium">
                  Address *
                </label>
                <Input
                  id="address"
                  name="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main St, City, State ZIP"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={submitting}
                  className="cursor-pointer transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="cursor-pointer transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : editingDealer ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-sm font-semibold">Dealer Name</th>
                    <th className="text-left p-4 text-sm font-semibold">Address</th>
                    <th className="text-left p-4 text-sm font-semibold">Owner</th>
                    <th className="text-center p-4 text-sm font-semibold">Inventory</th>
                    <th className="text-center p-4 text-sm font-semibold">Users</th>
                    <th className="text-left p-4 text-sm font-semibold">Created</th>
                    <th className="text-center p-4 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                {!dealersLoading && dealers.length > 0 && (
                  <tbody>
                    {dealers.map((dealer) => (
                      <tr
                        key={dealer.id}
                        onClick={(e) => handleRowClick(dealer, e)}
                        className="border-b border-white/5 hover:bg-white/10 transition-colors duration-200 cursor-pointer"
                      >
                        <td className="p-4">
                          <div className="font-medium">{dealer.name}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-muted-foreground">{dealer.address}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-medium">
                            {dealer.userRoles && dealer.userRoles.length > 0
                              ? dealer.userRoles[0].user.name
                              : "No owner"}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-sm font-medium">
                            {dealer._count?.inventory || 0}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-sm font-medium">
                            {dealer._count?.userRoles || 0}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-muted-foreground">
                            {new Date(dealer.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                                handleEdit(dealer, e)
                              }
                              className="h-8 w-8 p-0 cursor-pointer hover:bg-primary/20 transition-colors duration-200"
                            >
                              <FontAwesomeIcon icon={faEdit} className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                                handleDelete(dealer.id, e)
                              }
                              className="h-8 w-8 p-0 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/20 text-red-500 transition-colors duration-200 hover:bg-primary/20"
                            >
                              <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
              {dealersLoading && (
                <div className="p-4 text-center">
                  <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
                </div>
              )}
              {dealers.length === 0 && !dealersLoading && (
                <div className="p-4 text-center">
                  <p className="text-muted-foreground">No dealers found.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dealer Details Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader className="border-b-1 px-0 sticky top-0 bg-background">
            <div className="flex items-center justify-between">
              <DialogTitle>Dealer Details</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModal(false)}
                className="h-8 w-8 p-0 cursor-pointer"
              >
                <FontAwesomeIcon icon={faX} className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="text-xs">
              Complete information about the dealer
            </DialogDescription>
          </DialogHeader>
          {selectedDealer && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Dealer Name :</label>
                <p className="text-base font-medium mt-1">{selectedDealer.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Address :</label>
                <p className="text-base mt-1">{selectedDealer.address}</p>
              </div>
              {selectedDealer.userRoles && selectedDealer.userRoles.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Owner :</label>
                  <div className="mt-1 space-y-1">
                    <p className="text-base font-medium">
                      Name: {selectedDealer.userRoles[0].user.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Email: {selectedDealer.userRoles[0].user.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Phone Number: {selectedDealer.userRoles[0].user.phone}
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Inventory Items
                  </label>
                  <p className="text-base font-medium mt-1">
                    {selectedDealer._count?.inventory || 0}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Users</label>
                  <p className="text-base font-medium mt-1">
                    {selectedDealer._count?.userRoles || 0}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-base mt-1">
                    {new Date(selectedDealer.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="border-t-1 px-0 pb-0">
            {selectedDealer && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    handleEdit(selectedDealer);
                  }}
                  className="cursor-pointer"
                >
                  <FontAwesomeIcon icon={faEdit} className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowModal(false);
                    handleDelete(selectedDealer.id);
                  }}
                  className="cursor-pointer hover:bg-red-400 hover:text-white"
                >
                  <FontAwesomeIcon icon={faTrash} className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
