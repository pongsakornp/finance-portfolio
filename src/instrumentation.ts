/**
 * Runs once when the Next.js server boots (node runtime only).
 * Starts the cron scheduler: nightly history/FX backfills + hourly alert checks.
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.CRON_ENABLED !== "false" &&
    !process.env.NEXT_PHASE?.includes("build")
  ) {
    const { startCron, warmFunds } = await import("@/lib/cron");
    startCron();
    void warmFunds(); // seed the fund catalog on boot so prod doesn't wait for the 5 AM tick
  }
}
