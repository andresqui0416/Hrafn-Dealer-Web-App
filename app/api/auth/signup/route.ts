import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { signJWT } from "@/lib/auth/jwt";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      dealerName,
      contactName,
      contactEmail,
      contactPhone,
      dealerAddress,
      password,
    } = body;

    // Validation
    if (!dealerName || !contactName || !contactEmail || !password || !contactPhone || !dealerAddress) {
      return NextResponse.json(
        { error: "Dealer name, contact name, email, password, phone, and dealer address are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: contactEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Check if dealer name already exists
    const existingDealer = await prisma.dealer.findUnique({
      where: { name: dealerName },
    });

    if (existingDealer) {
      return NextResponse.json(
        { error: "A dealer with this name already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create dealer, user, and user-dealer role in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create dealer
      const dealer = await tx.dealer.create({
        data: {
          name: dealerName,
          address: dealerAddress,
        },
      });

      // Create user (contact person)
      const user = await tx.user.create({
        data: {
          email: contactEmail,
          name: contactName,
          passwordHash,
          phone: contactPhone,
        },
      });

      // Create user-dealer role relationship (admin role)
      await tx.userDealerRole.create({
        data: {
          userId: user.id,
          dealerId: dealer.id,
          role: "admin",
        },
      });

      return { dealer, user };
    });

    // Generate JWT token
    const token = await signJWT({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      dealer: {
        id: result.dealer.id,
        name: result.dealer.name,
      },
    });

    // Set authentication cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Signup error:", error);
    
    // Handle unique constraint violations
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint") || error.message.includes("unique")) {
        if (error.message.includes("email")) {
          return NextResponse.json(
            { error: "An account with this email already exists" },
            { status: 409 }
          );
        }
        if (error.message.includes("name") || error.message.includes("Dealer")) {
          return NextResponse.json(
            { error: "A dealer with this name already exists" },
            { status: 409 }
          );
        }
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

