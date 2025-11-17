import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth/getUser";
import { getUserDealer } from "@/lib/auth/getUserDealer";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET dealer information
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || !user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's dealer
    const dealerId = await getUserDealer(user.userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      select: {
        id: true,
        name: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!dealer) {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
    }

    return NextResponse.json({ dealer });
  } catch (error) {
    console.error("Get dealer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PUT update dealer information
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || !user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's dealer
    const dealerId = await getUserDealer(user.userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    const body = await request.json();
    const { name, address } = body;

    // Validation
    if (!name || !address) {
      return NextResponse.json(
        { error: "Name and address are required" },
        { status: 400 }
      );
    }

    // Check if name is being changed and if the new name already exists
    const existingDealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
    });

    if (!existingDealer) {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
    }

    // If name is being changed, check if new name is available
    if (name !== existingDealer.name) {
      const nameExists = await prisma.dealer.findUnique({
        where: { name },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: "A dealer with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Update dealer
    const dealer = await prisma.dealer.update({
      where: { id: dealerId },
      data: {
        name,
        address,
      },
      select: {
        id: true,
        name: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      dealer,
      message: "Dealer information updated successfully",
    });
  } catch (error) {
    console.error("Update dealer error:", error);
    
    // Handle unique constraint violations
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint") || error.message.includes("unique")) {
        if (error.message.includes("name") || error.message.includes("Dealer")) {
          return NextResponse.json(
            { error: "A dealer with this name already exists" },
            { status: 409 }
          );
        }
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

