"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDollarSign, faSpinner, faCheckCircle, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

type PaymentHistoryItem = {
  id: string;
  plan: string | null;
  interval: string | null;
  amount: number | string | null;
  currency: string | null;
  issueDate: string | null;
  paymentMethod: string | null;
  createdAt: string;
  stripeInvoiceUrl: string | null;
};

export default function PaymentsPage() {
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"checkout" | "history">("checkout");
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);
  const hasConfirmedRef = useRef(false);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    const status = searchParams.get("subscription");
    const sessionId = searchParams.get("session_id");

    if (status === "success" && sessionId) {
      // In React StrictMode/dev, effects can run twice; guard so we only confirm once per mount.
      if (hasConfirmedRef.current) {
        return;
      }

      // Avoid calling confirm API multiple times for the same session
      if (typeof window !== "undefined") {
        const storageKey = `stripe_confirmed_session_${sessionId}`;
        if (sessionStorage.getItem(storageKey) === "done") {
          hasConfirmedRef.current = true;
          return;
        }
        sessionStorage.setItem(storageKey, "in-progress");
      }

      // Confirm subscription and update expiry date
      hasConfirmedRef.current = true;
      (async () => {
        try {
          const response = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sessionId }),
          });

          const data = await response.json();

          if (!response.ok) {
            setError(data.error || "Failed to confirm subscription.");
            return;
          }

          if (data.user?.subscriptionExpiresAt) {
            const expires = new Date(data.user.subscriptionExpiresAt);
            setSubscriptionExpiry(expires.toLocaleDateString());
            setSuccess(`Subscription updated. Expires on ${expires.toLocaleDateString()}.`);
          } else {
            setSuccess("Subscription updated.");
          }

          if (typeof window !== "undefined") {
            const storageKey = `stripe_confirmed_session_${sessionId}`;
            sessionStorage.setItem(storageKey, "done");
          }
        } catch (err) {
          setError("Failed to confirm subscription. Please try again.");
        }
      })();
    } else if (status === "cancelled") {
      setError("Payment was cancelled.");
    }
  }, [searchParams]);

  const handleCheckout = async () => {
    setError(null);
    setSuccess(null);

    setLoading(true);

    try {
      const response = await fetch("/api/payments/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to start checkout. Please try again.");
        setLoading(false);
        return;
      }

      if (!data.url) {
        setError("Checkout URL not returned. Please contact support.");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history" && !historyLoaded) {
      (async () => {
        try {
          setHistoryLoading(true);
          setHistoryError(null);
          const response = await fetch("/api/payments/history");
          const data = await response.json();
          if (!response.ok) {
            setHistoryError(data.error || "Failed to load payment history.");
            return;
          }
          setHistory(data.history || []);
          setHistoryLoaded(true);
        } catch (err) {
          setHistoryError("Failed to load payment history.");
        } finally {
          setHistoryLoading(false);
        }
      })();
    }
  }, [activeTab, historyLoaded]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Securely upgrade your dealer subscription using Stripe.
        </p>
        {subscriptionExpiry && (
          <p className="text-sm text-muted-foreground mt-1">
            Current subscription expires on <span className="font-semibold">{subscriptionExpiry}</span>.
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("checkout")}
            className={cn(
              "border-b-2 py-2 px-1 text-sm font-medium transition-colors",
              activeTab === "checkout"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            Checkout
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "border-b-2 py-2 px-1 text-sm font-medium transition-colors",
              activeTab === "history"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            History
          </button>
        </nav>
      </div>

      {/* Checkout Tab */}
      {activeTab === "checkout" && (
        <Card>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex items-center gap-2">
                <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4" />
                <span>{success}</span>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium">Choose your billing cycle</p>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPlan("monthly")}
                  disabled={loading}
                  className={cn(
                    "flex flex-col items-start rounded-md border p-4 text-left transition-colors",
                    plan === "monthly"
                      ? "border-primary bg-primary/10"
                      : "border-white/10 hover:border-primary/60",
                  )}
                >
                  <span className="text-sm font-semibold">Monthly</span>
                  <span className="text-lg font-bold mt-1">$250</span>
                  <span className="text-xs text-muted-foreground mt-1">Billed every month</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlan("annual")}
                  disabled={loading}
                  className={cn(
                    "flex flex-col items-start rounded-md border p-4 text-left transition-colors",
                    plan === "annual"
                      ? "border-primary bg-primary/10"
                      : "border-white/10 hover:border-primary/60",
                  )}
                >
                  <span className="text-sm font-semibold">Annual</span>
                  <span className="text-lg font-bold mt-1">$2000</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Billed once per year (best value)
                  </span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Exact prices are configured in Stripe for each plan.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleCheckout}
                disabled={loading}
                className={cn(loading ? "cursor-not-allowed" : "cursor-pointer")}
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                    Redirecting to Stripe...
                  </>
                ) : (
                  "Pay with Stripe"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <Card>
          <CardContent className="space-y-4">
            {historyError && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex items-center gap-2">
                <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4" />
                <span>{historyError}</span>
              </div>
            )}

            {historyLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" />
                <span>Loading history...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/10 text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 text-left">Date</th>
                      <th className="py-2 pr-4 text-left">Plan</th>
                      <th className="py-2 pr-4 text-left">Amount</th>
                      <th className="py-2 pr-4 text-left">Payment method</th>
                      <th className="py-2 pr-4 text-left">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td
                          className="py-3 px-4 text-sm text-muted-foreground text-center"
                          colSpan={5}
                        >
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      history.map((item) => {
                        const createdSource = item.issueDate || item.createdAt;
                        const created = new Date(createdSource).toLocaleDateString();
                        const rawAmount = item.amount;
                        const amountNumber =
                          typeof rawAmount === "number"
                            ? rawAmount
                            : rawAmount != null
                              ? parseFloat(rawAmount as string)
                              : null;
                        const amount =
                          amountNumber != null && !Number.isNaN(amountNumber)
                            ? `${item.currency?.toUpperCase() || "USD"} ${amountNumber.toFixed(2)}`
                            : "-";
                        const planLabel =
                          item.plan ||
                          (item.interval === "year"
                            ? "Annual"
                            : item.interval === "month"
                              ? "Monthly"
                              : "Subscription");

                        return (
                          <tr key={item.id} className="border-b border-white/5 last:border-0">
                            <td className="py-2 pr-4">{created}</td>
                            <td className="py-2 pr-4">{planLabel}</td>
                            <td className="py-2 pr-4">{amount}</td>
                            <td className="py-2 pr-4">
                              {item.paymentMethod || "-"}
                            </td>
                            <td className="py-2 pr-4">
                              {item.stripeInvoiceUrl ? (
                                <a
                                  href={item.stripeInvoiceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline"
                                >
                                  Download
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}