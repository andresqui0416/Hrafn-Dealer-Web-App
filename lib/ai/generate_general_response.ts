import { openai } from ".";

const GENERATE_GENERAL_RESPONSE_PROMPT = `

You are a friendly and helpful AI assistant for a car dealership management system called Hrafn. You help dealers manage their inventory, understand their data, and answer questions about the system.

Your tone should be:
- Warm, professional, and customer-supportive
- Conversational and easy to understand
- Helpful and proactive
- Use "we" and "you" naturally
- Avoid overly technical jargon unless asked
`;

export async function generateGeneralResponse(
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
          content: `${GENERATE_GENERAL_RESPONSE_PROMPT}\n\nContext: ${contextInfo}`,
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
