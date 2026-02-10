import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserDealer } from "@/lib/auth/getUserDealer";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id")!;
    const dealerId = await getUserDealer(userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    const [makeRows, yearRows] = await Promise.all([
      prisma.inventoryListing.findMany({
        where: { dealerId },
        select: { make: true },
        distinct: ["make"],
      }),
      prisma.inventoryListing.findMany({
        where: { dealerId },
        select: { year: true },
        distinct: ["year"],
      }),
    ]);

    const makes = makeRows
      .map((row) => row.make)
      .filter((make): make is string => Boolean(make))
      .sort((a, b) => a.localeCompare(b));

    const years = yearRows
      .map((row) => row.year)
      .filter((year): year is number => typeof year === "number")
      .sort((a, b) => b - a);

    return NextResponse.json({ makes, years });
  } catch (error) {
    console.error("Error fetching inventory filters:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
