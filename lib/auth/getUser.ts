import { NextRequest } from "next/server";
import { JWTPayload } from "./jwt";

export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  const userId = request.headers.get("x-user-id");
  const dealerId = request.headers.get("x-dealer-id");
  const role = request.headers.get("x-user-role");
  const email = request.headers.get("x-user-email");

  if (!userId || !dealerId || !role) {
    return null;
  }

  return {
    userId,
    dealerId,
    email: email || "",
    role,
  };
}
