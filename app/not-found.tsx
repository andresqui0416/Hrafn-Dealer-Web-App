import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <Image src="/logo.png" alt="Hrafn AI" width={48} height={48} />
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-prose text-zinc-600 dark:text-zinc-400">
        The page you are looking for doesn’t exist or may have been moved.
      </p>
      <div className="flex items-center gap-3">
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/docs">View docs</Link>
        </Button>
      </div>
    </main>
  );
}
