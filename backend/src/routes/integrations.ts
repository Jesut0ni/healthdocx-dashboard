import { Router } from "express";
import { getDb } from "../db/client";
import { integrations } from "../db/schema";
import {
  integrationMethodValues,
  integrationStatusValues,
  isOneOf,
  makeId,
} from "../lib/domain";
import { recordAuditEvent } from "../services/audit";
import { findProjectByIdOrName } from "../services/lookups";

type CreateIntegrationBody = {
  id?: string;
  projectId?: string;
  project?: string;
  system?: string;
  method?: unknown;
  status?: unknown;
};

export const integrationsRouter = Router();

integrationsRouter.post("/integrations", async (request, response) => {
  const body = request.body as CreateIntegrationBody;
  const projectLookup = body.projectId ?? body.project;

  if (!projectLookup || !body.system?.trim()) {
    response.status(400).json({ error: "Project and system are required." });
    return;
  }

  if (!isOneOf(integrationMethodValues, body.method)) {
    response.status(400).json({ error: "A valid integration method is required." });
    return;
  }

  const project = await findProjectByIdOrName(projectLookup);

  if (!project) {
    response.status(404).json({ error: "Project was not found." });
    return;
  }

  const status = isOneOf(integrationStatusValues, body.status) ? body.status : "Mapping";
  const db = getDb();
  const [createdIntegration] = await db
    .insert(integrations)
    .values({
      id: body.id ?? makeId("INT"),
      projectId: project.id,
      system: body.system.trim(),
      method: body.method,
      status,
      mappingProgress: status === "Connected" ? 100 : 10,
      lastSync: status === "Connected" ? "Just now" : "Pending",
      openIssues: status === "Connected" ? 0 : 1,
    })
    .returning();

  await recordAuditEvent({
    action: `created ${createdIntegration.system} integration for ${project.name}`,
    area: "Integrations",
  });

  response.status(201).json({ integration: createdIntegration });
});
