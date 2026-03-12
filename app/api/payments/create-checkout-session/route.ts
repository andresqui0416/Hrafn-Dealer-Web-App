import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  // Warn during build / dev if Stripe key is missing
  console.warn("STRIPE_SECRET_KEY is not set. Stripe payments will not work.");
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function POST(request: NextRequest) {
  try {
    if (!stripe || !stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please set STRIPE_SECRET_KEY." },
        { status: 500 },
      );
    }

    // Authenticated user (set by auth middleware)
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // no body provided is fine
    }

    const { plan = "monthly" } = body as { plan?: "monthly" | "annual" };

    const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY;
    const annualPriceId = process.env.STRIPE_PRICE_ANNUAL;

    const priceId = plan === "annual" ? annualPriceId : monthlyPriceId;

    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price not configured for this plan." },
        { status: 500 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: userId,
      metadata: {
        userId,
        plan,
      },
      subscription_data: {
        metadata: {
          userId,
          plan,
        },
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/payments?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payments?subscription=cancelled`,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Stripe checkout session error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}

