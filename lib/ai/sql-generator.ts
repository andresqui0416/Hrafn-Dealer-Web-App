import { openai } from ".";

const SQL_GENERATION_PROMPT = `You are a SQL query generator for a PostgreSQL database. Your task is to convert natural language questions into valid SQL queries.

Database Schema:
- Table: inventory_listings
  - Columns: id (UUID), "userId" (UUID), "appId" (UUID), vin (TEXT), year (INTEGER), make (TEXT), model (TEXT), trim (TEXT), body_style (TEXT), drivetrain (TEXT), msrp (DECIMAL), price (DECIMAL), mileage (INTEGER), status (TEXT), scraped_at (TIMESTAMP), created_at (TIMESTAMP), updated_at (TIMESTAMP)

Rules:
1. Always filter by "userId" when querying inventory_listings (use WHERE "userId" = :userId)
2. If "appId" is provided, also filter by "appId" (use WHERE "userId" = :userId AND "appId" = :appId)
3. Return ONLY the SQL query, no explanations, no markdown, no code blocks
4. Use parameterized queries with :userId and :appId placeholders
5. Use standard PostgreSQL syntax
6. For aggregations, use appropriate GROUP BY clauses
7. For text searches, use ILIKE for case-insensitive matching
8. Always use proper SQL formatting
9. Use quoted identifiers for "userId" and "appId" columns (they're camelCase in the database)
10. IMPORTANT: For SELECT queries that return multiple rows, ALWAYS add LIMIT clause (default LIMIT 100)
11. IMPORTANT: Only select necessary columns, avoid SELECT * when possible (use specific column names)
12. Use indexes: "userId" is indexed, "appId" is indexed, "make" and "model" are indexed together

Examples:
- "Show me all Toyota vehicles" -> SELECT id, vin, year, make, model, price, mileage, status FROM inventory_listings WHERE "userId" = :userId AND make ILIKE '%Toyota%' LIMIT 100;
- "How many cars do we have?" -> SELECT COUNT(*) as count FROM inventory_listings WHERE "userId" = :userId;
- "What's the average price?" -> SELECT AVG(price) as avg_price FROM inventory_listings WHERE "userId" = :userId AND price IS NOT NULL;
- "List vehicles under $30000" -> SELECT id, vin, year, make, model, price, mileage FROM inventory_listings WHERE "userId" = :userId AND price < 30000 ORDER BY price ASC LIMIT 100;

Now convert this question to SQL:`;

export async function generateSQLFromNaturalLanguage(
  question: string,
  userId: string,
  appId?: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: SQL_GENERATION_PROMPT,
        },
        {
          role: "user",
          content: question,
        },
      ],
      temperature: 0.1, // Low temperature for consistent SQL generation
      max_tokens: 500,
    });

    const sql = response.choices[0]?.message?.content?.trim();
    if (!sql) {
      throw new Error("No SQL generated from OpenAI");
    }

    // Clean up the SQL (remove markdown code blocks if present)
    const cleanedSQL = sql.replace(/^```sql\n?/i, "").replace(/^```\n?/i, "").replace(/\n?```$/i, "").trim();

    // Replace :userId placeholder with actual user ID
    let finalSQL = cleanedSQL.replace(/:userId/g, `'${userId}'`);
    
    // Replace :appId placeholder if appId is provided
    if (appId) {
      finalSQL = finalSQL.replace(/:appId/g, `'${appId}'`);
      // If appId is provided but not in the SQL, add it to the WHERE clause
      if (finalSQL.toLowerCase().includes("from inventory_listings") && !finalSQL.includes(`"appId"`)) {
        const whereMatch = finalSQL.match(/where\s+/i);
        if (whereMatch) {
          finalSQL = finalSQL.replace(/where\s+/i, `WHERE "userId" = '${userId}' AND "appId" = '${appId}' AND `);
        } else {
          finalSQL = finalSQL.replace(
            /from\s+inventory_listings/i,
            `FROM inventory_listings WHERE "userId" = '${userId}' AND "appId" = '${appId}'`
          );
        }
      }
    }

    return finalSQL;
  } catch (error) {
    console.error("Error generating SQL:", error);
    throw new Error("Failed to generate SQL query");
  }
}

