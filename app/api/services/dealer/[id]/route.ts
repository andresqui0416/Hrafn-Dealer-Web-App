import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserDealer } from "@/lib/auth/getUserDealer";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// DELETE withdraw service request
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get userId from middleware-set header
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        { status: 403 }
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

