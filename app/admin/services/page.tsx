"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faX, faRotateRight, faCheckCircle, faTimesCircle, faClock, faEye } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

type DealerService = {
  id: string;
  dealerId: string;
  serviceKindId: string;
  orgName: string;
  status: "pending" | "reviewing" | "rejected" | "allowed";
  createdAt: string;
  updatedAt: string;
  dealer: {
    id: string;
    name: string;
    address: string;
  };
  serviceKind: {
    id: string;
    name: string;
    description: string | null;
  };
};

type SubscriptionInfo = {
  subscriptions: Array<{
    subscriptionId: string;
    orgId: string;
    orgName: string;
    dealerCodes: Array<{
      franchiseName: string;
      manufacturerCode: string;
      manufacturerParentCode: string;
    }>;
    status: string;
    activationDate: string;
    environment: string;
    deactivationDate: string;
    apiDmsInfo: Array<{
      id: string;
      name: string;
      departments: Array<{
        name: string;
        id: string;
        dmsType: string;
      }>;
    }>;
  }>;
};

export default function ServicesPage() {
  const [dealerServices, setDealerServices] = useState<DealerService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<DealerService | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadServices();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadServices = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      const response = await fetch("/api/admin/services", {
        signal,
      });
      if (response.ok) {
        const data = await response.json();
        setDealerServices(data.dealerServices || []);
      } else {
        if (!signal.aborted) {
          setError("Failed to load dealer services");
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (!signal.aborted) {
        setError("Failed to load dealer services");
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleRowClick = (service: DealerService) => {
    setSelectedService(service);
    setShowModal(true);
    setSubscriptionInfo(null);
    setSubscriptionError(null);

    // If it's CDK Global service, load subscription info
    if (service.serviceKind.name === "CDK Global") {
      loadSubscriptionInfo(service.orgName);
    }
  };

  const loadSubscriptionInfo = async (orgName: string) => {
    setLoadingSubscription(true);
    setSubscriptionError(null);

    try {
      // For now, we'll use a placeholder token. In production, this should come from the dealer's stored credentials
      // TODO: Store and retrieve CDK API tokens for each dealer

      const response = await fetch("/api/cdk/subscriptionInfo");

      if (response.ok) {
        const data = await response.json();
        setSubscriptionInfo(data);

        // Filter subscriptions by orgName if provided
        if (orgName && data.subscriptions) {
          console.log('orgName', orgName);
          const filtered = {
            ...data,
            subscriptions: data.subscriptions.filter(
              (sub: any) => sub.orgName.toLowerCase().includes(orgName.toLowerCase()) ||
                orgName.toLowerCase().includes(sub.orgName.toLowerCase())
            ),
          };
          setSubscriptionInfo(filtered);
        }
      } else {
        const errorData = await response.json();
        setSubscriptionError(errorData.error || "Failed to load subscription info");
      }
    } catch (err) {
      console.error("Failed to load subscription info:", err);
      setSubscriptionError("Failed to load subscription info");
    } finally {
      setLoadingSubscription(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
            <FontAwesomeIcon icon={faClock} className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
      case "reviewing":
        return (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400">
            <FontAwesomeIcon icon={faEye} className="h-3 w-3 mr-1" />
            Reviewing
          </span>
        );
      case "rejected":
        return (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-red-500/20 text-red-600 dark:text-red-400">
            <FontAwesomeIcon icon={faTimesCircle} className="h-3 w-3 mr-1" />
            Rejected
          </span>
        );
      case "allowed":
        return (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-500/20 text-green-600 dark:text-green-400">
            <FontAwesomeIcon icon={faCheckCircle} className="h-3 w-3 mr-1" />
            Allowed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-500/20 text-gray-600 dark:text-gray-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Service Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage dealer service requests and verify API access
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadServices}
          disabled={loading}
          className="cursor-pointer transition-colors duration-200 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon
            icon={faRotateRight}
            className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-500/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-sm font-semibold">Dealer</th>
                  <th className="text-left p-4 text-sm font-semibold">Service</th>
                  <th className="text-left p-4 text-sm font-semibold">Organization Name</th>
                  <th className="text-center p-4 text-sm font-semibold">Status</th>
                  <th className="text-left p-4 text-sm font-semibold">Requested</th>
                </tr>
              </thead>
              {!loading && dealerServices.length > 0 && (
                <tbody>
                  {dealerServices.map((service) => (
                    <tr
                      key={service.id}
                      onClick={() => handleRowClick(service)}
                      className="border-b border-white/5 hover:bg-white/10 transition-colors duration-200 cursor-pointer"
                    >
                      <td className="p-4">
                        <div className="font-medium">{service.dealer.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {service.dealer.address}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-medium">{service.serviceKind.name}</div>
                        {service.serviceKind.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {service.serviceKind.description}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm">{service.orgName}</div>
                      </td>
                      <td className="p-4 text-center">
                        {getStatusBadge(service.status)}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {new Date(service.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
            {loading && (
              <div className="p-4 text-center">
                <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
              </div>
            )}
            {dealerServices.length === 0 && !loading && (
              <div className="p-4 text-center">
                <p className="text-muted-foreground">No service requests found.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Service Details Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-white/10 pb-4 px-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Service Request Details</DialogTitle>
                <DialogDescription className="mt-2">
                  Verify organization name and check available APIs
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModal(false)}
                className="h-8 w-8 p-0 cursor-pointer"
              >
                <FontAwesomeIcon icon={faX} className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedService && (
            <div className="space-y-6 py-4">
              {/* Service Information */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Dealer</label>
                  <p className="text-base font-medium mt-1">{selectedService.dealer.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedService.dealer.address}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Service</label>
                  <p className="text-base font-medium mt-1">{selectedService.serviceKind.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Organization Name</label>
                  <p className="text-base font-medium mt-1">{selectedService.orgName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This should match the organization name registered in the CRM system
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedService.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Requested</label>
                  <p className="text-sm mt-1">
                    {new Date(selectedService.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* CDK Subscription Info */}
              {selectedService.serviceKind.name === "CDK Global" && (
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">CDK Subscription Information</h3>
                      <p className="text-sm text-muted-foreground">
                        Verify available APIs and subscription status
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadSubscriptionInfo(selectedService.orgName)}
                      disabled={loadingSubscription}
                      className="cursor-pointer"
                    >
                      <FontAwesomeIcon
                        icon={loadingSubscription ? faSpinner : faRotateRight}
                        className={`h-4 w-4 mr-2 ${loadingSubscription ? 'animate-spin' : ''}`}
                      />
                      Refresh
                    </Button>
                  </div>

                  {loadingSubscription && (
                    <div className="flex justify-center items-center py-8">
                      <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
                    </div>
                  )}

                  {subscriptionError && (
                    <div className="rounded-md bg-red-500/15 p-3 text-sm text-destructive mb-4">
                      {subscriptionError}
                    </div>
                  )}

                  {!loadingSubscription && subscriptionInfo && subscriptionInfo.subscriptions && (
                    <div className="space-y-4">
                      {subscriptionInfo.subscriptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No subscriptions found for this organization name.
                        </p>
                      ) : (
                        subscriptionInfo.subscriptions.map((subscription, idx) => (
                          <div
                            key={subscription.subscriptionId}
                            className="border border-white/10 rounded-lg p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-semibold">{subscription.orgName}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Subscription ID: {subscription.subscriptionId}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  "px-2 py-1 rounded-md text-xs font-medium",
                                  subscription.status === "active"
                                    ? "bg-green-500/20 text-green-600 dark:text-green-400"
                                    : "bg-gray-500/20 text-gray-600 dark:text-gray-400"
                                )}
                              >
                                {subscription.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Environment:</span>
                                <span className="ml-2 font-medium">{subscription.environment}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Activation Date:</span>
                                <span className="ml-2 font-medium">{subscription.activationDate}</span>
                              </div>
                            </div>

                            {subscription.dealerCodes && subscription.dealerCodes.length > 0 && (
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">
                                  Dealer Codes:
                                </label>
                                <div className="mt-2 space-y-1">
                                  {subscription.dealerCodes.map((code, codeIdx) => (
                                    <div
                                      key={codeIdx}
                                      className="text-sm bg-white/5 rounded p-2"
                                    >
                                      <div className="font-medium">{code.franchiseName}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {code.manufacturerCode} / {code.manufacturerParentCode}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {subscription.apiDmsInfo && subscription.apiDmsInfo.length > 0 && (
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">
                                  Available APIs ({subscription.apiDmsInfo.length}):
                                </label>
                                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                                  {subscription.apiDmsInfo.map((api) => (
                                    <div
                                      key={api.id}
                                      className="border border-white/10 rounded p-3 bg-white/5"
                                    >
                                      <div className="font-medium text-sm">{api.name}</div>
                                      {api.departments && api.departments.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          {api.departments.map((dept, deptIdx) => (
                                            <div
                                              key={deptIdx}
                                              className="text-xs text-muted-foreground flex items-center gap-2"
                                            >
                                              <span className="font-medium">{dept.name}</span>
                                              <span className="text-muted-foreground">•</span>
                                              <span>{dept.dmsType}</span>
                                              <span className="text-muted-foreground">•</span>
                                              <span>ID: {dept.id}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

