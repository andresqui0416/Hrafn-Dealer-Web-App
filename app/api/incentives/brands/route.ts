import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await prisma.offers.findMany({
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    });
    const brands = result.map((r) => r.brand).filter(Boolean);
    return NextResponse.json({ brands });
  } catch (error) {
    console.error("Error fetching brands:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
