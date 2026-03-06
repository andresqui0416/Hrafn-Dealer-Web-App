import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not set. Stripe payments confirmation will not work.");
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    if (!stripe || !stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please set STRIPE_SECRET_KEY." },
        { status: 500 },
      );
    }

    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId } = body as { sessionId?: string };

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.client_reference_id !== userId) {
      return NextResponse.json({ error: "Session does not belong to this user" }, { status: 403 });
    }

    if (session.mode !== "subscription" || !session.subscription) {
      return NextResponse.json(
        { error: "Session is not a subscription checkout" },
        { status: 400 },
      );
    }

    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription.id;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Compute expiry based on start date and plan interval.
    const startTimestamp =
      ((subscription as any).current_period_start as number | undefined) ??
      subscription.start_date;

    if (!startTimestamp) {
      return NextResponse.json(
        { error: "Subscription does not have a valid start date" },
        { status: 400 },
      );
    }

    const planData = ((subscription as any).plan as any) ?? null;
    const interval = planData?.interval as
      | "day"
      | "week"
      | "month"
      | "year"
      | undefined;
    const intervalCount = (planData?.interval_count as number | undefined) ?? 1;

    // Determine base date:
    // - If user already has a future expiry and the new subscription start is before that,
    //   extend from the current expiry.
    // - Otherwise, start from this subscription's start date.
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionExpiresAt: true },
    });

    const startDate = new Date(startTimestamp * 1000);
    let baseDate = startDate;

    if (existingUser?.subscriptionExpiresAt) {
      const currentExpiry = new Date(existingUser.subscriptionExpiresAt);
      if (startDate < currentExpiry) {
        baseDate = currentExpiry;
      }
    }

    let expiresAt = new Date(baseDate);

    if (interval === "day") {
      expiresAt = new Date(expiresAt.getTime() + intervalCount * 24 * 60 * 60 * 1000);
    } else if (interval === "week") {
      expiresAt = new Date(expiresAt.getTime() + intervalCount * 7 * 24 * 60 * 60 * 1000);
    } else if (interval === "month") {
      expiresAt.setMonth(expiresAt.getMonth() + intervalCount);
    } else if (interval === "year") {
      expiresAt.setFullYear(expiresAt.getFullYear() + intervalCount);
    } else {
      // Fallback: one month from base date
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // If the existing expiry is already at or after the new expiry,
    // treat this call as idempotent and skip the DB update (avoids double-update issues).
    if (existingUser?.subscriptionExpiresAt) {
      const currentExpiry = new Date(existingUser.subscriptionExpiresAt);
      if (currentExpiry.getTime() >= expiresAt.getTime()) {
        return NextResponse.json({
          success: true,
          user: {
            id: userId,
            email: undefined,
            name: undefined,
            subscriptionExpiresAt: existingUser.subscriptionExpiresAt,
          },
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionExpiresAt: expiresAt,
      },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionExpiresAt: true,
      },
    });

    // Record payment history (including invoice PDF URL when available)
    const amountCents = (planData?.amount as number | undefined) ?? undefined;
    const amount = amountCents != null ? amountCents / 100 : null;

    let invoiceId: string | null = null;
    let invoiceUrl: string | null = null;
    let issueDate: Date | null = null;
    let paymentMethod: string | null = null;

    const latestInvoice = (subscription as any).latest_invoice as
      | string
      | { id: string }
      | null
      | undefined;
    if (latestInvoice) {
      try {
        const latestInvoiceId =
          typeof latestInvoice === "string" ? latestInvoice : (latestInvoice as any).id;
        if (latestInvoiceId) {
          const invoice = await stripe.invoices.retrieve(latestInvoiceId as string);
          invoiceId = invoice.id;
          invoiceUrl = (invoice.invoice_pdf as string | null) ?? (invoice.hosted_invoice_url as string | null) ?? null;

          // Use the invoice creation time as the issue date
          if (invoice.created) {
            issueDate = new Date((invoice.created as number) * 1000);
          }

          // Try to resolve a human-friendly payment method description from the charge
          const invoiceAny = invoice as any;
          const chargeRef = invoiceAny.charge as string | { id: string } | null | undefined;
          const paymentIntentRef = invoiceAny.payment_intent as
            | string
            | { id: string }
            | null
            | undefined;
          const resolveFromCharge = async (chargeId: string) => {
            const charge = await stripe.charges.retrieve(chargeId as string);
            const pmDetails = (charge.payment_method_details as any) ?? {};

            if (pmDetails.card) {
              const card = pmDetails.card as any;
              const brand = card.brand ? String(card.brand).toUpperCase() : "CARD";
              const last4 = card.last4 ? String(card.last4) : "••••";
              return `${brand} •••• ${last4}`;
            }

            if (pmDetails.us_bank_account) {
              const bank = pmDetails.us_bank_account as any;
              const bankName = bank.bank_name ? String(bank.bank_name) : "US Bank";
              const last4 = bank.last4 ? String(bank.last4) : "••••";
              return `${bankName} •••• ${last4}`;
            }

            if (charge.payment_method) {
              return String(charge.payment_method);
            }

            return null;
          };

          try {
            if (chargeRef) {
              const chargeId = typeof chargeRef === "string" ? chargeRef : (chargeRef as any).id;
              if (chargeId) {
                const pm = await resolveFromCharge(chargeId as string);
                if (pm) {
                  paymentMethod = pm;
                }
              }
            } else if (paymentIntentRef) {
              const piId =
                typeof paymentIntentRef === "string"
                  ? paymentIntentRef
                  : (paymentIntentRef as any).id;
              if (piId) {
                const paymentIntent = (await stripe.paymentIntents.retrieve(
                  piId as string,
                  { expand: ["charges.data.payment_method_details"] },
                )) as any;
                const charges = (paymentIntent.charges?.data as any[]) ?? [];
                if (charges.length > 0) {
                  const pm = await resolveFromCharge(charges[0].id as string);
                  if (pm) {
                    paymentMethod = pm;
                  }
                }
              }
            }

            // Fallback: derive from Checkout Session payment_method_types if still unknown
            if (!paymentMethod) {
              const methodTypes = (session.payment_method_types as string[] | null) ?? [];
              if (methodTypes.includes("card")) {
                paymentMethod = "Card";
              } else if (methodTypes.length > 0) {
                paymentMethod = methodTypes[0];
              } else {
                paymentMethod = "Stripe Checkout";
              }
            }
          } catch (err) {
            console.error("Failed to resolve Stripe payment method details:", err);
          }
        }
      } catch (err) {
        console.error("Failed to retrieve Stripe invoice:", err);
      }
    }

    // NOTE: After running `npx prisma migrate dev`, the PaymentHistory model
    // will be available on the Prisma client.
    const resolvedPlan =
      ((subscription.metadata as any)?.plan as string | undefined) ??
      (interval === "year" ? "Annual" : "Monthly");
    const resolvedInterval = (planData?.interval as string | undefined) ?? "month";
    const resolvedAmount = amount != null ? amount : 0;
    const resolvedCurrency = subscription.currency ?? "USD";
    const resolvedIssueDate = issueDate ?? new Date();
    const resolvedPaymentMethod = paymentMethod ?? "";
    await (prisma as any).paymentHistory.create({
      data: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: String(subscription.customer),
        stripePriceId: planData?.id ?? null,
        stripeInvoiceId: invoiceId,
        stripeInvoiceUrl: invoiceUrl,
        plan: resolvedPlan,
        interval: resolvedInterval,
        amount: resolvedAmount,
        currency: resolvedCurrency,
        issueDate: resolvedIssueDate,
        paymentMethod: resolvedPaymentMethod,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Stripe confirm payment error:", error);
    return NextResponse.json({ error: "Failed to confirm subscription" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

