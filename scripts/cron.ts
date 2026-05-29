/**
 * Standalone cron worker.
 *
 * Run with:  npx tsx scripts/cron.ts
 *
 * Note: tsx may not resolve the "@/..." path alias, so we import the jobs
 * via a relative path.
 */
import cron from "node-cron";
import { runMonthlyBilling, runOverdueCheck } from "../src/lib/cron/jobs";

const MONTHLY_BILLING_SCHEDULE = "0 9 1 * *"; // 09:00 on the 1st of each month
const OVERDUE_CHECK_SCHEDULE = "0 10 * * *"; // 10:00 every day

function ts(): string {
  return new Date().toISOString();
}

async function runJob<T>(name: string, fn: () => Promise<T>): Promise<void> {
  console.log(`[${ts()}] >> Starting "${name}"...`);
  try {
    const summary = await fn();
    console.log(
      `[${ts()}] OK Finished "${name}":`,
      JSON.stringify(summary, null, 2)
    );
  } catch (err) {
    console.error(
      `[${ts()}] ERROR "${name}" failed:`,
      err instanceof Error ? err.stack ?? err.message : err
    );
  }
}

function main(): void {
  console.log("======================================================");
  console.log("  Aitek Billing — Cron Worker");
  console.log("======================================================");
  console.log(`  Monthly billing : ${MONTHLY_BILLING_SCHEDULE}  (09:00, 1st)`);
  console.log(`  Overdue check   : ${OVERDUE_CHECK_SCHEDULE}  (10:00 daily)`);
  console.log("======================================================");
  console.log(`  Started at ${ts()}. Waiting for scheduled runs...`);

  cron.schedule(MONTHLY_BILLING_SCHEDULE, () => {
    void runJob("monthly-billing", runMonthlyBilling);
  });

  cron.schedule(OVERDUE_CHECK_SCHEDULE, () => {
    void runJob("overdue-check", runOverdueCheck);
  });
}

// Guard against unhandled rejections crashing the worker.
process.on("unhandledRejection", (reason) => {
  console.error(`[${ts()}] Unhandled rejection:`, reason);
});
process.on("uncaughtException", (err) => {
  console.error(`[${ts()}] Uncaught exception:`, err);
});

main();
