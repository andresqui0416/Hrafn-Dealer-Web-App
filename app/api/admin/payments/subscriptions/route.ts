import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const historyRows = await (prisma as any).paymentHistory.findMany({
      orderBy: { issueDate: "desc" },
      take: 200,
      select: {
        id: true,
        userId: true,
        plan: true,
        interval: true,
        amount: true,
        currency: true,
        issueDate: true,
        paymentMethod: true,
        stripeInvoiceUrl: true,
        user: {
          select: {
            email: true,
            name: true,
            subscriptionExpiresAt: true,
            dealerRoles: {
              select: {
                dealer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const history = (historyRows as any[]).map((row) => {
      const amountNumber =
        row.amount != null ? Number(typeof row.amount === "string" ? parseFloat(row.amount) : row.amount) : 0;

      const interval = row.interval ?? "month";
      const plan =
        row.plan ??
        (interval === "year" ? "Annual" : interval === "month" ? "Monthly" : "Subscription");

      const dealer = row.user?.dealerRoles?.[0]?.dealer ?? null;

      return {
        id: row.id,
        userId: row.userId,
        dealerId: dealer?.id ?? null,
        dealerName: dealer?.name ?? null,
        userEmail: row.user?.email ?? "",
        userName: row.user?.name ?? "",
        plan,
        interval,
        amount: amountNumber,
        currency: row.currency ?? "USD",
        issueDate: row.issueDate,
        paymentMethod: row.paymentMethod ?? "",
        subscriptionExpiresAt: row.user?.subscriptionExpiresAt ?? null,
        stripeInvoiceUrl: row.stripeInvoiceUrl ?? null,
      };
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Admin payments subscriptions error:", error);
    return NextResponse.json({ error: "Failed to load subscriptions table" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

