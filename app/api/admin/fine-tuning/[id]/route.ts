import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  deleteFineTuningSamplesFromPinecone,
  fineTuningPineconeEnabled,
  upsertFineTuningSamplesToPinecone,
} from "@/lib/vector/fine-tuning-pinecone";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// Helper function to check if admin role is allowed (admin or super_admin)
function isAdminRoleAllowed(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

// PUT update fine-tuning sample
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get admin info from middleware-set headers
    const adminRole = request.headers.get("x-admin-role")!;

    // Check if admin role is allowed
    if (!isAdminRoleAllowed(adminRole)) {
      return NextResponse.json(
        { error: "Forbidden: Admin or Super Admin role required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { type, question, answer } = body;

    if (!type || !question || !answer) {
      return NextResponse.json(
        { error: "Type, question, and answer are required" },
        { status: 400 },
      );
    }

    if (type !== "NLQ" && type !== "FAQ") {
      return NextResponse.json({ error: "Type must be either 'NLQ' or 'FAQ'" }, { status: 400 });
    }

    // Check if sample exists
    const existingSample = await prisma.fineTuningSample.findUnique({
      where: { id: params.id },
    });

    if (!existingSample) {
      return NextResponse.json({ error: "Fine-tuning sample not found" }, { status: 404 });
    }

    // Pinecone must succeed BEFORE DB update
    if (!fineTuningPineconeEnabled()) {
      return NextResponse.json({ error: "Pinecone is not configured" }, { status: 500 });
    }

    let vectorSync: any;
    try {
      vectorSync = await upsertFineTuningSamplesToPinecone([
        {
          id: existingSample.id,
          type: type as "NLQ" | "FAQ",
          question: String(question).trim(),
          answer: String(answer).trim(),
          createdAt: existingSample.createdAt,
        },
      ]);
    } catch (e) {
      console.error("Pinecone upsert failed for fine-tuning sample:", e);
      return NextResponse.json({ error: "Pinecone upsert failed" }, { status: 500 });
    }

    const sample = await prisma.fineTuningSample.update({
      where: { id: params.id },
      data: {
        type,
        question: question.trim(),
        answer: answer.trim(),
      },
    });

    return NextResponse.json({ sample, vectorSync });
  } catch (error) {
    console.error("Update fine-tuning sample error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE fine-tuning sample
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get admin info from middleware-set headers
    const adminRole = request.headers.get("x-admin-role")!;

    // Check if admin role is allowed
    if (!isAdminRoleAllowed(adminRole)) {
      return NextResponse.json(
        { error: "Forbidden: Admin or Super Admin role required" },
        { status: 403 },
      );
    }

    // Check if sample exists
    const existingSample = await prisma.fineTuningSample.findUnique({
      where: { id: params.id },
    });

    if (!existingSample) {
      return NextResponse.json({ error: "Fine-tuning sample not found" }, { status: 404 });
    }

    // Pinecone must succeed BEFORE DB delete
    if (!fineTuningPineconeEnabled()) {
      return NextResponse.json({ error: "Pinecone is not configured" }, { status: 500 });
    }

    let vectorSync: any;
    try {
      vectorSync = await deleteFineTuningSamplesFromPinecone([
        { id: params.id, type: existingSample.type as "NLQ" | "FAQ" },
      ]);
    } catch (e) {
      console.error("Pinecone delete failed for fine-tuning sample:", e);
      return NextResponse.json({ error: "Pinecone delete failed" }, { status: 500 });
    }

    await prisma.fineTuningSample.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, vectorSync });
  } catch (error) {
    console.error("Delete fine-tuning sample error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
