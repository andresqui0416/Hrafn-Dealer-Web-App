import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserDealer } from "@/lib/auth/getUserDealer";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// PUT update service request orgName
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = request.headers.get("x-user-id")!;

    // Get user's dealer
    const dealerId = await getUserDealer(userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    const body = await request.json();
    const { orgName } = body;

    if (!orgName || typeof orgName !== "string" || orgName.trim().length === 0) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    // Verify the service request belongs to the user's dealer
    const dealerService = await prisma.dealerService.findUnique({
      where: { id: params.id },
    });

    if (!dealerService) {
      return NextResponse.json({ error: "Service request not found" }, { status: 404 });
    }

    if (dealerService.dealerId !== dealerId) {
      return NextResponse.json(
        { error: "You can only update your own service requests" },
        { status: 403 },
      );
    }

    // Update the service request orgName
    const updatedService = await prisma.dealerService.update({
      where: { id: params.id },
      data: { orgName: orgName.trim() },
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

    return NextResponse.json({ dealerService: updatedService });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Service request not found" }, { status: 404 });
    }
    console.error("Error updating service request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE withdraw service request
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = request.headers.get("x-user-id")!;

    // Get user's dealer
    const dealerId = await getUserDealer(userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    // Verify the service request belongs to the user's dealer
    const dealerService = await prisma.dealerService.findUnique({
      where: { id: params.id },
    });

    if (!dealerService) {
      return NextResponse.json({ error: "Service request not found" }, { status: 404 });
    }

    if (dealerService.dealerId !== dealerId) {
      return NextResponse.json(
        { error: "You can only withdraw your own service requests" },
        { status: 403 },
      );
    }

    // Delete the service request
    await prisma.dealerService.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: "Service request withdrawn successfully" });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Service request not found" }, { status: 404 });
    }
    console.error("Error withdrawing service request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
