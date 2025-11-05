import { NextRequest } from "next/server";
import { composeMiddlewares } from "./middlewares";
import { authMiddleware } from "./middlewares/auth";

export async function middleware(request: NextRequest) {
  return composeMiddlewares(request, authMiddleware);
}

export const config = {
  matcher: ["/api/:path*"],
};

