"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export function Footer() {
  const { user } = useAuth();
  const pathname = usePathname();

  // Hide footer when user is logged in and not on home page
  const shouldHide = user?.email && pathname !== "/";

  return (
    <footer
      className={cn(
        "border-t border-zinc-200 py-6 text-sm dark:border-zinc-800",
        shouldHide && "hidden",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4">
        <span>© {new Date().getFullYear()} Hrafn AI</span>
        <div className="flex items-center gap-4">
          <a href="/docs" className="hover:underline">
            Docs
          </a>
          <a
            href="https://www.hrafn.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Website
          </a>
          <a
            href="https://github.com/HRAFNAI/dealer_webapp"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
