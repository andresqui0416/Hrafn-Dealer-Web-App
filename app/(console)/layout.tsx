"use client";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCar,
  faGear,
  faComments,
  faChartLine,
  faChartGantt,
  faBars,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
export default function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const sidebarWidth = 260;
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
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
            <Link
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center rounded px-3 py-2 hover:bg-white/10",
                pathname === "/dashboard" && "bg-white/10",
              )}
              href="/dashboard"
            >
              <FontAwesomeIcon icon={faChartLine} />
              <span className="ml-2">Overview</span>
            </Link>
            <Link
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center rounded px-3 py-2 hover:bg-white/10",
                pathname === "/inventory" && "bg-white/10",
              )}
              href="/inventory"
            >
              <FontAwesomeIcon icon={faCar} />
              <span className="ml-2">Inventory</span>
            </Link>
            <Link
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center rounded px-3 py-2 hover:bg-white/10",
                pathname === "/offers" && "bg-white/10",
              )}
              href="/offers"
            >
              <FontAwesomeIcon icon={faChartGantt} />
              <span className="ml-2">Offers</span>
            </Link>
            <Link
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center rounded px-3 py-2 hover:bg-white/10",
                pathname === "/chat" && "bg-white/10",
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
                pathname === "/settings" && "bg-white/10",
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

      <div className="px-4 md:ml-[260px]">
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
              <h1 className="text-base font-semibold">Console</h1>
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-6xl py-6">{children}</main>
      </div>
    </div>
  );
}
