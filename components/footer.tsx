"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe, faPhone, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { faLinkedin } from "@fortawesome/free-brands-svg-icons";

export function Footer() {
  const { user } = useAuth();
  const pathname = usePathname();

  // Hide footer when user is logged in and not on home page
  const shouldHide = user?.email && pathname !== "/";

  return (
    <footer
      className={cn(
        "shrink-0 border-t border-zinc-200 py-6 text-sm dark:border-zinc-800",
        shouldHide && "hidden",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4">
        {/* Top row: three columns */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Column 1: Contact info */}
          <div className="flex-1">
            <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">Contact</h3>
            <div className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-300">
              <a href="tel:+12012838442" className="inline-flex items-center gap-2 hover:underline">
                <FontAwesomeIcon icon={faPhone} className="fa-sm" />
                <span>+1 (201) 283-8442</span>
              </a>
              <a
                href="mailto:support@hrafn.ai"
                className="inline-flex items-center gap-2 hover:underline"
              >
                <FontAwesomeIcon icon={faEnvelope} className="fa-sm" />
                <span>support@hrafn.ai</span>
              </a>
            </div>
          </div>

          {/* Column 2: Product / pages */}
          <div className="flex-1">
            <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">Product</h3>
            <div className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-300">
              <Link href="/overview" className="hover:underline">
                Overview
              </Link>
              <Link href="/docs" className="hover:underline">
                Documentation
              </Link>
              <Link href="/#pricing" className="hover:underline">
                Pricing
              </Link>
            </div>
          </div>

          {/* Column 3: Company / external links */}
          <div className="flex-1">
            <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">Company</h3>
            <div className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-300">
              <Link href="/about" className="hover:underline">
                About
              </Link>
              <Link href="/contact" className="hover:underline">
                Contact
              </Link>
              <Link href="/terms" className="hover:underline">
                Terms &amp; Privacy
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom row: year and quick external links */}
        <div className="flex flex-col gap-3 pt-4 text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-center sm:text-left">© {new Date().getFullYear()} Hrafn AI</span>
          <div className="flex items-center justify-center gap-4 sm:justify-end">
            <a
              href="https://www.hrafn.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:underline text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              <FontAwesomeIcon icon={faGlobe} className="fa-lg" />
            </a>
            <a
              href="https://www.linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:underline text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              <FontAwesomeIcon icon={faLinkedin} className="fa-lg" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
