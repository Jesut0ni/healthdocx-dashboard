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
import { assignees, users as seedUsers } from "../../../src/lib/healthdocx-data";
import type { ReminderCadence, ReminderChannel } from "../lib/domain";
import { nextReminderRun } from "../lib/domain";

const cadenceByIndex: ReminderCadence[] = [
  "Daily",
  "Twice a day",
  "Weekly",
  "Daily",
  "Twice a day",
  "Weekly",
];

function shortName(name: string) {
  return name.split(" ")[0];
}

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

  await db.insert(users).values(
    seedUsers.map((user) => {
      const userShortName = shortName(user.name);

      return {
        id: user.id,
        displayName: user.name,
        shortName: userShortName,
        email: `${userShortName.toLowerCase()}@healthdocx.org`,
        role: user.role,
        team: user.team,
        access: user.access,
        status: user.status,
      };
    }),
  );

  const ownerIdByShortName = new Map(seedUsers.map((user) => [shortName(user.name), user.id]));

  await db.insert(reminderRules).values(
    assignees.map((owner, index) => {
      const cadence = cadenceByIndex[index % cadenceByIndex.length];
      const channel: ReminderChannel = "Email";

      return {
        id: `REM-${String(index + 1).padStart(2, "0")}`,
        ownerId: ownerIdByShortName.get(owner) ?? seedUsers[0].id,
        cadence,
        channel,
        enabled: true,
        nextRun: nextReminderRun(cadence),
        lastSent: "Not sent",
      };
    }),
  );
}

seed()
  .then(async () => {
    await closeDb();
    console.log("Seeded clean HealthDocX dashboard users and reminder rules.");
  })
  .catch(async (error: unknown) => {
    await closeDb();
    console.error(error);
    process.exit(1);
  });
