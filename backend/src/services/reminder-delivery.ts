import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../db/client";
import { projects, reminderLogs, reminderRules, tasks, users } from "../db/schema";
import { nextReminderRun, makeId } from "../lib/domain";
import { recordAuditEvent } from "./audit";
import { sendReminderEmail } from "./email";
import { findUserByIdOrShortName } from "./lookups";

type ReminderSendResult = {
  id: string;
  owner: string;
  cadence: "Daily" | "Twice a day" | "Weekly";
  channel: "Email" | "Slack" | "Dashboard";
  taskCount: number;
  sentAt: string;
  deliveryStatus: "sent" | "not_configured" | "failed";
  deliveryDetail: string;
};

function getReminderTimezoneOffsetMinutes() {
  const configuredOffset = process.env.REMINDER_TIMEZONE_OFFSET_MINUTES;

  if (!configuredOffset) {
    return 60;
  }

  const offset = Number(configuredOffset);

  return Number.isFinite(offset) ? offset : 60;
}

function toReminderTimezone(date: Date) {
  return new Date(date.getTime() + getReminderTimezoneOffsetMinutes() * 60 * 1000);
}

function fromReminderTimezone(date: Date) {
  return new Date(date.getTime() - getReminderTimezoneOffsetMinutes() * 60 * 1000);
}

function scheduledWindowStart(cadence: string, now: Date) {
  const reminderNow = toReminderTimezone(now);
  const start = new Date(reminderNow);
  start.setSeconds(0, 0);

  if (cadence === "Daily") {
    start.setHours(9, 0, 0, 0);
    return reminderNow >= start ? fromReminderTimezone(start) : null;
  }

  if (cadence === "Twice a day") {
    start.setHours(reminderNow.getHours() >= 16 ? 16 : 9, 0, 0, 0);
    return reminderNow >= start ? fromReminderTimezone(start) : null;
  }

  if (cadence === "Weekly") {
    const day = start.getDay();
    const daysSinceMonday = (day + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
    start.setHours(9, 0, 0, 0);
    return reminderNow >= start ? fromReminderTimezone(start) : null;
  }

  return null;
}

async function shouldSendScheduledReminder(ownerId: string, cadence: string, now: Date) {
  const windowStart = scheduledWindowStart(cadence, now);

  if (!windowStart) {
    return false;
  }

  const db = getDb();
  const [latestLog] = await db
    .select({ sentAt: reminderLogs.sentAt })
    .from(reminderLogs)
    .where(eq(reminderLogs.ownerId, ownerId))
    .orderBy(desc(reminderLogs.sentAt))
    .limit(1);

  return !latestLog || latestLog.sentAt < windowStart;
}

export async function sendReminderBatches({
  owner,
  actor = "System",
  dueOnly = false,
  now = new Date(),
}: {
  owner?: string;
  actor?: string;
  dueOnly?: boolean;
  now?: Date;
}) {
  const db = getDb();
  const ownerFilter = owner ? await findUserByIdOrShortName(owner) : null;

  if (owner && !ownerFilter) {
    throw new Error("Reminder owner was not found.");
  }

  const ruleRows = ownerFilter
    ? await db
        .select({ rule: reminderRules, owner: users })
        .from(reminderRules)
        .leftJoin(users, eq(reminderRules.ownerId, users.id))
        .where(and(eq(reminderRules.enabled, true), eq(reminderRules.ownerId, ownerFilter.id)))
    : await db
        .select({ rule: reminderRules, owner: users })
        .from(reminderRules)
        .leftJoin(users, eq(reminderRules.ownerId, users.id))
        .where(eq(reminderRules.enabled, true));

  const sent: ReminderSendResult[] = [];

  for (const { rule, owner: ruleOwner } of ruleRows) {
    if (!ruleOwner) {
      continue;
    }

    if (dueOnly) {
      const isDue = await shouldSendScheduledReminder(rule.ownerId, rule.cadence, now);

      if (!isDue) {
        continue;
      }
    }

    const pendingTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        project: projects.name,
        due: tasks.due,
        priority: tasks.priority,
        status: tasks.status,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(eq(tasks.ownerId, rule.ownerId), ne(tasks.status, "Done")));

    if (pendingTasks.length === 0) {
      continue;
    }

    const delivery =
      rule.channel === "Email"
        ? await sendReminderEmail({
            to: ruleOwner.email,
            ownerName: ruleOwner.shortName,
            tasks: pendingTasks.map((task) => ({
              ...task,
              project: task.project ?? "Unassigned project",
            })),
          })
        : {
            status: "not_configured" as const,
            detail: `${rule.channel} delivery is not connected yet.`,
          };

    const [log] = await db
      .insert(reminderLogs)
      .values({
        id: makeId("RLOG"),
        ownerId: rule.ownerId,
        cadence: rule.cadence,
        channel: rule.channel,
        taskCount: pendingTasks.length,
      })
      .returning();

    await db
      .update(reminderRules)
      .set({
        lastSent: "Just now",
        nextRun: nextReminderRun(rule.cadence),
        updatedAt: new Date(),
      })
      .where(eq(reminderRules.id, rule.id));

    sent.push({
      id: log.id,
      owner: ruleOwner.shortName,
      cadence: log.cadence,
      channel: log.channel,
      taskCount: log.taskCount,
      sentAt: log.sentAt.toISOString(),
      deliveryStatus: delivery.status,
      deliveryDetail: delivery.detail,
    });
  }

  if (sent.length > 0) {
    await recordAuditEvent({
      actorName: actor,
      action: `sent ${sent.length} reminder batch${sent.length === 1 ? "" : "es"}`,
      area: "Project Ops",
    });

  }

  return sent;
}
