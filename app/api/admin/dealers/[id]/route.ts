import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { name, address } = body;

    if (!name || !address) {
      return NextResponse.json({ error: "Name and address are required" }, { status: 400 });
    }

    const dealer = await prisma.dealer.update({
      where: { id: params.id },
      data: {
        name,
        address,
      },
    });

    return NextResponse.json({ dealer });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Dealer name already exists" }, { status: 400 });
    }
    console.error("Error updating dealer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.dealer.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
    }
    console.error("Error deleting dealer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
