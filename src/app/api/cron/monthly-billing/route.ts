import { NextResponse } from "next/server";
import { verifyCronSecret, errorResponse } from "@/lib/api";
import { runMonthlyBilling } from "@/lib/cron/jobs";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const summary = await runMonthlyBilling();
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/monthly-billing] failed:", message);
    return errorResponse(message, 500);
  }
}
