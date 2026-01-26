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

// Parse CSV text into array of objects
function parseCSV(csvText: string): Array<{ type: string; question: string; answer: string }> {
  const lines = csvText.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }

  // Helper function to parse CSV line handling quoted values
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let currentValue = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentValue += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        // End of field
        result.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    // Add last field
    result.push(currentValue.trim());

    return result;
  }

  // Parse header
  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const typeIndex = header.findIndex((h) => h === "type" || h === "sample_type");
  const questionIndex = header.findIndex((h) => h === "question" || h === "query");
  const answerIndex = header.findIndex((h) => h === "answer" || h === "response");

  if (typeIndex === -1 || questionIndex === -1 || answerIndex === -1) {
    throw new Error(
      "CSV must contain columns: type, question, answer (case-insensitive)",
    );
  }

  // Parse data rows
  const data: Array<{ type: string; question: string; answer: string }> = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]).map((val) => val.replace(/^"|"$/g, "").trim());

    if (row.length > Math.max(typeIndex, questionIndex, answerIndex)) {
      const type = row[typeIndex];
      const question = row[questionIndex];
      const answer = row[answerIndex];

      if (type && question && answer) {
        data.push({ type, question, answer });
      }
    }
  }

  return data;
}

// Parse JSON text into array of objects
function parseJSON(jsonText: string): Array<{ type: string; question: string; answer: string }> {
  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON must be an array of objects");
    }

    return parsed.map((item) => {
      if (typeof item !== "object" || item === null) {
        throw new Error("Each item in JSON array must be an object");
      }

      const type = item.type || item.sample_type || item.Type;
      const question = item.question || item.query || item.Question;
      const answer = item.answer || item.response || item.Answer;

      if (!type || !question || !answer) {
        throw new Error(
          "Each object must have 'type', 'question', and 'answer' fields",
        );
      }

      return { type: String(type), question: String(question), answer: String(answer) };
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
    throw new Error("Invalid JSON format");
  }
}

// POST bulk import fine-tuning samples from CSV or JSON
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

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 },
      );
    }

    // Read file content
    const fileContent = await file.text();
    const fileName = file.name.toLowerCase();

    // Parse based on file extension
    let samples: Array<{ type: string; question: string; answer: string }>;

    if (fileName.endsWith(".csv")) {
      samples = parseCSV(fileContent);
    } else if (fileName.endsWith(".json")) {
      samples = parseJSON(fileContent);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a CSV or JSON file." },
        { status: 400 },
      );
    }

    if (samples.length === 0) {
      return NextResponse.json(
        { error: "No valid samples found in file" },
        { status: 400 },
      );
    }

    // Validate and normalize samples
    const validSamples: Array<{ type: "NLQ" | "FAQ"; question: string; answer: string }> = [];
    const errors: string[] = [];

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const rowNum = i + 1;

      // Validate type
      const normalizedType = sample.type.toUpperCase().trim();
      if (normalizedType !== "NLQ" && normalizedType !== "FAQ") {
        errors.push(`Row ${rowNum}: Invalid type "${sample.type}". Must be "NLQ" or "FAQ"`);
        continue;
      }

      // Validate question and answer
      const question = sample.question.trim();
      const answer = sample.answer.trim();

      if (!question) {
        errors.push(`Row ${rowNum}: Question is required`);
        continue;
      }

      if (!answer) {
        errors.push(`Row ${rowNum}: Answer is required`);
        continue;
      }

      validSamples.push({
        type: normalizedType as "NLQ" | "FAQ",
        question,
        answer,
      });
    }

    if (validSamples.length === 0) {
      return NextResponse.json(
        {
          error: "No valid samples to import",
          details: errors,
        },
        { status: 400 },
      );
    }

    // De-dupe within this import batch (helps avoid accidental duplicates)
    const uniqueMap = new Map<string, { type: "NLQ" | "FAQ"; question: string; answer: string }>();
    for (const s of validSamples) {
      const key = `${s.type}::${s.question}::${s.answer}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, s);
    }
    const uniqueSamples = Array.from(uniqueMap.values());

    // Pinecone must succeed BEFORE DB import
    if (!fineTuningPineconeEnabled()) {
      return NextResponse.json(
        { error: "Pinecone is not configured" },
        { status: 500 },
      );
    }

    const now = new Date();
    const toCreate = uniqueSamples.map((s) => ({
      id: randomUUID(),
      type: s.type,
      question: s.question,
      answer: s.answer,
      createdAt: now,
    }));

    let vectorSync: any;
    try {
      vectorSync = await upsertFineTuningSamplesToPinecone(toCreate);
    } catch (e) {
      console.error("Pinecone upsert failed for imported fine-tuning samples:", e);
      return NextResponse.json(
        { error: "Pinecone upsert failed" },
        { status: 500 },
      );
    }

    // Create rows one-by-one (ids already chosen to match Pinecone vector ids)
    const created: Array<{ id: string; type: "NLQ" | "FAQ"; question: string; answer: string; createdAt: Date }> = [];
    const chunkSize = 200;
    try {
      for (let i = 0; i < toCreate.length; i += chunkSize) {
        const chunk = toCreate.slice(i, i + chunkSize);
        const createdChunk = await prisma.$transaction(
          chunk.map((s) =>
            prisma.fineTuningSample.create({
              data: {
                id: s.id,
                type: s.type,
                question: s.question,
                answer: s.answer,
                createdAt: s.createdAt,
              },
              select: { id: true, type: true, question: true, answer: true, createdAt: true },
            }),
          ),
        );
        created.push(...(createdChunk as any));
      }
    } catch (e) {
      // Best-effort rollback in Pinecone if DB write fails after Pinecone upsert
      try {
        await deleteFineTuningSamplesFromPinecone(
          toCreate.map((s) => ({ id: s.id, type: s.type })),
        );
      } catch (rollbackErr) {
        console.error("Pinecone rollback failed after DB import error:", rollbackErr);
      }
      throw e;
    }

    return NextResponse.json({
      success: true,
      imported: created.length,
      total: uniqueSamples.length,
      errors: errors.length > 0 ? errors : undefined,
      vectorSync,
    });
  } catch (error) {
    console.error("Bulk import fine-tuning samples error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
