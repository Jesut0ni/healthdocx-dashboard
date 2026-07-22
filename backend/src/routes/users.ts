import { eq } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import {
  accessValues,
  firstName,
  isOneOf,
  makeId,
  teamValues,
  userStatusValues,
} from "../lib/domain";
import { recordAuditEvent } from "../services/audit";

type InviteUserBody = {
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
  role?: string;
  team?: unknown;
  access?: unknown;
};

export const usersRouter = Router();

usersRouter.post("/users", async (request, response) => {
  const body = request.body as InviteUserBody;
  const displayName = body.displayName ?? body.name;

  if (!displayName?.trim() || !body.role?.trim()) {
    response.status(400).json({ error: "Name and role are required." });
    return;
  }

  if (!isOneOf(teamValues, body.team) || !isOneOf(accessValues, body.access)) {
    response.status(400).json({ error: "A valid team and access level are required." });
    return;
  }

  const db = getDb();
  const baseShortName = firstName(displayName);
  const [existingUser] = await db.select().from(users).where(eq(users.shortName, baseShortName)).limit(1);
  const shortName = existingUser ? `${baseShortName}${Date.now().toString().slice(-3)}` : baseShortName;
  const email = body.email?.trim() || `${shortName.toLowerCase()}@healthdocx.org`;
  const [createdUser] = await db
    .insert(users)
    .values({
      id: body.id ?? makeId("USR"),
      displayName: displayName.trim(),
      shortName,
      email,
      role: body.role.trim(),
      team: body.team,
      access: body.access,
      status: "Invited",
    })
    .returning();

  await recordAuditEvent({
    actorId: createdUser.id,
    actorName: createdUser.shortName,
    action: `invited ${createdUser.displayName} as ${createdUser.access}`,
    area: "Access",
  });

  response.status(201).json({ user: createdUser });
});

usersRouter.patch("/users/:id/access", async (request, response) => {
  const body = request.body as { access?: unknown; actor?: string };

  if (!isOneOf(accessValues, body.access)) {
    response.status(400).json({ error: "A valid access level is required." });
    return;
  }

  const db = getDb();
  const [updatedUser] = await db
    .update(users)
    .set({ access: body.access, updatedAt: new Date() })
    .where(eq(users.id, request.params.id))
    .returning();

  if (!updatedUser) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  await recordAuditEvent({
    actorName: body.actor ?? "System",
    action: `changed ${updatedUser.displayName}'s access to ${updatedUser.access}`,
    area: "Access",
  });

  response.json({ user: updatedUser });
});

usersRouter.patch("/users/:id/status", async (request, response) => {
  const body = request.body as { status?: unknown; actor?: string };

  if (!isOneOf(userStatusValues, body.status)) {
    response.status(400).json({ error: "A valid user status is required." });
    return;
  }

  const db = getDb();
  const [updatedUser] = await db
    .update(users)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(users.id, request.params.id))
    .returning();

  if (!updatedUser) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  await recordAuditEvent({
    actorName: body.actor ?? "System",
    action: `changed ${updatedUser.displayName}'s status to ${updatedUser.status}`,
    area: "Access",
  });

  response.json({ user: updatedUser });
});
