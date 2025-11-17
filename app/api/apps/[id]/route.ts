import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth/getUser";
import { getUserDealer } from "@/lib/auth/getUserDealer";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET a specific app
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const appId = params.id;

    const app = await prisma.dealerApp.findFirst({
      where: {
        id: appId,
        dealerId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        crmType: true,
        clientId: true,
        clientSecret: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    return NextResponse.json({
      app: {
        id: app.id,
        name: app.name,
        description: app.description,
        crmType: app.crmType,
        clientId: app.clientId,
        hasSecret: !!app.clientSecret,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get app error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PUT update an app
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const appId = params.id;
    const body = await request.json();
    const { name, description, crmType, clientId, clientSecret } = body;

    // Verify app belongs to dealer
    const existingApp = await prisma.dealerApp.findFirst({
      where: {
        id: appId,
        dealerId,
      },
    });

    if (!existingApp) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Build update data
    const updateData: {
      name?: string;
      description?: string | null;
      crmType?: "CDK" | "Tekion";
      clientId?: string;
      clientSecret?: string;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (crmType !== undefined) {
      if (!["CDK", "Tekion"].includes(crmType)) {
        return NextResponse.json(
          { error: "CRM Type must be either CDK or Tekion" },
          { status: 400 },
        );
      }
      updateData.crmType = crmType;
    }
    if (clientId !== undefined) updateData.clientId = clientId;
    // Only update clientSecret if a new value is provided (it's required, so we can't set it to null)
    if (clientSecret !== undefined && clientSecret !== null && clientSecret !== "") {
      updateData.clientSecret = clientSecret;
    }

    const app = await prisma.dealerApp.update({
      where: { id: appId },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        crmType: true,
        clientId: true,
        clientSecret: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      app: {
        id: app.id,
        name: app.name,
        description: app.description,
        crmType: app.crmType,
        clientId: app.clientId,
        hasSecret: !!app.clientSecret,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      },
      message: "App updated successfully",
    });
  } catch (error) {
    console.error("Update app error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE an app
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const appId = params.id;

    // Verify app belongs to dealer
    const app = await prisma.dealerApp.findFirst({
      where: {
        id: appId,
        dealerId,
      },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    await prisma.dealerApp.delete({
      where: { id: appId },
    });

    return NextResponse.json({ message: "App deleted successfully" });
  } catch (error) {
    console.error("Delete app error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

