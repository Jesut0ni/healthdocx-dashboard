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
import {
  assignees,
  auditEvents as seedAuditEvents,
  docs as seedDocs,
  initialTasks,
  integrations as seedIntegrations,
  projects as seedProjects,
  users as seedUsers,
  workBatches as seedWorkBatches,
} from "../../../src/lib/healthdocx-data";
import type { ReminderCadence, ReminderChannel } from "../lib/domain";
import { nextReminderRun } from "../lib/domain";

const cadenceByIndex: ReminderCadence[] = ["Daily", "Twice a day", "Weekly"];

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
  const projectIdByName = new Map(seedProjects.map((project) => [project.name, project.id]));

  await db.insert(projects).values(
    seedProjects.map((project) => ({
      id: project.id,
      name: project.name,
      area: project.area,
      stage: project.stage,
      ownerId: ownerIdByShortName.get(project.owner) ?? seedUsers[0].id,
      risk: project.risk,
      workItems: project.workItems,
      progress: project.progress,
      targetDate: project.targetDate,
    })),
  );

  await db.insert(tasks).values(
    initialTasks.map((task) => ({
      id: task.id,
      title: task.title,
      projectId: projectIdByName.get(task.project) ?? seedProjects[0].id,
      workstream: task.workstream,
      ownerId: ownerIdByShortName.get(task.owner) ?? seedUsers[0].id,
      status: task.status,
      priority: task.priority,
      due: task.due,
      comments: task.comments,
      privateDetailsClear: task.privateDetailsClear,
    })),
  );

  await db.insert(workBatches).values(
    seedWorkBatches.map((batch) => ({
      id: batch.id,
      projectId: projectIdByName.get(batch.project) ?? seedProjects[0].id,
      team: batch.team,
      workType: batch.workType,
      items: batch.items,
      qualityScore: batch.qualityScore,
      reviewItems: batch.reviewItems,
      status: batch.status,
    })),
  );

  await db.insert(integrations).values(
    seedIntegrations.map((integration) => ({
      id: integration.id,
      projectId: projectIdByName.get(integration.project) ?? seedProjects[0].id,
      system: integration.system,
      method: integration.method,
      status: integration.status,
      mappingProgress: integration.mappingProgress,
      lastSync: integration.lastSync,
      openIssues: integration.openIssues,
    })),
  );

  await db.insert(docs).values(
    seedDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      area: doc.area,
      ownerId: ownerIdByShortName.get(doc.owner) ?? seedUsers[0].id,
      updatedLabel: doc.updated,
      status: doc.status,
    })),
  );

  await db.insert(reminderRules).values(
    assignees.map((owner, index) => {
      const cadence = cadenceByIndex[index % cadenceByIndex.length];
      const channel: ReminderChannel = index % 2 === 0 ? "Email" : "Dashboard";

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

  await db.insert(auditEvents).values(
    seedAuditEvents.map((event) => ({
      id: event.id,
      actorId: ownerIdByShortName.get(event.actor),
      actorName: event.actor,
      action: event.action,
      area: event.area,
      timeLabel: event.time,
    })),
  );
}

seed()
  .then(async () => {
    await closeDb();
    console.log("Seeded HealthDocX dashboard backend data.");
  })
  .catch(async (error: unknown) => {
    await closeDb();
    console.error(error);
    process.exit(1);
  });
