import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    const safeMessage = typeof message === "string" ? message : "";

    // Stubbed agent reply
    const reply = `Agent: I received your message: "${safeMessage}". (stubbed)`;

    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
