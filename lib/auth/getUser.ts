import { NextRequest } from "next/server";
import { JWTPayload } from "./jwt";

export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  const userId = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const name = request.headers.get("x-user-name");

  if (!userId) {
    return null;
  }

  return {
    userId,
    email: email || "",
    name: name || "",
  };
}
