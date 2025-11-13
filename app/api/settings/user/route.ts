import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth/getUser";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: userData });
  } catch (error) {
    console.error("Get user settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, currentPassword, newPassword } = body;

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: { email?: string; passwordHash?: string } = {};

    // Update email if provided
    if (email && email !== currentUser.email) {
      // Check if email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUser && existingUser.id !== user.userId) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
      updateData.email = email;
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 });
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, currentUser.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
      }

      // Hash new password
      updateData.passwordHash = await hashPassword(newPassword);
    }

    // If no updates, return success
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "No changes provided" }, { status: 200 });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
      },
    });

    return NextResponse.json({ user: updatedUser, message: "Settings updated successfully" });
  } catch (error) {
    console.error("Update user settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

