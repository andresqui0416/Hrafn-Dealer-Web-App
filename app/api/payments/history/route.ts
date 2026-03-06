import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // NOTE: After running `npx prisma migrate dev`, the PaymentHistory model
    // will be available on the Prisma client.
    const rawHistory = await (prisma as any).paymentHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        plan: true,
        interval: true,
        amount: true,
        currency: true,
        issueDate: true,
        paymentMethod: true,
        createdAt: true,
        stripeInvoiceUrl: true,
      },
    });

    const history = (rawHistory as any[]).map((item) => {
      const interval = item.interval ?? "month";
      const plan =
        item.plan ??
        (interval === "year" ? "Annual" : interval === "month" ? "Monthly" : "Subscription");

      return {
        ...item,
        plan,
        interval,
        amount: item.amount ?? 0,
        currency: item.currency ?? "USD",
        issueDate: item.issueDate ?? item.createdAt,
        paymentMethod: item.paymentMethod ?? "",
      };
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Get payment history error:", error);
    return NextResponse.json({ error: "Failed to load payment history" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

