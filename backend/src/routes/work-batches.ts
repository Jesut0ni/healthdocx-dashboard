import { Router } from "express";
import { getDb } from "../db/client";
import { workBatches } from "../db/schema";
import { batchStatusValues, isOneOf, makeId } from "../lib/domain";
import { recordAuditEvent } from "../services/audit";
import { findProjectByIdOrName } from "../services/lookups";

type CreateWorkBatchBody = {
  id?: string;
  projectId?: string;
  project?: string;
  team?: string;
  workType?: string;
  items?: number;
  status?: unknown;
};

export const workBatchesRouter = Router();

workBatchesRouter.post("/work-batches", async (request, response) => {
  const body = request.body as CreateWorkBatchBody;
  const projectLookup = body.projectId ?? body.project;

  if (!projectLookup || !body.team?.trim() || !body.workType?.trim()) {
    response.status(400).json({ error: "Project, team, and work type are required." });
    return;
  }

  const project = await findProjectByIdOrName(projectLookup);

  if (!project) {
    response.status(404).json({ error: "Project was not found." });
    return;
  }

  const status = isOneOf(batchStatusValues, body.status) ? body.status : "Queued";
  const db = getDb();
  const [createdBatch] = await db
    .insert(workBatches)
    .values({
      id: body.id ?? makeId("BAT"),
      projectId: project.id,
      team: body.team.trim(),
      workType: body.workType.trim(),
      items: body.items ?? 0,
      qualityScore: 0,
      reviewItems: 0,
      status,
    })
    .returning();

  await recordAuditEvent({
    action: `created batch ${createdBatch.id} for ${project.name}`,
    area: "Project Ops",
  });

  response.status(201).json({ workBatch: createdBatch });
});
