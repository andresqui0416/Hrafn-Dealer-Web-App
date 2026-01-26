import { NextRequest, NextResponse } from "next/server";
import { classifyIntent, openai, generateSQLFromNaturalLanguage } from "@/lib/ai";
import { PrismaClient } from "@prisma/client";
import { performance } from "perf_hooks";
import {
  retrieveSchemaColumnDocsForTables,
  retrieveSchemaTableDocs,
} from "@/lib/ai/rag/schema_store";
import {
  compileSchemaBlock,
  selectColumnsForTables,
  selectJoinEdgesForTables,
  selectEnumsForTables,
} from "@/lib/ai/rag/schema_compiler";
import { retrieveNLQExamples } from "@/lib/ai/rag/examples_store";
import { generateSQLFromNaturalLanguageRAG } from "@/lib/ai/sql-generator-rag";
import { validateIdentifiersAgainstSchema, validateSelectOnly } from "@/lib/ai/rag/sql_validator";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

type ChatMessage = { role: string; content: any };

function normalizeChatMessages(messages: any[]): Array<{ role: "user" | "assistant"; content: string }> {
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of messages) {
    const role = m?.role;
    if (role !== "user" && role !== "assistant") continue;
    const content = typeof m?.content === "string" ? m.content.trim() : "";
    if (!content) continue;
    out.push({ role, content });
  }
  return out;
}

function lastN<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  return arr.slice(arr.length - n);
}

async function summarizeLastFiveForNLQ(
  openaiClient: typeof openai,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const recent = lastN(messages, 5);
  const transcript = recent
    .map((m, idx) => {
      const label = m.role === "user" ? "User" : "Assistant";
      return `${idx + 1}. ${label}: ${m.content}`;
    })
    .join("\n");

  // If there's no prior context, avoid an extra model call and just return the user message.
  if (recent.length <= 1) {
    return `Final user message: ${recent[0]?.content ?? ""}`.trim();
  }

  const summaryModel = process.env.OPENAI_SUMMARY_MODEL || "gpt-4.1-mini";

  const response: any = await openaiClient.responses.create({
    model: summaryModel,
    input: [
      {
        role: "system",
        content:
          "You summarize short chat context to avoid confusion for downstream steps. Output must be a single plain-text summary (no headings, no bullet points, no JSON). Resolve references like 'that', 'above', 'same as before'. Include all constraints needed to answer the final user request (metrics, entities, filters, time ranges, grouping, sorting, limits/pagination, IDs). If critical info is missing, add one short clarifying question at the end.",
      },
      {
        role: "user",
        content:
          `Summarize the following LAST 5 messages (User/Assistant/User/Assistant/User-final) into a single plain-text summary.\n\n` +
          `Messages:\n${transcript}`,
      },
    ],
  });

  const finalOutput = response.output?.[0];
  const text =
    (finalOutput as any)?.content?.[0]?.text?.trim?.() ??
    `${recent[recent.length - 1]?.content ?? ""}`;
  return text;
}

