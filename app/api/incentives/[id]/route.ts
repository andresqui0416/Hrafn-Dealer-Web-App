import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

/**
 * GET /api/incentives/[id]
 * Single incentive by id with version history (version history placeholder for now).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const incentive = await prisma.offers.findUnique({
      where: { id },
    });

    if (!incentive) {
      return NextResponse.json({ error: "Incentive not found" }, { status: 404 });
    }

    return NextResponse.json({
      incentive,
      versionHistory: [], // No versioning in schema yet
    });
  } catch (error) {
    console.error("Error fetching incentive:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
