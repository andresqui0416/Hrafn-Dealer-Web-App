"use client";
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/app-context";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCar,
  faGear,
  faComments,
  faChartLine,
  faChartGantt,
  faBars,
  faXmark,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const sidebarWidth = 260;
  const pathname = usePathname();
  const params = useParams();
  const appId = params.appId as string;
  const [mobileOpen, setMobileOpen] = useState(false);
  const { selectedApp, setSelectedApp } = useApp();
  const [appLoading, setAppLoading] = useState(false);

  useEffect(() => {
    const loadApp = async () => {
      if (selectedApp && selectedApp.id === appId) {
        return;
      }

      try {
        setAppLoading(true);
        const response = await fetch("/api/apps");
        if (response.ok) {
          const data = await response.json();
          const app = data.apps?.find((a: any) => a.id === appId);
          if (app) {
            setSelectedApp(app);
          } else {
            router.push("/apps");
          }
        } else {
          throw new Error("Failed to load app");
        }
      } catch {
        // toast.error("Failed to load app");
        
      } finally {
        setAppLoading(false);
      }
    }
  },[])

  if (appLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur flex items-center justify-center">
        <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
        <p className="text-sm text-muted-foreground ml-2">Loading...</p>
      </div>
    );
  }
  return (
    <div className="relative">
      {/* Sidebar: drawer on mobile, fixed on md+ */}
      <aside
        className={cn(
          "fixed left-0 top-[65px] z-30 h-[calc(100vh-65px)] border-r border-white/10 bg-background/90 backdrop-blur transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        style={{ width: sidebarWidth }}
      >
        <div className="h-full overflow-y-auto p-4">
          <nav className="space-y-1 text-sm">
            {selectedApp && (
              <>
                <Link
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center rounded px-3 py-2 hover:bg-white/10",
                    pathname === `/apps/${appId}/overview` && "bg-white/10",
                  )}
                  href={`/apps/${appId}/overview`}
                >
                  <FontAwesomeIcon icon={faChartLine} />
                  <span className="ml-2">Overview</span>
                </Link>
                <Link
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center rounded px-3 py-2 hover:bg-white/10",
                    pathname === `/apps/${appId}/inventory` && "bg-white/10",
                  )}
                  href={`/apps/${appId}/inventory`}
                >
                  <FontAwesomeIcon icon={faCar} />
                  <span className="ml-2">Inventory</span>
                </Link>
                <Link
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center rounded px-3 py-2 hover:bg-white/10",
                    pathname === `/apps/${appId}/offers` && "bg-white/10",
                  )}
                  href={`/apps/${appId}/offers`}
                >
                  <FontAwesomeIcon icon={faChartGantt} />
                  <span className="ml-2">Offers</span>
                </Link>
              </>
            )}
            <Link
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center rounded px-3 py-2 hover:bg-white/10",
                pathname.startsWith("/chat") && "bg-white/10",
              )}
              href="/chat"
            >
              <FontAwesomeIcon icon={faComments} />
              <span className="ml-2">AI Agent</span>
            </Link>
            <Link
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center rounded px-3 py-2 hover:bg-white/10",
                pathname.startsWith("/settings") && "bg-white/10",
              )}
              href="/settings"
            >
              <FontAwesomeIcon icon={faGear} />
              <span className="ml-2">Settings</span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      )}

      <div className={cn("px-4 md:ml-[260px]")}>
        <div className="sticky top-[65px] z-10 border-b border-white/10 bg-background/70 backdrop-blur">
          <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between px-2 md:px-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Open sidebar"
                className="inline-flex h-8 w-8 items-center justify-center rounded md:hidden hover:bg-white/10"
                onClick={() => setMobileOpen((v) => !v)}
              >
                <FontAwesomeIcon icon={mobileOpen ? faXmark : faBars} />
              </button>
              <h1 className="text-base font-semibold">{selectedApp?.name}</h1>
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-6xl py-6">{children}</main>
      </div>
    </div>
  );
}

