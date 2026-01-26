import { openai } from "@/lib/ai";
import type { NLQExample } from "@/lib/ai/rag/examples_store";

function formatExamples(examples: NLQExample[]) {
  if (!examples.length) return "";
  const lines: string[] = ["Generate based on similar examples:"];
  examples.forEach((ex, i) => {
    lines.push(`Example ${i + 1} NL: ${ex.question}`);
    lines.push(`Example ${i + 1} SQL: ${ex.sql}`);
  });
  return lines.join("\n");
}

export async function generateSQLFromNaturalLanguageRAG(args: {
  question: string;
  dealerId: string;
  schemaBlock: string;
  examples?: NLQExample[];
  errorHint?: string;
}) {
  const { question, dealerId, schemaBlock } = args;
  const examples = args.examples || [];

  const sys = [
    `You are a Postgres SQL generator.`,
    `Return ONLY a single SQL query. No explanation. No markdown.`,
    ``,
    `Hard rules:`,
    `- Use ONLY the tables/columns listed in SCHEMA.`,
    `- Do not invent columns.`,
    `- Use double quotes for table/column identifiers.`,
    `- Use single quotes for string literals.`,
    `- Output must be a single SELECT statement (CTEs allowed via WITH).`,
    `- Never include destructive statements (INSERT/UPDATE/DELETE/ALTER/DROP/etc).`,
    `- CRITICAL: ALL queries that return multiple rows MUST include LIMIT 10. Maximum 10 rows. This is mandatory.`,
    ``,
    `Dealer scoping rule:`,
    `- If the selected tables include a "dealerId" column, you MUST filter results to that dealer: "dealerId" = '${dealerId}'.`,
    ``,
    `SCHEMA:`,
    schemaBlock,
    ``,
    ...(args.errorHint
      ? [
          `Previous attempt failed with this error. Fix the SQL accordingly:`,
          args.errorHint,
          ``,
        ]
      : []),
    ...(examples.length ? [formatExamples(examples), ``] : []),
  ].join("\n");

  console.log("sys", sys);

  const resp = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.1,
    max_tokens: 600,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `Task:\n${question}` },
    ],
  });

  let sql = resp.choices?.[0]?.message?.content?.trim();
  if (!sql) throw new Error("No SQL generated");

  sql = sql
    .replace(/^```sql\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Enforce LIMIT 10: Add or replace LIMIT clause to ensure max 10 rows
  // Skip only for aggregation queries WITHOUT GROUP BY (guaranteed single row)
  const hasGroupBy = /\bGROUP\s+BY\b/i.test(sql);
  const isSingleRowAggregation = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(sql) && !hasGroupBy;
  if (!isSingleRowAggregation) {
    // Check for trailing semicolon
    const hasSemicolon = sql.trim().endsWith(";");
    // Remove trailing semicolon temporarily
    let sqlNoSemicolon = sql.trim().replace(/;+$/, "");
    // Remove existing LIMIT clause if present (with or without semicolon)
    sqlNoSemicolon = sqlNoSemicolon.replace(/\s+LIMIT\s+\d+\s*$/i, "");
    // Add LIMIT 10
    sqlNoSemicolon = sqlNoSemicolon.trim() + " LIMIT 10";
    // Add back semicolon if it was there
    sql = hasSemicolon ? sqlNoSemicolon + ";" : sqlNoSemicolon;
  }

  return sql;
}

