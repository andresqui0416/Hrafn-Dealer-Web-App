import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/getUser";
import {
  classifyIntent,
  generateSQLFromNaturalLanguage,
  formatDataResultsAsNaturalLanguage,
  generateGeneralResponse,
} from "@/lib/ai";
import { PrismaClient } from "@prisma/client";
import { performance } from "perf_hooks";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";



function validateSQL(sql: string): void {
  const trimmed = sql.trim().toUpperCase();

  // Only allow SELECT queries
  if (!trimmed.startsWith("SELECT")) {
    throw new Error("Only SELECT queries are allowed");
  }

  // Block dangerous keywords
  const dangerousKeywords = [
    "DROP",
    "DELETE",
    "INSERT",
    "UPDATE",
    "ALTER",
    "CREATE",
    "TRUNCATE",
    "EXEC",
    "EXECUTE",
  ];
  for (const keyword of dangerousKeywords) {
    if (trimmed.includes(keyword)) {
      throw new Error(`Query contains forbidden keyword: ${keyword}`);
    }
  }
}

async function executeSQL(sql: string): Promise<any[]> {
  try {
    // Validate SQL before execution
    validateSQL(sql);

    // Use Prisma's raw query execution
    const result = await prisma.$queryRawUnsafe(sql);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("SQL execution error:", error);
    throw new Error(
      `SQL execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const userStart = performance.now();
    const user = getUserFromRequest(req);
    const userTime = performance.now() - userStart;
    console.log(
      `[getUser] ${userTime.toFixed(2)}ms - userId: ${user?.userId}`,
    );

    if (!user || !user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, appId } = await req.json();
    const safeMessage = typeof message === "string" ? message.trim() : "";
    const safeAppId = typeof appId === "string" ? appId.trim() : undefined;

    if (!safeMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Classify intent
    const intentStart = performance.now();
    const intent = await classifyIntent(safeMessage);
    const intentTime = performance.now() - intentStart;
    console.log(`[classifyIntent] ${intentTime.toFixed(2)}ms - intent: ${intent}`);

    if (intent === "data_query") {
      try {
        // Generate SQL
        const sqlStart = performance.now();
        const sql = await generateSQLFromNaturalLanguage(safeMessage, user.userId, safeAppId);
        const sqlTime = performance.now() - sqlStart;
        console.log(`[generateSQL] ${sqlTime.toFixed(2)}ms - sql: ${sql}`);

        // Execute SQL
        const executeStart = performance.now();
        const results = await executeSQL(sql);
        const executeTime = performance.now() - executeStart;
        console.log(`[executeSQL] ${executeTime.toFixed(2)}ms - results: ${results.length} rows`);

        // Format results
        const formatStart = performance.now();
        const reply = await formatDataResultsAsNaturalLanguage(sql, results, safeMessage);
        const formatTime = performance.now() - formatStart;
        console.log(
          `[formatResults] ${formatTime.toFixed(2)}ms - reply length: ${reply.length} chars`,
        );

        return NextResponse.json({ reply });
      } catch (sqlError) {
        console.error("SQL query error:", sqlError);
        const errorMessage = sqlError instanceof Error ? sqlError.message : "Unknown error";
        const errorResponseStart = performance.now();
        const reply = await generateGeneralResponse(
          `I tried to find that information, but encountered an issue: ${errorMessage}. Could you rephrase your question? For example, you could ask "Show me all Toyota vehicles" or "How many cars are available?"`,
        );
        const errorResponseTime = performance.now() - errorResponseStart;
        console.log(
          `[errorResponse] ${errorResponseTime.toFixed(2)}ms - reply length: ${reply.length} chars`,
        );

        return NextResponse.json({ reply });
      }
    } else {
      // Handle general questions with AI
      // Get user context
      const userDataStart = performance.now();
      const userData = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { name: true },
      });
      const userDataTime = performance.now() - userDataStart;
      console.log(
        `[getUserData] ${userDataTime.toFixed(2)}ms - user: ${userData?.name || "not found"}`,
      );

      // Get inventory count (filter by appId if provided)
      const countStart = performance.now();
      let inventoryCountQuery = `SELECT COUNT(*)::int as count FROM inventory_listings WHERE "userId" = '${user.userId}'::uuid`;
      if (safeAppId) {
        inventoryCountQuery += ` AND "appId" = '${safeAppId}'::uuid`;
      }
      const inventoryCountResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        inventoryCountQuery,
      );
      const inventoryCount = inventoryCountResult[0] ? Number(inventoryCountResult[0].count) : 0;
      const countTime = performance.now() - countStart;
      console.log(`[getInventoryCount] ${countTime.toFixed(2)}ms - count: ${inventoryCount}`);

      // Generate general response
      const context = {
        userName: userData?.name || "your account",
        inventoryCount,
      };

      const generalResponseStart = performance.now();
      const reply = await generateGeneralResponse(safeMessage, context);
      const generalResponseTime = performance.now() - generalResponseStart;
      console.log(
        `[generateGeneralResponse] ${generalResponseTime.toFixed(2)}ms - reply length: ${reply.length} chars`,
      );

      return NextResponse.json({ reply });
    }
  } catch (error) {
    console.error("Chat agent error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        reply: `I apologize, but I encountered an issue while processing your request. Could you please try rephrasing your question? If the problem persists, feel free to ask me something else and I'll do my best to help!`,
      },
      { status: 200 }, // Return 200 so frontend can display the error message
    );
  } finally {
    await prisma.$disconnect();
  }
}
