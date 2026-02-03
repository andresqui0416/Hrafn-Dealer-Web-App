import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  deleteFineTuningSamplesFromPinecone,
  fineTuningPineconeEnabled,
  upsertFineTuningSamplesToPinecone,
} from "@/lib/vector/fine-tuning-pinecone";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// Helper function to check if admin role is allowed (admin or super_admin)
function isAdminRoleAllowed(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

// GET all fine-tuning samples, optionally filtered by type
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "NLQ" or "FAQ"
    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
    const pageSizeRaw = Number(searchParams.get("pageSize") || "10") || 10;
    const pageSize = Math.min(50, Math.max(1, pageSizeRaw));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (type === "NLQ" || type === "FAQ") {
      where.type = type;
    }

    if (q.length > 0) {
      where.OR = [
        { question: { contains: q, mode: "insensitive" } },
        { answer: { contains: q, mode: "insensitive" } },
      ];
    }

    const [totalCount, samples] = await Promise.all([
      prisma.fineTuningSample.count({ where }),
      prisma.fineTuningSample.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      samples,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      },
    });
  } catch (error) {
    console.error("Get fine-tuning samples error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST create new fine-tuning sample
export async function POST(request: NextRequest) {
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

    // Pinecone must succeed BEFORE DB write
    if (!fineTuningPineconeEnabled()) {
      return NextResponse.json({ error: "Pinecone is not configured" }, { status: 500 });
    }

    const id = randomUUID();
    const createdAt = new Date();
    const normalized = {
      id,
      type: type as "NLQ" | "FAQ",
      question: String(question).trim(),
      answer: String(answer).trim(),
      createdAt,
    };

    let vectorSync: any;
    try {
      vectorSync = await upsertFineTuningSamplesToPinecone([normalized]);
    } catch (e) {
      console.error("Pinecone upsert failed for fine-tuning sample:", e);
      return NextResponse.json({ error: "Pinecone upsert failed" }, { status: 500 });
    }

    const sample = await prisma.fineTuningSample.create({
      data: {
        id: normalized.id,
        type: normalized.type,
        question: normalized.question,
        answer: normalized.answer,
        createdAt: normalized.createdAt,
      },
    });

    return NextResponse.json({ sample, vectorSync }, { status: 201 });
  } catch (error) {
    console.error("Create fine-tuning sample error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE bulk delete fine-tuning samples
export async function DELETE(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const idsRaw = (body as any)?.ids;
    const ids = Array.isArray(idsRaw) ? idsRaw.map((x) => String(x)).filter(Boolean) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    if (ids.length > 1000) {
      return NextResponse.json({ error: "Too many ids (max 1000 per request)" }, { status: 400 });
    }

    // Fetch types so we can delete from the correct Pinecone namespaces
    const existing = await prisma.fineTuningSample.findMany({
      where: { id: { in: ids } },
      select: { id: true, type: true },
    });

    if (existing.length === 0) {
      return NextResponse.json(
        { success: true, deleted: 0, found: 0, requested: ids.length },
        { status: 200 },
      );
    }

    // Pinecone must succeed BEFORE DB delete
    if (!fineTuningPineconeEnabled()) {
      return NextResponse.json({ error: "Pinecone is not configured" }, { status: 500 });
    }

    let vectorSync: any;
    try {
      vectorSync = await deleteFineTuningSamplesFromPinecone(
        existing.map((s) => ({ id: s.id, type: s.type as "NLQ" | "FAQ" })),
      );
    } catch (e) {
      console.error("Pinecone bulk delete failed for fine-tuning samples:", e);
      return NextResponse.json({ error: "Pinecone delete failed" }, { status: 500 });
    }

    const deleted = await prisma.fineTuningSample.deleteMany({
      where: { id: { in: existing.map((s) => s.id) } },
    });

    return NextResponse.json({
      success: true,
      requested: ids.length,
      found: existing.length,
      deleted: deleted.count,
      vectorSync,
    });
  } catch (error) {
    console.error("Bulk delete fine-tuning samples error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
