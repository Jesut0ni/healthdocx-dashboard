import { closeDb } from "./db/client";
import { createBackendApp } from "./app";
import { startReminderScheduler } from "./workers/reminder-scheduler";

const app = createBackendApp();
const port = Number(process.env.PORT ?? 4000);

const stopReminderScheduler =
  process.env.ENABLE_REMINDER_WORKER === "true"
    ? startReminderScheduler({ runImmediately: false })
    : undefined;

const server = app.listen(port, () => {
  console.log(`HealthDocX backend API listening on http://localhost:${port}`);
});

async function shutdown() {
  stopReminderScheduler?.();
  await closeDb();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
