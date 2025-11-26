import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET all dealer services
export async function GET(request: NextRequest) {
  try {

    const dealerServices = await prisma.dealerService.findMany({
      include: {
        dealer: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        serviceKind: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ dealerServices });
  } catch (error) {
    console.error("Get dealer services error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

