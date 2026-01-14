import { NextRequest, NextResponse } from "next/server";
import { openai, generateSQLFromNaturalLanguage } from "@/lib/ai";
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
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = req.headers.get("x-user-id")!;

    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    if (!messages.length) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const safeMessage = typeof lastUser?.content === "string" ? lastUser.content.trim() : "";

    if (!safeMessage) {
      return NextResponse.json({ error: "Last user message is required" }, { status: 400 });
    }

    // Get user's dealer (needed for data tools)
    const userDealerRole = await prisma.userDealerRole.findFirst({
      where: { userId },
      select: { dealerId: true },
      orderBy: { createdAt: "asc" },
    });

    const dealerId = userDealerRole?.dealerId;

    // Define tools the model can call (Responses API function tool)
    const tools: any[] = [
      {
        type: "function",
        name: "run_data_query",
        description:
          "Run a safe SELECT-only SQL query against the database for this user's dealer. Use this for questions about inventory (available vehicles, stock), sales data (deals, revenue, commissions, sold vehicles), or any other data queries.",
        parameters: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description:
                "Natural language question about data, e.g. 'Show me all Toyota vehicles' (inventory), 'What is the total revenue this year?' (sales), 'How many cars are available?' (inventory), 'Show me sales from last month' (sales).",
            },
          },
          required: ["question"],
        },
      },
    ];

    async function runDataQuery(question: string) {
      if (!dealerId) {
        throw new Error("No dealer found for user");
      }

      // The SQL generator now has both inventory and sales schema built-in
      // It will automatically determine which tables to use based on the question
      const sqlStart = performance.now();
      const sql = await generateSQLFromNaturalLanguage(question, dealerId);
      const sqlTime = performance.now() - sqlStart;
      console.log(`[generateSQL] ${sqlTime.toFixed(2)}ms - sql: ${sql}`);

      const executeStart = performance.now();
      const results = await executeSQL(sql);
      const executeTime = performance.now() - executeStart;
      console.log(`[executeSQL] ${executeTime.toFixed(2)}ms - results: ${results.length} rows`);

      return { sql, results };
    }

    // Build input for Responses API: system + full conversation from client
    const input: any[] = [
      {
        role: "system",
        content:
          "You are Hrafn's AI sales assistant for car dealerships. You help dealers understand their inventory, sales performance, revenue, commissions, and answer questions about the business. You can call the run_data_query tool to query both inventory data (available vehicles, stock) and sales data (completed deals, revenue, commissions, sold vehicles). The tool automatically determines whether to query inventory or sales tables based on the question.",
      },
      ...messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // First Responses call: let the model decide whether to call tools
    let response: any = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1",
      input,
      tools,
      tool_choice: "auto",
    });

    // Handle tool call (data query - handles both inventory and sales)
    const firstOutput = response.output?.[0];
    console.log("firstOutput", JSON.stringify(firstOutput, null, 2));

    if (firstOutput?.type === "function_call" && firstOutput.name === "run_data_query") {
      console.log("Tool called: run_data_query, arguments:", firstOutput.arguments);

      // In Responses API, arguments may come as a JSON string; normalize to object
      const rawArgs = firstOutput.arguments;
      const parsedArgs = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs || {};
      const question = parsedArgs.question || safeMessage;

      let toolResult: any;
      try {
        toolResult = await runDataQuery(question);
      } catch (err) {
        console.error("SQL tool error:", err);
        return NextResponse.json(
          {
            reply:
              "I tried to look up that data but ran into an issue with the database. Please try rephrasing or ask a different question.",
          },
          { status: 200 },
        );
      }

      // Second Responses call: feed tool result back to the model to generate final answer
      // Responses API doesn't support "tool" role, so we pass the result as a "user" message
      const toolResultJson = JSON.stringify(toolResult, (_, value) =>
        typeof value === "bigint" ? Number(value) : value,
      );

      const followupInput: any[] = [
        ...input,
        {
          role: "user",
          content: `The run_data_query tool was called and returned the following results:\n\n${toolResultJson}\n\nPlease provide a friendly, natural language response explaining these results to the user.`,
        },
      ];

      response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1",
        input: followupInput,
      });
    }

    const finalOutput = response.output?.[0];
    const finalText =
      (finalOutput as any)?.content?.[0]?.text?.trim?.() ??
      "I'm here to help! How can I assist you today?";

    return NextResponse.json({ reply: finalText });
  } catch (error) {
    console.error("Chat agent error:", error);
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
