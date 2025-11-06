import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "./auth";

export type Middleware = (
  request: NextRequest,
) => Promise<NextResponse | null> | NextResponse | null;

/**
 * Compose multiple middlewares in order
 * Returns first non-null response, or continues to next middleware
 */
export async function composeMiddlewares(
  request: NextRequest,
  ...middlewares: Middleware[]
): Promise<NextResponse> {
  for (const middleware of middlewares) {
    const response = await middleware(request);
    if (response !== null) {
      return response;
    }
  }
  return NextResponse.next();
}
