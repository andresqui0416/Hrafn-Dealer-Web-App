"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCar,
  faGear,
  faComments,
  faChartLine,
  faChartGantt,
  faBars,
  faX,
  faInbox,
  faDollarSign,
  faCreditCard,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme-context";
import Image from "next/image";

export default function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useTheme();

  const navItems = [
    { href: "/overview", label: "Overview", icon: faChartLine },
    { href: "/inventory", label: "Inventory", icon: faCar },
    { href: "/offers", label: "Offers", icon: faChartGantt },
    { href: "/sales", label: "Sales", icon: faDollarSign },
    { href: "/payments", label: "Payments", icon: faCreditCard },
    { href: "/chat", label: "AI Agent", icon: faComments },
    { href: "/inbox", label: "Inbox", icon: faInbox },
    { href: "/settings", label: "Settings", icon: faGear },
  ];

  const isChatPage = pathname === "/chat";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed h-full lg:h-[calc(100vh-65px)] top-0 lg:top-[65px] left-0 bottom-0 z-50 w-64 bg-background border-r border-white/10 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/10 h-[65px]">
          <Link href="/" onClick={() => setSidebarOpen(false)}>
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Hrafn AI" width={32} height={32} />
              <span className="text-lg font-semibold text-foreground">Hrafn AI</span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden cursor-pointer hover:bg-white/10 transition-colors duration-200"
          >
            <FontAwesomeIcon icon={faX} className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-200",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-white/10 hover:text-foreground",
              )}
            >
              <FontAwesomeIcon icon={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col lg:ml-64">
        <main
          id={isChatPage ? "console-main-scroll" : undefined}
          className={cn(
            "flex min-h-0 flex-1 flex-col p-6",
            isChatPage
              ? "overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth"
              : "overflow-y-auto",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full max-w-6xl",
              isChatPage && "flex min-h-full min-w-0 flex-1 flex-col",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
