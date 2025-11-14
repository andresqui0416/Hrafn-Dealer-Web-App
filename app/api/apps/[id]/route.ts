import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth/getUser";

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

    const appId = params.id;

    const app = await prisma.userApp.findFirst({
      where: {
        id: appId,
        userId: user.userId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        fortellisClientId: true,
        fortellisClientSecret: true,
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
        fortellisClientId: app.fortellisClientId,
        hasFortellisSecret: !!app.fortellisClientSecret,
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

    const appId = params.id;
    const body = await request.json();
    const { name, description, fortellisClientId, fortellisClientSecret } = body;

    // Verify app belongs to user
    const existingApp = await prisma.userApp.findFirst({
      where: {
        id: appId,
        userId: user.userId,
      },
    });

    if (!existingApp) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Build update data
    const updateData: {
      name?: string;
      description?: string | null;
      fortellisClientId?: string;
      fortellisClientSecret?: string | null;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (fortellisClientId !== undefined) updateData.fortellisClientId = fortellisClientId;
    if (fortellisClientSecret !== undefined) {
      updateData.fortellisClientSecret = fortellisClientSecret || null;
    }

    const app = await prisma.userApp.update({
      where: { id: appId },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        fortellisClientId: true,
        fortellisClientSecret: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      app: {
        id: app.id,
        name: app.name,
        description: app.description,
        fortellisClientId: app.fortellisClientId,
        hasFortellisSecret: !!app.fortellisClientSecret,
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

    const appId = params.id;

    // Verify app belongs to user
    const app = await prisma.userApp.findFirst({
      where: {
        id: appId,
        userId: user.userId,
      },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    await prisma.userApp.delete({
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

