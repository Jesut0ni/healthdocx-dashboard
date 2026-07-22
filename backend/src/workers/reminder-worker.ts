import dotenv from "dotenv";
import { closeDb } from "../db/client";
import { startReminderScheduler } from "./reminder-scheduler";

dotenv.config({ path: "backend/.env" });

const stopScheduler = startReminderScheduler({ runImmediately: true });

console.log("HealthDocX reminder worker is running.");

async function shutdown() {
  stopScheduler();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
