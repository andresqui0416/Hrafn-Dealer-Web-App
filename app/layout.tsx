import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/auth-context";
import { AppProvider } from "@/contexts/app-context";
import { ThemeProvider } from "@/contexts/theme-context";
import "./globals.css";
import { FontAwesomeConfig } from "@/components/fontawesome-config";
import { ConditionalLayout } from "@/components/conditional-layout";
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
  description:
    "Hrafn AI Dealer Intelligence Platform - AI-native dealer intelligence platform for the automotive industry with Next.js and shadcn/ui",
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
        <FontAwesomeConfig />
        <AuthProvider>
          <AppProvider>
            <ThemeProvider>
              <div className="min-h-screen bg-background font-sans text-foreground">
                <ConditionalLayout>{children}</ConditionalLayout>
              </div>
            </ThemeProvider>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
