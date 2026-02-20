import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

/** GET: scrape events OR failure log for admin scraping status page (paginated). Fetches only the requested type. */
export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") || "events";
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") || "10")),
    );

    if (type === "events") {
      const [totalCount, events] = await Promise.all([
        prisma.scrapeEvent.count(),
        prisma.scrapeEvent.findMany({
          orderBy: { startedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            source: true,
            brand: true,
            startedAt: true,
            completedAt: true,
            status: true,
            recordsInserted: true,
            recordsReplaced: true,
            recordsFailed: true,
            errorMessage: true,
          },
        }),
      ]);
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      return NextResponse.json({
        events,
        pagination: { page, pageSize, totalCount, totalPages },
      });
    }

    if (type === "failures") {
      const [totalCount, failureLogs] = await Promise.all([
        prisma.scrapeFailureLog.count(),
        prisma.scrapeFailureLog.findMany({
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            scrapeEventId: true,
            brand: true,
            source: true,
            failureType: true,
            message: true,
            createdAt: true,
          },
        }),
      ]);
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      return NextResponse.json({
        failureLogs,
        pagination: { page, pageSize, totalCount, totalPages },
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching scraping status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
