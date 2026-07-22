import { eq } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "../db/client";
import { tasks } from "../db/schema";
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
  privateDetailsClear?: boolean;
};

export const tasksRouter = Router();

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

  await recordAuditEvent({
    actorName: body.actor ?? "System",
    action: `assigned ${updatedTask.id} to ${owner.shortName}`,
    area: "Project Ops",
  });

  response.json({ task: updatedTask });
});
