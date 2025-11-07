import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/getUser";
import { generateSQLFromNaturalLanguage } from "@/lib/ai/sql-generator";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const dynamic = "force-dynamic";

async function classifyIntent(message: string): Promise<"data_query" | "general"> {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an intent classifier. Determine if the user's message is asking about data from the database (inventory, vehicles, sales, etc.) or is a general question/conversation.

                    Respond with ONLY one word: "data_query" or "general"

                    Examples:
                    - "Show me all Toyota vehicles" → data_query
                    - "How many cars do we have?" → data_query
                    - "What's the average price?" → data_query
                    - "Hello" → general
                    - "What can you help me with?" → general
                    - "Explain how this works" → general
                    - "Tell me about inventory management" → general`,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.1,
      max_tokens: 10,
    });

    const intent = response.choices[0]?.message?.content?.trim().toLowerCase();
    return intent === "data_query" ? "data_query" : "general";
  } catch (error) {
    console.error("Intent classification error:", error);
    // Default to data_query if classification fails
    return "data_query";
  }
}

async function generateGeneralResponse(
  message: string,
  context?: { dealerName?: string; inventoryCount?: number },
): Promise<string> {
  try {
    const contextInfo = context
      ? `\n\nContext: You are helping a dealer named "${context.dealerName}". They have ${context.inventoryCount || 0} vehicles in inventory.`
      : "";

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a friendly and helpful AI assistant for a car dealership management system called Hrafn. You help dealers manage their inventory, understand their data, and answer questions about the system.

                    Your tone should be:
                    - Warm, professional, and customer-supportive
                    - Conversational and easy to understand
                    - Helpful and proactive
                    - Use "we" and "you" naturally
                    - Avoid overly technical jargon unless asked

                    You can help with:
                    - Explaining how to use the system
                    - Answering questions about inventory management
                    - Providing general information about dealership operations
                    - Being a helpful assistant${contextInfo}`,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return (
      response.choices[0]?.message?.content?.trim() ||
      "I'm here to help! How can I assist you today?"
    );
  } catch (error) {
    console.error("General response generation error:", error);
    return "I'm here to help! Could you please rephrase your question?";
  }
}

async function formatDataResultsAsNaturalLanguage(
  sql: string,
  results: any[],
  originalQuestion: string,
): Promise<string> {
  if (results.length === 0) {
    return `I searched our inventory based on your question "${originalQuestion}", but I couldn't find any matching vehicles. Would you like to try a different search?`;
  }

  // Format results for AI to convert to natural language
  const resultsSummary = results.slice(0, 10).map((row, idx) => {
    const fields = Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
    return `${idx + 1}. ${fields}`;
  });

  const hasMore = results.length > 10;
  const summaryText = hasMore
    ? `Here are the first 10 results out of ${results.length} total:`
    : `Here are the ${results.length} result${results.length === 1 ? "" : "s"}:`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant explaining database query results to a car dealer. Convert the technical results into a friendly, natural language response.

                    Your tone should be:
                    - Warm and professional
                    - Conversational and easy to understand
                    - Use "we" and "you" naturally
                    - Highlight key information (make, model, price, etc.)
                    - If there are many results, mention the total count

                    Format the response as a natural conversation, not a technical report.`,
        },
        {
          role: "user",
          content: `The user asked: "${originalQuestion}"

                    Query executed: ${sql}

                    Results (${results.length} total):
                    ${summaryText}
                    ${resultsSummary.join("\n")}
                    ${hasMore ? `\n(Showing first 10 of ${results.length} results)` : ""}

                    Provide a friendly, natural language response explaining these results.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    return response.choices[0]?.message?.content?.trim() || formatSQLResults(results);
  } catch (error) {
    console.error("Natural language formatting error:", error);
    // Fallback to formatted table
    return formatSQLResults(results);
  }
}

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

function formatSQLResults(results: any[]): string {
  if (results.length === 0) {
    return "No results found.";
  }

  // Format as a simple table
  const headers = Object.keys(results[0]);
  const rows = results.map((row) => headers.map((h) => String(row[h] || "")));

  let output = "```\n";
  // Header row
  output += headers.join(" | ") + "\n";
  output += headers.map(() => "---").join(" | ") + "\n";
  // Data rows
  rows.forEach((row) => {
    output += row.join(" | ") + "\n";
  });
  output += "```\n\n";
  output += `Found ${results.length} result${results.length === 1 ? "" : "s"}.`;

  return output;
}

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const user = getUserFromRequest(req);
    if (!user || !user.dealerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await req.json();
    console.log("message", message);
    const safeMessage = typeof message === "string" ? message.trim() : "";

    if (!safeMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    console.log("safeMessage", safeMessage);
    // Classify user intent
    const intent = await classifyIntent(safeMessage);
    console.log("intent", intent);
    if (intent === "data_query") {
      // Handle data queries: generate SQL, execute, and format as natural language
      try {
        // Generate SQL from natural language
        const sql = await generateSQLFromNaturalLanguage(safeMessage, user.dealerId);
        console.log("sql", sql);
        // Execute SQL query
        const results = await executeSQL(sql);
        console.log("results", results);
        // Format results as natural language response
        const reply = await formatDataResultsAsNaturalLanguage(sql, results, safeMessage);
        console.log("reply", reply);
        return NextResponse.json({ reply });
      } catch (sqlError) {
        // If SQL generation/execution fails, fall back to general response
        console.error("SQL query error:", sqlError);
        const errorMessage = sqlError instanceof Error ? sqlError.message : "Unknown error";
        const reply = await generateGeneralResponse(
          `I tried to find that information, but encountered an issue: ${errorMessage}. Could you rephrase your question? For example, you could ask "Show me all Toyota vehicles" or "How many cars are available?"`,
        );
        console.log("reply", reply);
        return NextResponse.json({ reply });
      }
    } else {
      // Handle general questions with AI
      // Get some context about the dealer for better responses
      const dealer = await prisma.dealer.findUnique({
        where: { id: user.dealerId },
      });

      const inventoryCountResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*)::int as count FROM inventory_listings WHERE "dealerId" = '${user.dealerId}'::uuid`,
      );
      const inventoryCount = inventoryCountResult[0] ? Number(inventoryCountResult[0].count) : 0;

      const context = {
        dealerName: dealer?.name || "your dealership",
        inventoryCount,
      };

      const reply = await generateGeneralResponse(safeMessage, context);
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
