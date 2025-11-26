import { openai } from ".";

const CLASSIFY_INTENT_PROMPT = `
You are an intent classifier. Determine if the user's message is asking about data from the database (inventory, vehicles, sales, etc.) or is a general question/conversation.

Respond with ONLY one word: "data_query" or "general"

Examples:
- "Show me all Toyota vehicles" → data_query
- "How many cars do we have?" → data_query
- "What's the average price?" → data_query
- "Hello" → general
- "What can you help me with?" → general
- "Explain how this works" → general
- "Tell me about inventory management" → general`;

export async function classifyIntent(message: string): Promise<"data_query" | "general"> {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: CLASSIFY_INTENT_PROMPT,
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
    return "data_query";
  }
}
