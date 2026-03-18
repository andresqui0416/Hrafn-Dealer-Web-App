import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId") || undefined;
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSizeRaw = Number(searchParams.get("pageSize") || DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw || DEFAULT_PAGE_SIZE));

    const where: any = {};
    if (requestId && requestId.trim()) {
      where.requestId = requestId.trim();
    }

    const [total, rows] = await Promise.all([
      prisma.fortellisApiLog.count({ where }),
      prisma.fortellisApiLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      total,
      page,
      pageSize,
      rows,
    });
  } catch (error: any) {
    console.error("Admin Fortellis logs API error:", error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load Fortellis logs.",
      },
      { status: 500 },
    );
  }
}

