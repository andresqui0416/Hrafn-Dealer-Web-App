import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth/getUser";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || !user.dealerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dealer = await prisma.dealer.findUnique({
      where: { id: user.dealerId },
      select: {
        id: true,
        name: true,
        fortellisClientId: true,
        // Don't return the secret in GET, only indicate if it's set
        fortellisClientSecret: true,
      },
    });

    if (!dealer) {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
    }

    return NextResponse.json({
      crm: {
        dealerId: dealer.id,
        dealerName: dealer.name,
        fortellisClientId: dealer.fortellisClientId || null,
        hasFortellisSecret: !!dealer.fortellisClientSecret,
      },
    });
  } catch (error) {
    console.error("Get CRM settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || !user.dealerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fortellisClientId, fortellisClientSecret } = body;

    const updateData: { fortellisClientId?: string; fortellisClientSecret?: string } = {};

    if (fortellisClientId !== undefined) {
      updateData.fortellisClientId = fortellisClientId || null;
    }

    if (fortellisClientSecret !== undefined) {
      updateData.fortellisClientSecret = fortellisClientSecret || null;
    }

    // If no updates, return success
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "No changes provided" }, { status: 200 });
    }

    // Update dealer
    const updatedDealer = await prisma.dealer.update({
      where: { id: user.dealerId },
      data: updateData,
      select: {
        id: true,
        name: true,
        fortellisClientId: true,
        fortellisClientSecret: true,
      },
    });

    return NextResponse.json({
      crm: {
        dealerId: updatedDealer.id,
        dealerName: updatedDealer.name,
        fortellisClientId: updatedDealer.fortellisClientId || null,
        hasFortellisSecret: !!updatedDealer.fortellisClientSecret,
      },
      message: "CRM settings updated successfully",
    });
  } catch (error) {
    console.error("Update CRM settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

