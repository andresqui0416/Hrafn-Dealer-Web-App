import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserDealer } from "@/lib/auth/getUserDealer";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET dealer services
export async function GET(request: NextRequest) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = request.headers.get("x-user-id")!;

    // Get user's dealer
    const dealerId = await getUserDealer(userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    const dealerServices = await prisma.dealerService.findMany({
      where: { dealerId },
      include: {
        serviceKind: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ dealerServices });
  } catch (error) {
    console.error("Get dealer services error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST create new service request
export async function POST(request: NextRequest) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = request.headers.get("x-user-id")!;

    // Get user's dealer
    const dealerId = await getUserDealer(userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    const body = await request.json();
    const { serviceKindId, orgName } = body;

    if (!serviceKindId || !orgName) {
      return NextResponse.json(
        { error: "Service kind ID and organization name are required" },
        { status: 400 },
      );
    }

    // Check if service kind exists
    const serviceKind = await prisma.serviceKind.findUnique({
      where: { id: serviceKindId },
    });

    if (!serviceKind) {
      return NextResponse.json({ error: "Service kind not found" }, { status: 404 });
    }

    // Check if dealer already has a request for this service
    const existingService = await prisma.dealerService.findUnique({
      where: {
        dealerId_serviceKindId: {
          dealerId,
          serviceKindId,
        },
      },
    });

    if (existingService) {
      return NextResponse.json(
        { error: "A service request already exists for this service type" },
        { status: 400 },
      );
    }

    // Create new service request
    const dealerService = await prisma.dealerService.create({
      data: {
        dealerId,
        serviceKindId,
        orgName,
        status: "pending",
      },
      include: {
        serviceKind: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    return NextResponse.json({ dealerService }, { status: 201 });
  } catch (error) {
    console.error("Create dealer service error:", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "A service request already exists for this service type" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
