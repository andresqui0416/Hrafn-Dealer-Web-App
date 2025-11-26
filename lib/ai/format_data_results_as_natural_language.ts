import { openai } from ".";

const FORMAT_DATA_RESULTS_AS_NATURAL_LANGUAGE_PROMPT = `
You are a helpful assistant explaining database query results to a car dealer. Convert the technical results into a friendly, natural language response.

Your tone should be:
- Warm and professional
- Conversational and easy to understand
- Use "we" and "you" naturally
- Highlight key information (make, model, price, etc.)
- If there are many results, mention the total count

Format the response as a natural conversation, not a technical report.
`;

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

export async function formatDataResultsAsNaturalLanguage(
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
          content: FORMAT_DATA_RESULTS_AS_NATURAL_LANGUAGE_PROMPT,
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
