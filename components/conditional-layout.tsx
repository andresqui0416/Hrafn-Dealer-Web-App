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
      <div className="min-h-[calc(100vh-65px)]">
        <main className="mx-auto w-full">{children}</main>
      </div>
      <Footer />
    </>
  );
}

