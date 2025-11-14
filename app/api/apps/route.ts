import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth/getUser";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET all apps for the user
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || !user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apps = await prisma.userApp.findMany({
      where: { userId: user.userId },
      select: {
        id: true,
        name: true,
        description: true,
        fortellisClientId: true,
        fortellisClientSecret: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to include hasFortellisSecret flag (don't expose the actual secret)
    const appsWithSecretFlag = apps.map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      fortellisClientId: app.fortellisClientId,
      hasFortellisSecret: !!app.fortellisClientSecret,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }));

    return NextResponse.json({ apps: appsWithSecretFlag });
  } catch (error) {
    console.error("Get apps error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST create a new app
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user || !user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, fortellisClientId, fortellisClientSecret } = body;

    if (!name || !fortellisClientId) {
      return NextResponse.json(
        { error: "Name and Fortellis Client ID are required" },
        { status: 400 },
      );
    }

    const app = await prisma.userApp.create({
      data: {
        userId: user.userId,
        name,
        description: description || null,
        fortellisClientId,
        fortellisClientSecret: fortellisClientSecret || null,
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
      message: "App created successfully",
    });
  } catch (error) {
    console.error("Create app error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

