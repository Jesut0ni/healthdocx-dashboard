import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import type { AuthTokenPayload } from "../auth/token";
import { verifyAuthToken } from "../auth/token";
import { getDb } from "../db/client";
import { users } from "../db/schema";

export type AuthenticatedRequest = Request & {
  auth?: AuthTokenPayload;
};

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    response.status(401).json({ error: "Login is required." });
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);

    if (!user || user.status === "Suspended") {
      response.status(401).json({ error: "Login is required." });
      return;
    }

    (request as AuthenticatedRequest).auth = {
      ...payload,
      email: user.email,
      name: user.displayName,
      access: user.access,
    };
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid session.";
    response.status(401).json({ error: message });
  }
}
