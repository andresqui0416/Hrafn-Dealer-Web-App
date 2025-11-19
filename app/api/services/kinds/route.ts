import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET all service kinds
export async function GET(request: NextRequest) {
  try {
    const serviceKinds = await prisma.serviceKind.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ serviceKinds });
  } catch (error) {
    console.error("Get service kinds error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