async function executeSQL(sql: string): Promise<any[]> {
  try {
    // Validate SQL before execution
    validateSelectOnly(sql);

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

async function explainSQL(sql: string) {
  const cleaned = sql.trim().replace(/;\s*$/, "");
  // EXPLAIN only for SELECT/CTE
  validateSelectOnly(cleaned);
  const explain = await prisma.$queryRawUnsafe(`EXPLAIN ${cleaned}`);
  return explain;
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

    const normalized = normalizeChatMessages(messages);
    const lastUser = [...normalized].reverse().find((m) => m.role === "user");
    const safeMessage = typeof lastUser?.content === "string" ? lastUser.content.trim() : "";

    if (!safeMessage) {
      return NextResponse.json({ error: "Last user message is required" }, { status: 400 });
    }

    // Summarize the last 5 messages (U/A/U/A/U-final) so we can interpret follow-ups that refer to
    // earlier context ("same as above", "that one", etc.). This summary is injected into intent
    // classification and NLQ SQL generation.
    const lastFiveSummary = await summarizeLastFiveForNLQ(openai, normalized);

    // 0) Classify intent first (per guide). If not a data query, keep the original chat flow but
    // do NOT expose tools / DB querying.
    let intent: "data_query" | "general" = "data_query";
    try {
      // Ignore microserver for now; use local OpenAI-based intent classifier
      intent = await classifyIntent(`${lastFiveSummary}\n\nFinal user message: ${safeMessage}`);
    } catch (e) {
      // If classification fails, default to data_query (safer for the existing behavior)
      console.warn("Intent classification failed; defaulting to data_query:", e);
      intent = "data_query";
    }

    // If general, skip tools entirely and just respond conversationally
    if (intent === "general") {
      const input: any[] = [
        {
          role: "system",
          content:
            "You are Hrafn's AI sales assistant for car dealerships. Answer the user conversationally. If the user asks for specific database numbers, ask a clarifying question or tell them you can look it up.",
        },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const response: any = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1",
        input,
      });

      const finalOutput = response.output?.[0];
      const finalText =
        (finalOutput as any)?.content?.[0]?.text?.trim?.() ??
        "I'm here to help! How can I assist you today?";

      return NextResponse.json({ reply: finalText });
    }

    // Get user's dealer (needed for data tools)
    const userDealerRole = await prisma.userDealerRole.findFirst({
      where: { userId },
      select: { dealerId: true },
      orderBy: { createdAt: "asc" },
    });

    const dealerId = userDealerRole?.dealerId;
    const nowIso = new Date().toISOString();

    const dealer =
      dealerId
        ? await prisma.dealer.findUnique({
            where: { id: dealerId },
            select: { id: true, name: true, address: true },
          })
        : null;

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

      const contextualQuestion = `${lastFiveSummary}\n\nFinal user message: ${question}`.trim();

      const sqlStart = performance.now();

      // NLQ pipeline upgrade (RAG + validate/repair) with safe fallback to original generator.
      // This keeps the original agent flow intact while improving NLQ accuracy when Pinecone is available.
      let sql: string | null = null;

      try {
        // 1) Retrieve relevant tables first (Pinecone table docs)
        const tableDocs = await retrieveSchemaTableDocs(contextualQuestion, 8);
        const mappedTables = Array.from(
          new Set(
            tableDocs
              .map((d) => d.metadata?.mapped_table)
              .filter((t): t is string => typeof t === "string" && t.length > 0),
          ),
        ).slice(0, 6);

        if (!mappedTables.length) throw new Error("No relevant tables found for this question");

        // 2) Retrieve relevant columns within those tables (Pinecone column docs, filtered by mapped_table)
        const columnDocs = await retrieveSchemaColumnDocsForTables(contextualQuestion, mappedTables, 120);
        console.log(`[NLQ RAG] Retrieved ${columnDocs.length} column docs for tables: ${mappedTables.join(", ")}`);
        if (columnDocs.length > 0) {
          console.log(`[NLQ RAG] Sample column doc:`, {
            table: columnDocs[0].metadata?.mapped_table,
            column: columnDocs[0].metadata?.mapped_column,
            score: columnDocs[0].score,
          });
        }
        const tableColumns = selectColumnsForTables(columnDocs, mappedTables);
        console.log(`[NLQ RAG] Selected columns per table:`, tableColumns);
        const joinEdges = selectJoinEdgesForTables(mappedTables);
        const enumData = selectEnumsForTables(mappedTables);
        const schemaBlock = compileSchemaBlock(mappedTables, tableColumns, joinEdges, enumData);

        // 3) Retrieve similar NLQ examples (optional)
        const examples = await retrieveNLQExamples(prisma, contextualQuestion, 3);

        // 4) Generate SQL (strict, SQL-only)
        sql = await generateSQLFromNaturalLanguageRAG({
          question: contextualQuestion,
          dealerId,
          schemaBlock,
          examples,
        });

        // 5) Validate + EXPLAIN; if error -> one repair attempt
        try {
          validateSelectOnly(sql);
          validateIdentifiersAgainstSchema(sql, schemaBlock);
          await explainSQL(sql);
        } catch (err) {
          const errorHint =
            err instanceof Error ? err.message : "Unknown SQL validation error";
          sql = await generateSQLFromNaturalLanguageRAG({
            question: contextualQuestion,
            dealerId,
            schemaBlock,
            examples,
            errorHint,
          });
          validateSelectOnly(sql);
          validateIdentifiersAgainstSchema(sql, schemaBlock);
          await explainSQL(sql);
        }
      } catch (ragErr) {
        console.warn(
          "NLQ RAG pipeline unavailable/failed; falling back to original SQL generator:",
          ragErr,
        );
        // Original behavior: built-in schema prompt based SQL generator.
        sql = await generateSQLFromNaturalLanguage(contextualQuestion, dealerId);
      }

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
      {
        role: "system",
        content:
          `Recent chat summary (last 5 messages):\n${lastFiveSummary}\n\nUse this summary to correctly interpret the user's latest request.`,
      },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
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
          content: `Context:\n- Dealer: ${dealer ? `${dealer.name} (${dealer.id})` : "Unknown"}${dealer?.address ? `\n- Dealer address: ${dealer.address}` : ""}\n- Current time (ISO): ${nowIso}\n\nThe run_data_query tool was called and returned the following results:\n\n${toolResultJson}\n\nPlease provide a friendly, natural language response explaining these results to the user.`,
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
