import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "../db/client";
import { taskAssignees, taskComments, tasks } from "../db/schema";
import {
  hasPrivateDetailsRisk,
  isOneOf,
  makeId,
  priorityValues,
  taskStatusValues,
  validateTaskStatusChange,
  workstreamValues,
} from "../lib/domain";
import { recordAuditEvent } from "../services/audit";
import { findProjectByIdOrName, findUserByIdOrShortName } from "../services/lookups";

type CreateTaskBody = {
  id?: string;
  title?: string;
  projectId?: string;
  project?: string;
  workstream?: unknown;
  ownerId?: string;
  owner?: string;
  status?: unknown;
  priority?: unknown;
  due?: string;
  comments?: number;
  assignees?: unknown;
  privateDetailsClear?: boolean;
};

type UpdateTaskAssigneesBody = {
  assignees?: unknown;
  actor?: string;
};

type CreateTaskCommentBody = {
  body?: string;
  comment?: string;
  author?: string;
  authorId?: string;
};

type LookupUser = NonNullable<Awaited<ReturnType<typeof findUserByIdOrShortName>>>;

export const tasksRouter = Router();

function normalizedStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

async function resolveUserList(value: unknown, excludedUserId?: string): Promise<LookupUser[]> {
  const resolvedUsers = await Promise.all(
    normalizedStringList(value).map((lookup) => findUserByIdOrShortName(lookup)),
  );
  const usersById = new Map<string, LookupUser>();

  for (const user of resolvedUsers) {
    if (user && user.id !== excludedUserId) {
      usersById.set(user.id, user);
    }
  }

  return Array.from(usersById.values());
}

tasksRouter.post("/tasks", async (request, response) => {
  const body = request.body as CreateTaskBody;

  if (!body.title?.trim()) {
    response.status(400).json({ error: "Task title is required." });
    return;
  }

  if (hasPrivateDetailsRisk(body.title)) {
    response.status(400).json({ error: "Remove private details from the task title before saving." });
    return;
  }

  const projectLookup = body.projectId ?? body.project;
  const ownerLookup = body.ownerId ?? body.owner;

  if (!projectLookup || !ownerLookup) {
    response.status(400).json({ error: "Task project and owner are required." });
    return;
  }

  const [project, owner] = await Promise.all([
    findProjectByIdOrName(projectLookup),
    findUserByIdOrShortName(ownerLookup),
  ]);

  if (!project || !owner) {
    response.status(404).json({ error: "Task project or owner was not found." });
    return;
  }

  if (!isOneOf(workstreamValues, body.workstream)) {
    response.status(400).json({ error: "A valid workstream is required." });
    return;
  }

  const status = isOneOf(taskStatusValues, body.status) ? body.status : "Backlog";
  const priority = isOneOf(priorityValues, body.priority) ? body.priority : "Medium";
  const privateDetailsClear = body.privateDetailsClear ?? true;

  if (!privateDetailsClear) {
    response.status(400).json({ error: "Confirm the task text is clear of private details before saving." });
    return;
  }

  const db = getDb();
  const assignees = await resolveUserList(body.assignees, owner.id);
  const [createdTask] = await db
    .insert(tasks)
    .values({
      id: body.id ?? makeId("HDX"),
      title: body.title.trim(),
      projectId: project.id,
      workstream: body.workstream,
      ownerId: owner.id,
      status,
      priority,
      due: body.due?.trim() || "Today",
      comments: body.comments ?? 0,
      privateDetailsClear,
    })
    .returning();

  if (assignees.length > 0) {
    await db.insert(taskAssignees).values(
      assignees.map((assignee) => ({
        id: makeId("TAS"),
        taskId: createdTask.id,
        userId: assignee.id,
      })),
    );
  }

  await recordAuditEvent({
    actorId: owner.id,
    actorName: owner.shortName,
    action: `created task ${createdTask.id}`,
    area: "Project Ops",
  });

  response.status(201).json({ task: createdTask });
});

