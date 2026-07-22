import { eq } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "../db/client";
import { reminderRules } from "../db/schema";
import {
  isOneOf,
  makeId,
  nextReminderRun,
  reminderCadenceValues,
  reminderChannelValues,
} from "../lib/domain";
import { recordAuditEvent } from "../services/audit";
import { findUserByIdOrShortName } from "../services/lookups";
import { sendReminderBatches } from "../services/reminder-delivery";

type UpdateReminderBody = {
  cadence?: unknown;
  channel?: unknown;
  enabled?: boolean;
};

export const remindersRouter = Router();

remindersRouter.patch("/reminders/:owner", async (request, response) => {
  const body = (request.body ?? {}) as UpdateReminderBody;
  const owner = await findUserByIdOrShortName(request.params.owner);

  if (!owner) {
    response.status(404).json({ error: "Reminder owner was not found." });
    return;
  }

  const db = getDb();
  const [existingRule] = await db
    .select()
    .from(reminderRules)
    .where(eq(reminderRules.ownerId, owner.id))
    .limit(1);

  const cadence = isOneOf(reminderCadenceValues, body.cadence)
    ? body.cadence
    : existingRule?.cadence ?? "Daily";
  const channel = isOneOf(reminderChannelValues, body.channel)
    ? body.channel
    : existingRule?.channel ?? "Email";
  const enabled = body.enabled ?? existingRule?.enabled ?? true;

  const values = {
    ownerId: owner.id,
    cadence,
    channel,
    enabled,
    nextRun: enabled ? nextReminderRun(cadence) : "Paused",
    updatedAt: new Date(),
  };

  const [rule] = existingRule
    ? await db
        .update(reminderRules)
        .set(values)
        .where(eq(reminderRules.id, existingRule.id))
        .returning()
    : await db
        .insert(reminderRules)
        .values({
          id: makeId("REM"),
          ...values,
          lastSent: "Not sent",
        })
        .returning();

  await recordAuditEvent({
    actorId: owner.id,
    actorName: owner.shortName,
    action: `updated reminder schedule for ${owner.shortName}`,
    area: "Project Ops",
  });

  response.json({ reminderRule: rule });
});

remindersRouter.post("/reminders/send", async (request, response) => {
  const body = (request.body ?? {}) as { owner?: string; actor?: string };
  const sent = await sendReminderBatches({
    owner: body.owner,
    actor: body.actor ?? "System",
  });

  response.json({ sent });
});
