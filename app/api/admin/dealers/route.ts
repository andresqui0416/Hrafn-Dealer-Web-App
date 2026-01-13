import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {

    const dealers = await prisma.dealer.findMany({
      include: {
        _count: {
          select: {
            inventory: true,
            userRoles: true,
          },
        },
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: [
            { role: "asc" }, // admin first, then manager, then viewer
            { createdAt: "asc" }, // oldest first if same role
          ],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ dealers });
  } catch (error) {
    console.error("Error fetching dealers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  try {

    const body = await request.json();
    const { name, address } = body;

    if (!name || !address) {
      return NextResponse.json(
        { error: "Name and address are required" },
        { status: 400 }
      );
    }

    const dealer = await prisma.dealer.create({
      data: {
        name,
        address,
      },
    });

    return NextResponse.json({ dealer });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Dealer name already exists" }, { status: 400 });
    }
    console.error("Error creating dealer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

