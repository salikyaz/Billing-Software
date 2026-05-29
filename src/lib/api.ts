import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { timingSafeEqualStr } from "@/lib/crypto";

/** Standard JSON error response. */
export function errorResponse(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function jsonResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Ensures the request is from an authenticated admin.
 * Returns the session, or throws an `ApiError` (caught by `handleRoute`).
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new ApiError("Unauthorized", 401);
  }
  return session;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * Wraps a route handler with consistent error handling. Use:
 *   export const GET = (req) => handleRoute(() => myLogic(req));
 */
export async function handleRoute<T>(
  fn: () => Promise<T>
): Promise<NextResponse> {
  try {
    const result = await fn();
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result ?? {});
  } catch (err) {
    if (err instanceof ApiError) {
      return errorResponse(err.message, err.status, err.details);
    }
    if (err instanceof ZodError) {
      return errorResponse("Validation failed", 422, err.flatten());
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return errorResponse("A record with that value already exists.", 409);
      }
      if (err.code === "P2025") {
        return errorResponse("Record not found.", 404);
      }
    }
    console.error("[api] Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
}

/** Verify the cron shared-secret on cron API routes (constant-time compare). */
export function verifyCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header =
    req.headers.get("authorization") ?? req.headers.get("x-cron-secret") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  return timingSafeEqualStr(token, secret);
}
