import { eq } from "drizzle-orm";
import { Router } from "express";
import { createAuthToken } from "../auth/token";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import type { AuthenticatedRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", async (request, response) => {
  const body = request.body as { email?: string; accessCode?: string };
  const email = body.email?.trim().toLowerCase();
  const accessCode = body.accessCode?.trim();

  if (!email || !accessCode) {
    response.status(400).json({ error: "Email and access code are required." });
    return;
  }

  if (!process.env.APP_ACCESS_CODE) {
    response.status(503).json({ error: "APP_ACCESS_CODE is not configured." });
    return;
  }

  if (accessCode !== process.env.APP_ACCESS_CODE) {
    response.status(401).json({ error: "Invalid email or access code." });
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
