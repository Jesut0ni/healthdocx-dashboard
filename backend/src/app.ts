import cors from "cors";
import dotenv from "dotenv";
import express, { type ErrorRequestHandler, type Express } from "express";
import { auditEventsRouter } from "./routes/audit-events";
import { authRouter } from "./routes/auth";
import { cronRouter } from "./routes/cron";
import { dashboardRouter } from "./routes/dashboard";
import { docsRouter } from "./routes/docs";
import { integrationsRouter } from "./routes/integrations";
import { projectsRouter } from "./routes/projects";
import { remindersRouter } from "./routes/reminders";
import { tasksRouter } from "./routes/tasks";
import { usersRouter } from "./routes/users";
import { workBatchesRouter } from "./routes/work-batches";
import { requireAuth } from "./middleware/auth";

dotenv.config({ path: "backend/.env" });

function getAllowedOrigins() {
  const configuredOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

  return new Set([...configuredOrigins, vercelOrigin].filter(Boolean));
}

function configureCors(app: Express) {
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (getAllowedOrigins().has(origin)) {
          callback(null, true);
          return;
        }

        if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
    }),
  );
}

function mountDashboardApi(app: Express, prefix: string) {
  app.use(`${prefix}/auth`, authRouter);
  app.use(prefix, cronRouter);
  app.use(prefix, requireAuth);
  app.use(prefix, dashboardRouter);
  app.use(prefix, tasksRouter);
  app.use(prefix, projectsRouter);
  app.use(prefix, workBatchesRouter);
  app.use(prefix, integrationsRouter);
  app.use(prefix, docsRouter);
  app.use(prefix, usersRouter);
  app.use(prefix, remindersRouter);
  app.use(prefix, auditEventsRouter);
}

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;
  const message = error instanceof Error ? error.message : "Unexpected backend error.";
  const status = message.includes("DATABASE_URL") ? 503 : 500;

  response.status(status).json({ error: message });
};

export function createBackendApp() {
  const app = express();

  configureCors(app);
  app.use(express.json());

  const healthHandler = (_request: express.Request, response: express.Response) => {
    response.json({
      status: "ok",
      service: "healthdocx-dashboard-api",
    });
  };

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);
  mountDashboardApi(app, "/api");
  mountDashboardApi(app, "");
  app.use(errorHandler);

  return app;
}
