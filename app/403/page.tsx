import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Access Denied (403)",
};

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <Image src="/logo.png" alt="Hrafn AI" width={48} height={48} style={{ height: "auto" }} />
      <h1 className="text-3xl font-semibold tracking-tight">Access denied</h1>
      <p className="max-w-prose text-zinc-600 dark:text-zinc-400">
        You don’t have permission to view this page. If you believe this is an error, please contact
        your administrator.
      </p>
      <div className="flex items-center gap-3">
        <Button asChild>
          <Link href="/">Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in with a different account</Link>
        </Button>
      </div>
    </main>
  );
}
