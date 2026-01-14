"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faSignOut,
  faBars,
  faX,
  faServer,
  faInbox,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  const pageTitle = useMemo(() => {
    switch (pathname) {
      case "/admin/dealers":
        return "Dealer Management";
      case "/admin/services":
        return "Service Management";
      case "/admin/inbox":
        return "Inbox";
      default:
        return null;
    }
  }, [pathname]);

  useEffect(() => {
    if (!loading && !admin && !isLoginPage) {
      router.push("/admin/login");
    }
  }, [admin, loading, pathname, router, isLoginPage]);

  const handleLogout = async () => {
    await logout();
  };

  const navItems = [
    { href: "/admin/dealers", label: "Dealer Management", icon: faBuilding },
    { href: "/admin/services", label: "Service Management", icon: faServer },
    { href: "/admin/inbox", label: "Inbox", icon: faInbox },
  ];

  // If on login page, render children directly without layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  // For other admin pages, require authentication
  if (loading || !admin) {
    return null; // Will redirect to login or show loading
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-white/10 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-white/10 h-14">
            <h2 className="text-lg font-semibold">Admin Panel</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden cursor-pointer hover:bg-white/10 transition-colors duration-200"
            >
              <FontAwesomeIcon icon={faX} className="h-4 w-4" />
            </Button>
          </div>
          <nav className="flex-1 p-4 space-y-2">
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
          <div className="p-4 border-t border-white/10">
            <div className="mb-3 px-3 py-2 text-sm">
              <p className="font-medium">{admin.name}</p>
              <p className="text-xs text-muted-foreground">{admin.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Role: {admin.role}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start cursor-pointer hover:bg-white/10 transition-colors duration-200"
              onClick={handleLogout}
            >
              <FontAwesomeIcon icon={faSignOut} className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-64">
        <header className="sticky h-14 top-0 z-30 border-b border-white/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between lg:px-6 px-2 h-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden cursor-pointer hover:bg-white/10 transition-colors duration-200"
            >
              <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">{pageTitle}</h1>
            <div className="flex-1" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
