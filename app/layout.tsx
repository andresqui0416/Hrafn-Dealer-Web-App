import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/auth-context";
import { Footer } from "@/components/footer";
import "./globals.css";
import { Header } from "@/components/header";
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
        <AuthProvider>
          <div className="min-h-screen bg-background font-sans text-foreground">
            <Header />
            <div className="min-h-[calc(100vh-65px)]">
              <main className="mx-auto w-full">{children}</main>
            </div>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
