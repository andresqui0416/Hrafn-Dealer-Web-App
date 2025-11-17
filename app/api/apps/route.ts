import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth/getUser";
import { getUserDealer } from "@/lib/auth/getUserDealer";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET all apps for the user's dealer
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

    const apps = await prisma.dealerApp.findMany({
      where: { dealerId },
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
      orderBy: { createdAt: "desc" },
    });

    // Map to include hasSecret flag (don't expose the actual secret)
    const appsWithSecretFlag = apps.map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      crmType: app.crmType,
      clientId: app.clientId,
      hasSecret: !!app.clientSecret,
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

    // Get user's dealer
    const dealerId = await getUserDealer(user.userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, crmType, clientId, clientSecret } = body;

    if (!name || !clientId || !crmType) {
      return NextResponse.json(
        { error: "Name, CRM Type, and Client ID are required" },
        { status: 400 },
      );
    }

    if (!["CDK", "Tekion"].includes(crmType)) {
      return NextResponse.json(
        { error: "CRM Type must be either CDK or Tekion" },
        { status: 400 },
      );
    }

    const app = await prisma.dealerApp.create({
      data: {
        dealerId,
        name,
        description: description || null,
        crmType,
        clientId,
        clientSecret: clientSecret || null,
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
      message: "App created successfully",
    });
  } catch (error) {
    console.error("Create app error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

