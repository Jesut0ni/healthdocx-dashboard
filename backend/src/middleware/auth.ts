import type { NextFunction, Request, Response } from "express";
import type { AuthTokenPayload } from "../auth/token";
import { verifyAuthToken } from "../auth/token";

export type AuthenticatedRequest = Request & {
  auth?: AuthTokenPayload;
};

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    response.status(401).json({ error: "Login is required." });
    return;
  }

  try {
    (request as AuthenticatedRequest).auth = verifyAuthToken(token);
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid session.";
    response.status(401).json({ error: message });
  }
}
