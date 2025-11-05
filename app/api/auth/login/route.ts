import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { signJWT } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            dealer: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const userRole = user.roles[0];
    if (!userRole) {
      return NextResponse.json({ error: "User has no dealer role" }, { status: 403 });
    }

    const token = await signJWT({
      userId: user.id,
      dealerId: userRole.dealerId,
      email: user.email,
      role: userRole.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        dealerId: userRole.dealerId,
        role: userRole.role,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

