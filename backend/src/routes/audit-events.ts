import { desc } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "../db/client";
import { auditEvents } from "../db/schema";

export const auditEventsRouter = Router();

auditEventsRouter.get("/audit-events", async (_request, response) => {
  const db = getDb();
  const events = await db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(50);

  response.json({
    auditEvents: events.map((event) => ({
      id: event.id,
      actor: event.actorName,
      action: event.action,
      area: event.area,
      time: event.timeLabel,
    })),
  });
});
