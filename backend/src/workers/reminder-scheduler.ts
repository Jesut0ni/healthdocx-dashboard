import { sendReminderBatches } from "../services/reminder-delivery";

let running = false;

async function tick(now = new Date()) {
  if (running) {
    return;
  }

  running = true;

  try {
    const sent = await sendReminderBatches({
      actor: "Reminder worker",
      dueOnly: true,
      now,
    });

    if (sent.length > 0) {
      console.log(`Reminder worker sent ${sent.length} batch${sent.length === 1 ? "" : "es"}.`);
    }
  } catch (error) {
    console.error("Reminder worker failed.", error);
  } finally {
    running = false;
  }
}

export function startReminderScheduler({
  intervalMs = Number(process.env.REMINDER_WORKER_INTERVAL_MS ?? 60_000),
  runImmediately = false,
} = {}) {
  if (runImmediately) {
    void tick();
  }

  const interval = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => clearInterval(interval);
}
