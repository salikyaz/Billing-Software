import { NextResponse } from "next/server";
import { verifyCronSecret, errorResponse } from "@/lib/api";
import { runOverdueCheck } from "@/lib/cron/jobs";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const summary = await runOverdueCheck();
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/check-overdue] failed:", message);
    return errorResponse("Overdue check job failed", 500);
  }
}
