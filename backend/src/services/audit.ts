import { getDb } from "../db/client";
import { auditEvents } from "../db/schema";
import { makeId } from "../lib/domain";

type AuditArea = "Access" | "Project Ops" | "Integrations" | "Docs" | "Projects";

export async function recordAuditEvent({
  actorId,
  actorName = "System",
  action,
  area,
}: {
  actorId?: string;
  actorName?: string;
  action: string;
  area: AuditArea;
}) {
  const db = getDb();
  await db.insert(auditEvents).values({
    id: makeId("AUD"),
    actorId,
    actorName,
    action,
    area,
    timeLabel: "Just now",
  });
}
