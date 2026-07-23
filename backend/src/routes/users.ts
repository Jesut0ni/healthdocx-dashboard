import { and, count, eq, ne } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "../db/client";
import { auditEvents, docs, projects, reminderLogs, reminderRules, tasks, users } from "../db/schema";
import {
  accessValues,
  firstName,
  isOneOf,
  makeId,
  nextReminderRun,
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

type DeleteUserBody = {
  actor?: string;
};

export const usersRouter = Router();

usersRouter.post("/users", async (request, response) => {
  const body = request.body as InviteUserBody;
  const displayName = body.displayName ?? body.name;
  const email = body.email?.trim().toLowerCase();

  if (!displayName?.trim() || !email || !body.role?.trim()) {
    response.status(400).json({ error: "Name, email, and role are required." });
    return;
  }

  if (!isOneOf(teamValues, body.team) || !isOneOf(accessValues, body.access)) {
    response.status(400).json({ error: "A valid team and access level are required." });
    return;
  }

  const db = getDb();
  const baseShortName = firstName(displayName);
  const [existingEmailUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existingEmailUser) {
    response.status(409).json({ error: "A user with this email already exists." });
    return;
  }

  const [existingUser] = await db.select().from(users).where(eq(users.shortName, baseShortName)).limit(1);
  const shortName = existingUser ? `${baseShortName}${Date.now().toString().slice(-3)}` : baseShortName;
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

  await db.insert(reminderRules).values({
    id: makeId("REM"),
    ownerId: createdUser.id,
    cadence: "Daily",
    channel: "Email",
    enabled: true,
    nextRun: nextReminderRun("Daily"),
    lastSent: "Not sent",
  });

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

usersRouter.delete("/users/:id", async (request, response) => {
  const body = (request.body ?? {}) as DeleteUserBody;
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, request.params.id)).limit(1);

  if (!user) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  if (user.access === "Owner" && user.status !== "Suspended") {
    const [ownerCount] = await db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.access, "Owner"), ne(users.status, "Suspended"), ne(users.id, user.id)));

    if ((ownerCount?.total ?? 0) === 0) {
      response.status(400).json({ error: "Add another active Owner before deleting this user." });
      return;
    }
  }

  const [ownedProjects, ownedTasks, ownedDocs] = await Promise.all([
    db.select({ total: count() }).from(projects).where(eq(projects.ownerId, user.id)),
    db.select({ total: count() }).from(tasks).where(eq(tasks.ownerId, user.id)),
    db.select({ total: count() }).from(docs).where(eq(docs.ownerId, user.id)),
  ]);
  const blockerCount =
    (ownedProjects[0]?.total ?? 0) + (ownedTasks[0]?.total ?? 0) + (ownedDocs[0]?.total ?? 0);

  if (blockerCount > 0) {
    response.status(409).json({
      error: "Reassign or remove this user's projects, tasks, and docs before deleting them.",
    });
    return;
  }

  await db.delete(reminderLogs).where(eq(reminderLogs.ownerId, user.id));
  await db.delete(reminderRules).where(eq(reminderRules.ownerId, user.id));
  await db.update(auditEvents).set({ actorId: null }).where(eq(auditEvents.actorId, user.id));
  await db.delete(users).where(eq(users.id, user.id));

  await recordAuditEvent({
    actorName: body.actor ?? "Dashboard",
    action: `deleted user ${user.displayName}`,
    area: "Access",
  });

  response.json({ deletedUserId: user.id });
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
