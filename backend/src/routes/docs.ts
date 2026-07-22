import { Router } from "express";
import { getDb } from "../db/client";
import { docs } from "../db/schema";
import { docAreaValues, docStatusValues, isOneOf, makeId } from "../lib/domain";
import { recordAuditEvent } from "../services/audit";
import { findUserByIdOrShortName } from "../services/lookups";

type CreateDocBody = {
  id?: string;
  title?: string;
  area?: unknown;
  ownerId?: string;
  owner?: string;
  status?: unknown;
};

export const docsRouter = Router();

docsRouter.post("/docs", async (request, response) => {
  const body = request.body as CreateDocBody;
  const ownerLookup = body.ownerId ?? body.owner;

  if (!body.title?.trim() || !ownerLookup) {
    response.status(400).json({ error: "Document title and owner are required." });
    return;
  }

  if (!isOneOf(docAreaValues, body.area)) {
    response.status(400).json({ error: "A valid document area is required." });
    return;
  }

  const owner = await findUserByIdOrShortName(ownerLookup);

  if (!owner) {
    response.status(404).json({ error: "Document owner was not found." });
    return;
  }

  const status = isOneOf(docStatusValues, body.status) ? body.status : "Draft";
  const db = getDb();
  const [createdDoc] = await db
    .insert(docs)
    .values({
      id: body.id ?? makeId("DOC"),
      title: body.title.trim(),
      area: body.area,
      ownerId: owner.id,
      updatedLabel: "Today",
      status,
    })
    .returning();

  await recordAuditEvent({
    actorId: owner.id,
    actorName: owner.shortName,
    action: `created document ${createdDoc.title}`,
    area: "Docs",
  });

  response.status(201).json({ doc: createdDoc });
});
