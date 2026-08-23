/**
 * Runs once when the Next.js server boots (node runtime only).
 * Starts the cron scheduler: nightly snapshots + hourly alert checks.
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.CRON_ENABLED !== "false" &&
    !process.env.NEXT_PHASE?.includes("build")
  ) {
    const { startCron } = await import("@/lib/cron");
    startCron();
  }
}
