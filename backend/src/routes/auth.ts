import { count, eq } from "drizzle-orm";
import { Router } from "express";
import { createAuthToken } from "../auth/token";
import { getDb } from "../db/client";
import { reminderRules, users } from "../db/schema";
import {
  firstName,
  isOneOf,
  makeId,
  nextReminderRun,
  teamValues,
} from "../lib/domain";
import type { AuthenticatedRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

type BootstrapAdminBody = {
  displayName?: string;
  name?: string;
  email?: string;
  role?: string;
  team?: unknown;
  accessCode?: string;
};

type AccessCodeCheck =
  | { valid: true }
  | { valid: false; status: number; error: string };

function validateAccessCode(accessCode?: string): AccessCodeCheck {
  if (!process.env.APP_ACCESS_CODE) {
    return { valid: false, status: 503, error: "APP_ACCESS_CODE is not configured." };
  }

  if (!accessCode || accessCode !== process.env.APP_ACCESS_CODE) {
    return { valid: false, status: 401, error: "Invalid email or access code." };
  }

  return { valid: true };
}

authRouter.get("/bootstrap-status", async (_request, response) => {
  const db = getDb();
  const [result] = await db.select({ total: count() }).from(users);

  response.json({ hasUsers: (result?.total ?? 0) > 0 });
});

authRouter.post("/bootstrap-admin", async (request, response) => {
  const body = (request.body ?? {}) as BootstrapAdminBody;
  const accessCheck = validateAccessCode(body.accessCode?.trim());

  if (!accessCheck.valid) {
    response.status(accessCheck.status).json({ error: accessCheck.error });
    return;
  }

  const displayName = (body.displayName ?? body.name ?? "").trim();
  const email = body.email?.trim().toLowerCase();

  if (!displayName || !email || !body.role?.trim()) {
    response.status(400).json({ error: "Name, email, and role are required." });
    return;
  }

  const db = getDb();
  const [result] = await db.select({ total: count() }).from(users);

  if ((result?.total ?? 0) > 0) {
    response.status(409).json({ error: "The first admin already exists. Sign in instead." });
    return;
  }

  const shortName = firstName(displayName);
  const [user] = await db
    .insert(users)
    .values({
      id: makeId("USR"),
      displayName,
      shortName,
      email,
      role: body.role.trim(),
      team: isOneOf(teamValues, body.team) ? body.team : "Operations",
      access: "Owner",
      status: "Active",
    })
    .returning();

  await db.insert(reminderRules).values({
    id: makeId("REM"),
    ownerId: user.id,
    cadence: "Daily",
    channel: "Email",
    enabled: true,
    nextRun: nextReminderRun("Daily"),
    lastSent: "Not sent",
  });

  const token = createAuthToken({
    sub: user.id,
    email: user.email,
    name: user.displayName,
    access: user.access,
  });

  response.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.displayName,
      email: user.email,
      access: user.access,
      role: user.role,
    },
  });
});

authRouter.post("/login", async (request, response) => {
  const body = request.body as { email?: string; accessCode?: string };
  const email = body.email?.trim().toLowerCase();
  const accessCode = body.accessCode?.trim();

  if (!email || !accessCode) {
    response.status(400).json({ error: "Email and access code are required." });
    return;
  }

  const accessCheck = validateAccessCode(accessCode);
  if (!accessCheck.valid) {
    response.status(accessCheck.status).json({ error: accessCheck.error });
    return;
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || user.status === "Suspended") {
    response.status(401).json({ error: "Invalid email or access code." });
    return;
  }

  const token = createAuthToken({
    sub: user.id,
    email: user.email,
    name: user.displayName,
    access: user.access,
  });

  response.json({
    token,
    user: {
      id: user.id,
      name: user.displayName,
      email: user.email,
      access: user.access,
      role: user.role,
    },
  });
});

authRouter.get("/me", requireAuth, (request, response) => {
  response.json({
    user: (request as AuthenticatedRequest).auth,
  });
});
