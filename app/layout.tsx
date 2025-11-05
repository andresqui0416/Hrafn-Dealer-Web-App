import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hrafn AI Dealer Intelligence Platform",
  description: "Hrafn AI Dealer Intelligence Platform - AI-native dealer intelligence platform for the automotive industry with Next.js and shadcn/ui",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head> 
        <link rel="icon" href="/logo.png" />
      </head>
      <body className={`${inter.variable} ${robotoMono.variable} antialiased`}>

        <div className="min-h-screen bg-background font-sans text-foreground">
          {/* Header */}
          <header
            className="sticky top-0 z-10 border-b border-white/15 backdrop-blur"
            style={{ background: "color-mix(in oklab, var(--background) 50%, #ffffff21)" }}
          >
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <Link href="/">
                  <Image src="/logo.png" alt="Hrafn AI" width={32} height={32} />
                </Link>
                <span className="text-lg font-semibold text-foreground">Hrafn AI</span>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild>
                  <Link href="/login">
                    Login
                  </Link>
                </Button>
              </div>
            </div>
          </header>
          {children}
          {/* Footer */}
          <footer className="border-t border-zinc-200 py-6 text-sm dark:border-zinc-800">
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
        </div>
      </body>
    </html>
  );
}
