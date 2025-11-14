"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useApp } from "@/contexts/app-context";

export default function OffersPage() {
  const router = useRouter();
  const params = useParams();
  const appId = params.appId as string;
  const { selectedApp, setSelectedApp } = useApp();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadApp = async () => {
      if (selectedApp && selectedApp.id === appId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/apps");
        if (response.ok) {
          const data = await response.json();
          const app = data.apps?.find((a: any) => a.id === appId);
          if (app) {
            setSelectedApp(app);
            setLoading(false);
          } else {
            router.push("/apps");
          }
        } else {
          router.push("/apps");
        }
      } catch {
        router.push("/apps");
      }
    };

    loadApp();
  }, [appId, selectedApp, setSelectedApp, router]);

  if (loading || !selectedApp || selectedApp.id !== appId) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Offers</h2>
        <p className="text-sm text-muted-foreground">
          Manage offers and campaigns for {selectedApp.name}
        </p>
      </div>
      <div className="rounded-lg border border-white/10 p-4 text-sm text-muted-foreground">
        Offers and campaigns coming soon.
      </div>
    </div>
  );
}

