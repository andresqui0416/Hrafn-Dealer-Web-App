import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const now = new Date();

    const [historyRows, activeUsersCount] = await Promise.all([
      (prisma as any).paymentHistory.findMany({
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
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          subscriptionExpiresAt: {
            gt: now,
          },
        },
      }),
    ]);

    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    let monthlyRevenue = 0;
    const normalizedHistory = (historyRows as any[]).map((row) => {
      const amountNumber =
        row.amount != null ? Number(typeof row.amount === "string" ? parseFloat(row.amount) : row.amount) : 0;
      const issue = row.issueDate ? new Date(row.issueDate) : null;
      if (!Number.isNaN(amountNumber) && issue && issue >= monthAgo && issue <= now) {
        monthlyRevenue += amountNumber;
      }

      const interval = row.interval ?? "month";
      const plan =
        row.plan ??
        (interval === "year" ? "Annual" : interval === "month" ? "Monthly" : "Subscription");

      return {
        id: row.id,
        userId: row.userId,
        plan,
        interval,
        amount: amountNumber,
        currency: row.currency ?? "USD",
        issueDate: row.issueDate,
      };
    });

    // Weekly statistics (last 8 weeks)
    type WeeklyBucket = {
      weekStart: Date;
      totalRevenue: number;
      newSubscribers: number;
    };

    const userFirstPayment = new Map<string, Date>();
    for (const row of normalizedHistory) {
      const d = new Date(row.issueDate);
      if (Number.isNaN(d.getTime())) continue;
      const existing = userFirstPayment.get(row.userId);
      if (!existing || d < existing) {
        userFirstPayment.set(row.userId, d);
      }
    }

    const weekKey = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay(); // 0-6, Sunday = 0
      const diff = (day + 6) % 7; // make Monday week start
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - diff);
      return date;
    };

    const nowWeekStart = weekKey(now);
    const buckets = new Map<string, WeeklyBucket>();

    // Pre-create last 8 weeks buckets so chart is always filled
    for (let i = 7; i >= 0; i--) {
      const d = new Date(nowWeekStart);
      d.setDate(d.getDate() - i * 7);
      const key = d.toISOString();
      buckets.set(key, { weekStart: d, totalRevenue: 0, newSubscribers: 0 });
    }

    for (const row of normalizedHistory) {
      const d = new Date(row.issueDate);
      if (Number.isNaN(d.getTime())) continue;
      const start = weekKey(d);
      const key = start.toISOString();
      if (!buckets.has(key)) {
        buckets.set(key, { weekStart: start, totalRevenue: 0, newSubscribers: 0 });
      }
      const bucket = buckets.get(key)!;
      bucket.totalRevenue += row.amount;

      const firstPayment = userFirstPayment.get(row.userId);
      if (firstPayment) {
        const firstStart = weekKey(firstPayment);
        if (firstStart.getTime() === start.getTime()) {
          bucket.newSubscribers += 1;
        }
      }
    }

    const weeklyStats = Array.from(buckets.values())
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((b) => ({
        weekStart: b.weekStart.toISOString(),
        totalRevenue: b.totalRevenue,
        newSubscribers: b.newSubscribers,
      }));

    const stats = {
      totalPayments: normalizedHistory.length,
      totalRevenue: monthlyRevenue,
      activeSubscribers: activeUsersCount,
    };

    return NextResponse.json({ stats, weeklyStats });
  } catch (error) {
    console.error("Admin payments stats error:", error);
    return NextResponse.json({ error: "Failed to load payments statistics" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

