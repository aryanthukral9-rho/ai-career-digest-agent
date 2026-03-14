import cron from "node-cron";
import dotenv from "dotenv";
import { runDigest } from "./digest.js";
import { loadConfig } from "./state.js";

dotenv.config();

const args = process.argv.slice(2);

if (args.includes("--now")) {
  console.log("[Scheduler] Running digest immediately...");
  runDigest().catch((err) => {
    console.error("[Scheduler] Digest failed:", err);
    process.exit(1);
  });
} else {
  loadConfig().then((config) => {
    const schedule = process.env.DIGEST_TIME ?? config.digestTime;
    console.log(`[Scheduler] Digest scheduled: "${schedule}"`);

    cron.schedule(schedule, () => {
      console.log(`[Scheduler] Triggered at ${new Date().toISOString()}`);
      runDigest().catch((err) => {
        console.error("[Scheduler] Digest failed:", err);
      });
    });

    console.log("[Scheduler] Waiting for next run. Press Ctrl+C to stop.");
  });
}
