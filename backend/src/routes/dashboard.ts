import { count, eq, ne } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "../db/client";
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
} from "../db/schema";

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard/bootstrap", async (_request, response) => {
  const db = getDb();

  const [
    userRows,
    projectRows,
    taskRows,
    batchRows,
    integrationRows,
    docRows,
    auditRows,
    reminderRuleRows,
    reminderLogRows,
    pendingTaskRows,
  ] = await Promise.all([
    db.select().from(users),
    db.select({ project: projects, owner: users }).from(projects).leftJoin(users, eq(projects.ownerId, users.id)),
    db
      .select({ task: tasks, project: projects, owner: users })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.ownerId, users.id)),
    db
      .select({ batch: workBatches, project: projects })
      .from(workBatches)
      .leftJoin(projects, eq(workBatches.projectId, projects.id)),
    db
      .select({ integration: integrations, project: projects })
      .from(integrations)
      .leftJoin(projects, eq(integrations.projectId, projects.id)),
    db.select({ doc: docs, owner: users }).from(docs).leftJoin(users, eq(docs.ownerId, users.id)),
    db.select().from(auditEvents),
    db
      .select({ rule: reminderRules, owner: users })
      .from(reminderRules)
      .leftJoin(users, eq(reminderRules.ownerId, users.id)),
    db
      .select({ log: reminderLogs, owner: users })
      .from(reminderLogs)
      .leftJoin(users, eq(reminderLogs.ownerId, users.id)),
    db
      .select({ ownerId: tasks.ownerId, total: count() })
      .from(tasks)
      .where(ne(tasks.status, "Done"))
      .groupBy(tasks.ownerId),
  ]);

  const pendingTaskCountByOwner = new Map(pendingTaskRows.map((row) => [row.ownerId, row.total]));

  response.json({
    users: userRows.map((user) => ({
      id: user.id,
      name: user.displayName,
      shortName: user.shortName,
      email: user.email,
      role: user.role,
      team: user.team,
      access: user.access,
      status: user.status,
    })),
    projects: projectRows.map(({ project, owner }) => ({
      id: project.id,
      name: project.name,
      area: project.area,
      stage: project.stage,
      owner: owner?.shortName ?? "Unassigned",
      risk: project.risk,
      workItems: project.workItems,
      progress: project.progress,
      targetDate: project.targetDate,
    })),
    tasks: taskRows.map(({ task, project, owner }) => ({
      id: task.id,
      title: task.title,
      project: project?.name ?? "Unassigned project",
      workstream: task.workstream,
      owner: owner?.shortName ?? "Unassigned",
      status: task.status,
      priority: task.priority,
      due: task.due,
      comments: task.comments,
      privateDetailsClear: task.privateDetailsClear,
    })),
    workBatches: batchRows.map(({ batch, project }) => ({
      id: batch.id,
      project: project?.name ?? "Unassigned project",
      team: batch.team,
      workType: batch.workType,
      items: batch.items,
      qualityScore: batch.qualityScore,
      reviewItems: batch.reviewItems,
      status: batch.status,
    })),
    integrations: integrationRows.map(({ integration, project }) => ({
      id: integration.id,
      project: project?.name ?? "Unassigned project",
      system: integration.system,
      method: integration.method,
      status: integration.status,
      mappingProgress: integration.mappingProgress,
      lastSync: integration.lastSync,
      openIssues: integration.openIssues,
    })),
    docs: docRows.map(({ doc, owner }) => ({
      id: doc.id,
      title: doc.title,
      area: doc.area,
      owner: owner?.shortName ?? "Unassigned",
      updated: doc.updatedLabel,
      status: doc.status,
    })),
    auditEvents: auditRows.map((event) => ({
      id: event.id,
      actor: event.actorName,
      action: event.action,
      area: event.area,
      time: event.timeLabel,
    })),
    reminderRules: reminderRuleRows.map(({ rule, owner }) => ({
      id: rule.id,
      owner: owner?.shortName ?? "Unassigned",
      ownerId: rule.ownerId,
      cadence: rule.cadence,
      channel: rule.channel,
      enabled: rule.enabled,
      nextRun: rule.nextRun,
      lastSent: rule.lastSent,
      pendingTasks: pendingTaskCountByOwner.get(rule.ownerId) ?? 0,
    })),
    reminderLogs: reminderLogRows.map(({ log, owner }) => ({
      id: log.id,
      owner: owner?.shortName ?? "Unassigned",
      ownerId: log.ownerId,
      cadence: log.cadence,
      channel: log.channel,
      taskCount: log.taskCount,
      sentAt: log.sentAt.toISOString(),
    })),
  });
});
