"use client";

import { useEffect } from "react";

/**
 * App-level error boundary. Catches errors during render or in the
 * React tree so Next.js does not try to read .digest from a null context
 * (which causes "Cannot read properties of null (reading 'digest')").
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error?.message ?? error, error?.digest);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground text-center text-sm">
        {error?.message ?? "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
