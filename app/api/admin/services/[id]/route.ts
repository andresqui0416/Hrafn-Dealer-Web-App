import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type serviceData = {
  status: "pending" | "reviewing" | "rejected" | "allowed";
  subscriptionId?: string | null;
};

export const dynamic = "force-dynamic";

// PUT update service request status
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { status } = body;

    const validStatuses = ["pending", "reviewing", "rejected", "allowed"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be one of: pending, reviewing, rejected, allowed" },
        { status: 400 },
      );
    }

    // Verify the service request exists
    const dealerService = await prisma.dealerService.findUnique({
      where: { id: params.id },
    });

    if (!dealerService) {
      return NextResponse.json({ error: "Service request not found" }, { status: 404 });
    }
    // If the service request is allowed, create the departments
    let data: serviceData = {status: status as "pending" | "reviewing" | "rejected" | "allowed"};
    if (status === "allowed") {
      const departments = Array.from(
        new Set(body.departments.map((item: any) => JSON.stringify(item))),
      )
        .map((str: any) => JSON.parse(str as string))
        .map((department: any) => {
          return {
            id: department.id,
            dmsType: department.dmsType,
            dealerId: dealerService.dealerId,
            serviceId: params.id,
          };
        });
      await prisma.dealerDepartment.createMany({
        data: departments,
      });
      
      if (body.subscriptionId) {
        data.subscriptionId = body.subscriptionId;
      }
    } else {
      await prisma.dealerDepartment.deleteMany({
        where: {
          serviceId: params.id,
        },
      });
      data.subscriptionId = null;
    }
    // Update the service request status
    const updatedService = await prisma.dealerService.update({
      where: { id: params.id },
      data,
      include: {
        dealer: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        serviceKind: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    return NextResponse.json({ dealerService: updatedService });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Service request not found" }, { status: 404 });
    }
    console.error("Error updating service request status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
