"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  // Don't show Header/Footer for admin routes (they have their own layout)
  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      {/* flex-1 fills space below header; overflow-hidden keeps scroll inside page content (e.g. chat) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <main className="mx-auto flex w-full min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <Footer />
    </>
  );
}