tasksRouter.patch("/tasks/:id/status", async (request, response) => {
  const body = request.body as { status?: unknown; actor?: string };

  if (!isOneOf(taskStatusValues, body.status)) {
    response.status(400).json({ error: "A valid task status is required." });
    return;
  }

  const db = getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, request.params.id)).limit(1);

  if (!task) {
    response.status(404).json({ error: "Task was not found." });
    return;
  }

  const validation = validateTaskStatusChange(task.status, body.status, task.privateDetailsClear, task.title);

  if (!validation.valid) {
    response.status(409).json({ error: validation.message });
    return;
  }

  const [updatedTask] = await db
    .update(tasks)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(tasks.id, task.id))
    .returning();

  await recordAuditEvent({
    actorName: body.actor ?? "System",
    action: `moved ${task.id} to ${body.status}`,
    area: "Project Ops",
  });

  response.json({ task: updatedTask });
});

tasksRouter.patch("/tasks/:id/assignees", async (request, response) => {
  const body = request.body as UpdateTaskAssigneesBody;

  if (!Array.isArray(body.assignees)) {
    response.status(400).json({ error: "Task assignees must be a list." });
    return;
  }

  const db = getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, request.params.id)).limit(1);

  if (!task) {
    response.status(404).json({ error: "Task was not found." });
    return;
  }

  const assignees = await resolveUserList(body.assignees, task.ownerId);

  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, task.id));

  if (assignees.length > 0) {
    await db.insert(taskAssignees).values(
      assignees.map((assignee) => ({
        id: makeId("TAS"),
        taskId: task.id,
        userId: assignee.id,
      })),
    );
  }

  await recordAuditEvent({
    actorName: body.actor ?? "Dashboard",
    action: `updated collaborators for ${task.id}`,
    area: "Project Ops",
  });

  response.json({ assignees: assignees.map((assignee) => assignee.shortName) });
});

tasksRouter.post("/tasks/:id/comments", async (request, response) => {
  const body = request.body as CreateTaskCommentBody;
  const commentBody = (body.body ?? body.comment ?? "").trim();

  if (!commentBody) {
    response.status(400).json({ error: "Comment text is required." });
    return;
  }

  const db = getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, request.params.id)).limit(1);

  if (!task) {
    response.status(404).json({ error: "Task was not found." });
    return;
  }

  const authorLookup = body.authorId ?? body.author;
  const author = authorLookup ? await findUserByIdOrShortName(authorLookup) : undefined;
  const authorName = author?.shortName ?? (body.author?.trim() || "Dashboard");
  const [comment] = await db
    .insert(taskComments)
    .values({
      id: makeId("TCM"),
      taskId: task.id,
      authorId: author?.id,
      authorName,
      body: commentBody,
    })
    .returning();

  await db.update(tasks).set({ comments: task.comments + 1, updatedAt: new Date() }).where(eq(tasks.id, task.id));
  await recordAuditEvent({
    actorId: author?.id,
    actorName: authorName,
    action: `commented on ${task.id}`,
    area: "Project Ops",
  });

  response.status(201).json({
    comment: {
      id: comment.id,
      author: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    },
  });
});

tasksRouter.patch("/tasks/:id/owner", async (request, response) => {
  const body = request.body as { ownerId?: string; owner?: string; actor?: string };
  const ownerLookup = body.ownerId ?? body.owner;

  if (!ownerLookup) {
    response.status(400).json({ error: "A task owner is required." });
    return;
  }

  const owner = await findUserByIdOrShortName(ownerLookup);

  if (!owner) {
    response.status(404).json({ error: "Owner was not found." });
    return;
  }

  const db = getDb();
  const [updatedTask] = await db
    .update(tasks)
    .set({ ownerId: owner.id, updatedAt: new Date() })
    .where(eq(tasks.id, request.params.id))
    .returning();

  if (!updatedTask) {
    response.status(404).json({ error: "Task was not found." });
    return;
  }

  await db
    .delete(taskAssignees)
    .where(and(eq(taskAssignees.taskId, updatedTask.id), eq(taskAssignees.userId, owner.id)));

  await recordAuditEvent({
    actorName: body.actor ?? "System",
    action: `assigned ${updatedTask.id} to ${owner.shortName}`,
    area: "Project Ops",
  });

  response.json({ task: updatedTask });
});
