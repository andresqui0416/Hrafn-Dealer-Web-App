"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

/** Routes that use normal document flow (no locked viewport height). Dashboard stays full-height in the shell below. */
function isPublicDocumentFlowPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/" || pathname === "/login" || pathname === "/signup" || pathname === "/403";
}

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const isPublicDocument = isPublicDocumentFlowPath(pathname);

  // Don't show Header/Footer for admin routes (they have their own layout)
  if (isAdminRoute) {
    return <>{children}</>;
  }

  if (isPublicDocument) {
    return (
      <div className="flex min-h-0 flex-col bg-background font-sans text-foreground">
        <Header />
        <div className="mx-auto flex w-full flex-col">{children}</div>
        <Footer />
      </div>
    );
  }

  // Dashboard / app: fill viewport; overflow-hidden keeps scroll inside page content (e.g. chat)
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background font-sans text-foreground">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <main className="mx-auto flex w-full min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
