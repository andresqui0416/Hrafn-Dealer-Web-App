import { PrismaClient } from "@prisma/client";

/**
 * SQL lines like `prisma:query INSERT ...` come from the `debug` package when `DEBUG` contains a
 * `prisma*` namespace — not from PrismaClient `log`. Strip those so the shared client stays quiet.
 * (If you use `DEBUG=*`, switch to `DEBUG=*,-prisma:*` or unset `DEBUG` to silence Prisma only.)
 */
function stripPrismaDebugFromEnv(): void {
  const raw = process.env.DEBUG;
  if (raw == null || raw === "") return;
  if (raw.trim() === "*") return;

  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = parts.filter((p) => !p.startsWith("prisma"));
  if (kept.length === parts.length) return;
  if (kept.length === 0) delete process.env.DEBUG;
  else process.env.DEBUG = kept.join(",");
}

stripPrismaDebugFromEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
