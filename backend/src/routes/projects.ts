import { Router } from "express";
import { getDb } from "../db/client";
import { projects } from "../db/schema";
import { isOneOf, makeId, projectStageValues, riskValues } from "../lib/domain";
import { recordAuditEvent } from "../services/audit";
import { findUserByIdOrShortName } from "../services/lookups";

type CreateProjectBody = {
  id?: string;
  name?: string;
  area?: string;
  stage?: unknown;
  ownerId?: string;
  owner?: string;
  risk?: unknown;
  workItems?: number;
  progress?: number;
  targetDate?: string;
};

export const projectsRouter = Router();

projectsRouter.post("/projects", async (request, response) => {
  const body = request.body as CreateProjectBody;

  if (!body.name?.trim() || !body.area?.trim() || !body.targetDate?.trim()) {
    response.status(400).json({ error: "Project name, area, and target date are required." });
    return;
  }

  const ownerLookup = body.ownerId ?? body.owner;

  if (!ownerLookup) {
    response.status(400).json({ error: "Project owner is required." });
    return;
  }

  const owner = await findUserByIdOrShortName(ownerLookup);

  if (!owner) {
    response.status(404).json({ error: "Project owner was not found." });
    return;
  }

  const stage = isOneOf(projectStageValues, body.stage) ? body.stage : "Discovery";
  const risk = isOneOf(riskValues, body.risk) ? body.risk : "Healthy";
  const db = getDb();
  const [createdProject] = await db
    .insert(projects)
    .values({
      id: body.id ?? makeId("PRJ"),
      name: body.name.trim(),
      area: body.area.trim(),
      stage,
      ownerId: owner.id,
      risk,
      workItems: body.workItems ?? 0,
      progress: body.progress ?? 0,
      targetDate: body.targetDate.trim(),
    })
    .returning();

  await recordAuditEvent({
    actorId: owner.id,
    actorName: owner.shortName,
    action: `created project ${createdProject.name}`,
    area: "Projects",
  });

  response.status(201).json({ project: createdProject });
});
