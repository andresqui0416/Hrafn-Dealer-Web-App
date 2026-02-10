"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faX, faTrash, faEdit } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DealerData = {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
};

type ServiceKind = {
  id: string;
  name: string;
  description: string | null;
};

type DealerService = {
  id: string;
  serviceKindId: string;
  orgName: string;
  status: "pending" | "reviewing" | "rejected" | "allowed";
  createdAt: string;
  updatedAt: string;
  serviceKind: {
    id: string;
    name: string;
    description: string | null;
  };
};

type TabType = "dealer" | "services";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("dealer");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Dealer data state
  const [dealerData, setDealerData] = useState<DealerData | null>(null);
  const [dealerName, setDealerName] = useState("");
  const [dealerAddress, setDealerAddress] = useState("");

  // Service application state
  const [serviceKinds, setServiceKinds] = useState<ServiceKind[]>([]);
  const [dealerServices, setDealerServices] = useState<DealerService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedServiceKind, setSelectedServiceKind] = useState<string>("");
  const [orgName, setOrgName] = useState("");
  const [submittingService, setSubmittingService] = useState(false);
  const [withdrawingServiceId, setWithdrawingServiceId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(null);

  // Load dealer data
  useEffect(() => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const loadDealerData = async () => {
      try {
        setDataLoading(true);
        const response = await fetch("/api/dealer", {
          signal: abortController.signal,
        });
        if (response.ok) {
          const data = await response.json();
          setDealerData(data.dealer);
          setDealerName(data.dealer.name);
          setDealerAddress(data.dealer.address);
          // Set initial org name to dealer name
          setOrgName(data.dealer.name);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to load dealer information");
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("Failed to load dealer data:", err);
        setError("Failed to load dealer information");
      } finally {
        if (!abortController.signal.aborted) {
          setDataLoading(false);
        }
      }
    };

    loadDealerData();

    return () => {
      abortController.abort();
    };
  }, []);

  // Load service kinds and dealer services
  useEffect(() => {
    const loadServices = async () => {
      try {
        setServicesLoading(true);
        const [kindsResponse, servicesResponse] = await Promise.all([
          fetch("/api/services/kinds"),
          fetch("/api/services/dealer"),
        ]);

        if (kindsResponse.ok) {
          const kindsData = await kindsResponse.json();
          setServiceKinds(kindsData.serviceKinds || []);
        }

        if (servicesResponse.ok) {
          const servicesData = await servicesResponse.json();
          setDealerServices(servicesData.dealerServices || []);
        }
      } catch (err) {
        console.error("Failed to load services:", err);
      } finally {
        setServicesLoading(false);
      }
    };

    if (activeTab === "services") {
      loadServices();
    }
  }, [activeTab]);

  // Auto-dismiss notifications after 3 seconds
  useEffect(() => {
    // Clear any existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    // Set new timeout if there's an error or success message
    if (error || success) {
      notificationTimeoutRef.current = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 3000);
    }

    // Cleanup on unmount
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [error, success]);

  const handleCloseError = () => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setError(null);
  };

  const handleCloseSuccess = () => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!dealerName || !dealerAddress) {
      setError("Dealer name and address are required");
      setLoading(false);
      return;
    }

    // Check if anything changed
    if (dealerData && dealerName === dealerData.name && dealerAddress === dealerData.address) {
      setError("No changes to save");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/dealer", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: dealerName,
          address: dealerAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update dealer information");
        setLoading(false);
        return;
      }

      setSuccess("Dealer information updated successfully");
      setDealerData(data.dealer);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmittingService(true);

    if (!selectedServiceKind || !orgName) {
      setError("Please select a service and enter organization name");
      setSubmittingService(false);
      return;
    }

    try {
      const response = await fetch("/api/services/dealer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceKindId: selectedServiceKind,
          orgName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit service request");
        setSubmittingService(false);
        return;
      }

      setSuccess("Service request submitted successfully");
      setSelectedServiceKind("");
      setOrgName(dealerData?.name || "");

      // Reload services
      const servicesResponse = await fetch("/api/services/dealer");
      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        setDealerServices(servicesData.dealerServices || []);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmittingService(false);
    }
  };

  const handleEditService = (service: DealerService) => {
    setEditingServiceId(service.id);
    setEditOrgName(service.orgName);
  };

  const handleCancelEdit = () => {
    setEditingServiceId(null);
    setEditOrgName("");
  };

  const handleUpdateService = async () => {
    if (!editingServiceId || !editOrgName.trim()) {
      setError("Organization name is required");
      return;
    }

    setUpdatingServiceId(editingServiceId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/services/dealer/${editingServiceId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orgName: editOrgName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update organization name");
        setUpdatingServiceId(null);
        return;
      }

      setSuccess("Organization name updated successfully");
      setEditingServiceId(null);
      setEditOrgName("");

      setServicesLoading(true);
      // Reload services
      const servicesResponse = await fetch("/api/services/dealer");
      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        setDealerServices(servicesData.dealerServices || []);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setServicesLoading(false);
      setUpdatingServiceId(null);
    }
  };

  const handleWithdrawService = async (serviceId: string) => {
    if (
      !confirm(
        "Are you sure you want to withdraw this service request? This action cannot be undone.",
      )
    ) {
      return;
    }

    setWithdrawingServiceId(serviceId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/services/dealer/${serviceId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to withdraw service request");
        return;
      }

      setSuccess("Service request withdrawn successfully");

      // Reload services
      const servicesResponse = await fetch("/api/services/dealer");
      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        setDealerServices(servicesData.dealerServices || []);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setWithdrawingServiceId(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400";
      case "reviewing":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
      case "rejected":
        return "bg-red-500/20 text-red-600 dark:text-red-400";
      case "allowed":
        return "bg-green-500/20 text-green-600 dark:text-green-400";
      default:
        return "bg-gray-500/20 text-gray-600 dark:text-gray-400";
    }
  };

  if (dataLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
        <p className="text-sm text-muted-foreground ml-2">Loading dealer information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage your dealership information and service applications
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-500/15 p-3 text-sm text-destructive flex items-center justify-between gap-2">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCloseError}
            className="h-6 w-6 p-0 cursor-pointer hover:bg-red-500/20"
          >
            <FontAwesomeIcon icon={faX} className="h-3 w-3" />
          </Button>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-500/15 p-3 text-sm text-white flex items-center justify-between gap-2">
          <span>{success}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCloseSuccess}
            className="h-6 w-6 p-0 cursor-pointer hover:bg-green-500/20"
          >
            <FontAwesomeIcon icon={faX} className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("dealer")}
            className={cn(
              "border-b-2 py-4 px-1 text-sm font-medium transition-colors",
              activeTab === "dealer"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            Dealer Information
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={cn(
              "border-b-2 py-4 px-1 text-sm font-medium transition-colors",
              activeTab === "services"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            Service Application
          </button>
        </nav>
      </div>

      {/* Dealer Information Tab */}
      {activeTab === "dealer" && (
        <Card>
          <CardHeader>
            <CardTitle>Dealer Information</CardTitle>
            <CardDescription>Update your dealership name and address</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="dealerName" className="text-sm font-medium">
                  Dealer Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="dealerName"
                  name="dealerName"
                  type="text"
                  placeholder="ABC Auto Dealership"
                  value={dealerName}
                  onChange={(e) => setDealerName(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="organization"
                />
                <p className="text-xs text-muted-foreground">
                  This name must be unique across all dealers
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="dealerAddress" className="text-sm font-medium">
                  Dealer Address <span className="text-destructive">*</span>
                </label>
                <Input
                  id="dealerAddress"
                  name="dealerAddress"
                  type="text"
                  placeholder="123 Main St, City, State ZIP"
                  value={dealerAddress}
                  onChange={(e) => setDealerAddress(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="street-address"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Service Application Tab */}
      {activeTab === "services" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request New Service</CardTitle>
              <CardDescription>
                Request access to CRM services. The organization name should match the name
                registered in the CRM system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleServiceSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="serviceKind" className="text-sm font-medium">
                    Service <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="serviceKind"
                    value={selectedServiceKind}
                    onChange={(e) => setSelectedServiceKind(e.target.value)}
                    disabled={submittingService || servicesLoading}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="">Select a service</option>
                    {serviceKinds.map((kind) => (
                      <option key={kind.id} value={kind.id}>
                        {kind.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="orgName" className="text-sm font-medium">
                    Organization Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="orgName"
                    name="orgName"
                    type="text"
                    placeholder="Enter organization name as registered in CRM"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    disabled={submittingService}
                  />
                  <p className="text-xs text-muted-foreground">
                    This should match the organization name registered in the CRM system
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="submit" disabled={submittingService || servicesLoading}>
                    {submittingService ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>View the status of your service requests</CardDescription>
            </CardHeader>
            <CardContent>
              {servicesLoading ? (
                <div className="flex justify-center items-center py-10">
                  <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
                </div>
              ) : dealerServices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No service requests found
                </p>
              ) : (
                <div className="space-y-4">
                  {dealerServices.map((service) => (
                    <div
                      key={service.id}
                      className="border border-white/10 rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold">{service.serviceKind.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">
                              Organization: {service.orgName}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditService(service)}
                              disabled={
                                withdrawingServiceId === service.id ||
                                updatingServiceId === service.id
                              }
                              className="h-6 w-6 p-0 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors duration-200"
                              title="Edit organization name"
                            >
                              <FontAwesomeIcon icon={faEdit} className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "px-2 py-1 rounded-md text-xs font-medium capitalize",
                              getStatusBadgeColor(service.status),
                            )}
                          >
                            {service.status}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleWithdrawService(service.id)}
                            disabled={
                              withdrawingServiceId === service.id ||
                              updatingServiceId === service.id
                            }
                            className="h-8 w-8 p-0 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/20 transition-colors duration-200"
                            title="Withdraw service request"
                          >
                            <FontAwesomeIcon
                              icon={withdrawingServiceId === service.id ? faSpinner : faTrash}
                              className={cn(
                                "h-4 w-4",
                                withdrawingServiceId === service.id && "animate-spin",
                              )}
                            />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Requested: {new Date(service.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Organization Name Dialog */}
      <Dialog open={editingServiceId !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization Name</DialogTitle>
            <DialogDescription>
              Update the organization name for this service request. This should match the name
              registered in the CRM system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="editOrgName" className="text-sm font-medium">
                Organization Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="editOrgName"
                name="editOrgName"
                type="text"
                placeholder="Enter organization name as registered in CRM"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                required
                disabled={updatingServiceId !== null}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleUpdateService();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                This should match the organization name registered in the CRM system
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={updatingServiceId !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateService}
              disabled={updatingServiceId !== null || !editOrgName.trim()}
            >
              {updatingServiceId !== null ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
