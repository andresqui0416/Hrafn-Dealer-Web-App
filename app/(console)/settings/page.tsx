"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

type DealerData = {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Dealer data state
  const [dealerData, setDealerData] = useState<DealerData | null>(null);
  const [dealerName, setDealerName] = useState("");
  const [dealerAddress, setDealerAddress] = useState("");

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
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to load dealer information");
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
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

  if (dataLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
        <p className="text-sm text-muted-foreground ml-2">Loading dealer information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6 px-4 md:px-6 lg:px-8">
      <div>
        <h2 className="text-2xl font-semibold">Dealer Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your dealership information
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dealer Information</CardTitle>
          <CardDescription>
            Update your dealership name and address
          </CardDescription>
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
    </div>
  );
}

