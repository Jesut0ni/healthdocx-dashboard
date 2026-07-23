import { getDb, closeDb } from "./client";
import {
  auditEvents,
  docs,
  integrations,
  projects,
  reminderLogs,
  reminderRules,
  tasks,
  users,
  workBatches,
} from "./schema";

async function seed() {
  const db = getDb();

  await db.delete(reminderLogs);
  await db.delete(reminderRules);
  await db.delete(auditEvents);
  await db.delete(docs);
  await db.delete(integrations);
  await db.delete(workBatches);
  await db.delete(tasks);
  await db.delete(projects);
  await db.delete(users);
}

seed()
  .then(async () => {
    await closeDb();
    console.log("Reset HealthDocX dashboard to an empty live workspace.");
  })
  .catch(async (error: unknown) => {
    await closeDb();
    console.error(error);
    process.exit(1);
  });
