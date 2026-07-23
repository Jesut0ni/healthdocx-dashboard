import { asc, count, eq, ne } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "../db/client";
import {
  auditEvents,
  docs,
  integrations,
  projectComments,
  projectMembers,
  projects,
  reminderLogs,
  reminderRules,
  taskAssignees,
  taskComments,
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
    projectMemberRows,
    taskAssigneeRows,
    projectCommentRows,
    taskCommentRows,
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
    db
      .select({ member: projectMembers, user: users })
      .from(projectMembers)
      .leftJoin(users, eq(projectMembers.userId, users.id)),
    db
      .select({ assignee: taskAssignees, user: users })
      .from(taskAssignees)
      .leftJoin(users, eq(taskAssignees.userId, users.id)),
    db.select().from(projectComments).orderBy(asc(projectComments.createdAt)),
    db.select().from(taskComments).orderBy(asc(taskComments.createdAt)),
  ]);

  const pendingTaskCountByOwner = new Map(pendingTaskRows.map((row) => [row.ownerId, row.total]));
  const projectMembersByProjectId = new Map<string, string[]>();
  const taskAssigneesByTaskId = new Map<string, string[]>();
  const projectCommentsByProjectId = new Map<
    string,
    Array<{ id: string; author: string; body: string; createdAt: string }>
  >();
  const taskCommentsByTaskId = new Map<
    string,
    Array<{ id: string; author: string; body: string; createdAt: string }>
  >();

  for (const { member, user } of projectMemberRows) {
    if (!user) {
      continue;
    }

    const currentMembers = projectMembersByProjectId.get(member.projectId) ?? [];
    currentMembers.push(user.shortName);
    projectMembersByProjectId.set(member.projectId, currentMembers);
  }

  for (const { assignee, user } of taskAssigneeRows) {
    if (!user) {
      continue;
    }

    const currentAssignees = taskAssigneesByTaskId.get(assignee.taskId) ?? [];
    currentAssignees.push(user.shortName);
    taskAssigneesByTaskId.set(assignee.taskId, currentAssignees);
  }

  for (const comment of projectCommentRows) {
    const currentComments = projectCommentsByProjectId.get(comment.projectId) ?? [];
    currentComments.push({
      id: comment.id,
      author: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    });
    projectCommentsByProjectId.set(comment.projectId, currentComments);
  }

  for (const comment of taskCommentRows) {
    const currentComments = taskCommentsByTaskId.get(comment.taskId) ?? [];
    currentComments.push({
      id: comment.id,
      author: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    });
    taskCommentsByTaskId.set(comment.taskId, currentComments);
  }

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
      members: projectMembersByProjectId.get(project.id) ?? [],
      risk: project.risk,
      workItems: project.workItems,
      progress: project.progress,
      targetDate: project.targetDate,
      comments: projectCommentsByProjectId.get(project.id)?.length ?? 0,
      commentItems: projectCommentsByProjectId.get(project.id) ?? [],
    })),
    tasks: taskRows.map(({ task, project, owner }) => ({
      id: task.id,
      title: task.title,
      project: project?.name ?? "Unassigned project",
      workstream: task.workstream,
      owner: owner?.shortName ?? "Unassigned",
      assignees: taskAssigneesByTaskId.get(task.id) ?? [],
      status: task.status,
      priority: task.priority,
      due: task.due,
      comments: Math.max(task.comments, taskCommentsByTaskId.get(task.id)?.length ?? 0),
      commentItems: taskCommentsByTaskId.get(task.id) ?? [],
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
