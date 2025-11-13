import { openai } from ".";

const SQL_GENERATION_PROMPT = `You are a SQL query generator for a PostgreSQL database. Your task is to convert natural language questions into valid SQL queries.

Database Schema:
- Table: inventory_listings
  - Columns: id (UUID), "dealerId" (UUID), vin (TEXT), year (INTEGER), make (TEXT), model (TEXT), trim (TEXT), body_style (TEXT), drivetrain (TEXT), msrp (DECIMAL), price (DECIMAL), mileage (INTEGER), status (TEXT), scraped_at (TIMESTAMP), created_at (TIMESTAMP), updated_at (TIMESTAMP)

Rules:
1. Always filter by "dealerId" when querying inventory_listings (use WHERE "dealerId" = :dealerId)
2. Return ONLY the SQL query, no explanations, no markdown, no code blocks
3. Use parameterized queries with :dealerId placeholder
4. Use standard PostgreSQL syntax
5. For aggregations, use appropriate GROUP BY clauses
6. For text searches, use ILIKE for case-insensitive matching
7. Always use proper SQL formatting
8. Use quoted identifiers for "dealerId" column (it's camelCase in the database)
9. IMPORTANT: For SELECT queries that return multiple rows, ALWAYS add LIMIT clause (default LIMIT 100)
10. IMPORTANT: Only select necessary columns, avoid SELECT * when possible (use specific column names)
11. Use indexes: "dealerId" is indexed, "make" and "model" are indexed together

Examples:
- "Show me all Toyota vehicles" -> SELECT id, vin, year, make, model, price, mileage, status FROM inventory_listings WHERE "dealerId" = :dealerId AND make ILIKE '%Toyota%' LIMIT 100;
- "How many cars do we have?" -> SELECT COUNT(*) as count FROM inventory_listings WHERE "dealerId" = :dealerId;
- "What's the average price?" -> SELECT AVG(price) as avg_price FROM inventory_listings WHERE "dealerId" = :dealerId AND price IS NOT NULL;
- "List vehicles under $30000" -> SELECT id, vin, year, make, model, price, mileage FROM inventory_listings WHERE "dealerId" = :dealerId AND price < 30000 ORDER BY price ASC LIMIT 100;

Now convert this question to SQL:`;

export async function generateSQLFromNaturalLanguage(
  question: string,
  dealerId: string
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

    // Replace :dealerId placeholder with actual dealer ID
    return cleanedSQL.replace(/:dealerId/g, `'${dealerId}'`);
  } catch (error) {
    console.error("Error generating SQL:", error);
    throw new Error("Failed to generate SQL query");
  }
}

