import type { TaskStatus } from "../../../src/lib/healthdocx-data";

export type ReminderCadence = "Daily" | "Twice a day" | "Weekly";
export type ReminderChannel = "Email" | "Slack" | "Dashboard";

export const taskStatusValues = ["Backlog", "In progress", "Review", "Blocked", "Done"] as const;
export const priorityValues = ["Critical", "High", "Medium", "Low"] as const;
export const workstreamValues = [
  "Project Ops",
  "Integrations",
  "Security",
  "Implementation",
  "Customer Success",
] as const;
export const projectStageValues = [
  "Discovery",
  "Planning",
  "Build",
  "Review",
  "Launch ready",
  "Live",
] as const;
export const riskValues = ["Healthy", "Watch", "Blocked"] as const;
export const reminderCadenceValues = ["Daily", "Twice a day", "Weekly"] as const;
export const reminderChannelValues = ["Email", "Slack", "Dashboard"] as const;
export const batchStatusValues = ["Queued", "In progress", "Review", "Ready"] as const;
export const integrationMethodValues = ["API", "Webhook", "CSV bridge", "Manual update"] as const;
export const integrationStatusValues = [
  "Connected",
  "Mapping",
  "Needs credentials",
  "Sync warning",
] as const;
export const docAreaValues = ["Runbook", "Security", "Implementation", "API", "Training"] as const;
export const docStatusValues = ["Published", "Draft", "Needs review"] as const;
export const teamValues = [
  "Engineering",
  "Operations",
  "Product",
  "Security",
  "Customer Success",
] as const;
export const accessValues = ["Owner", "Admin", "Reviewer", "Editor", "Viewer"] as const;
export const userStatusValues = ["Active", "Invited", "Suspended"] as const;

export const taskStatusTransitionRules: Record<TaskStatus, TaskStatus[]> = {
  Backlog: ["In progress", "Blocked"],
  "In progress": ["Backlog", "Review", "Blocked"],
  Review: ["In progress", "Blocked", "Done"],
  Blocked: ["Backlog", "In progress"],
  Done: ["In progress"],
};

export function isOneOf<const T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function hasPrivateDetailsRisk(value: string) {
  const privateDetailPatterns = [
    /\bpassword\b/i,
    /\bapi\s*key\b/i,
    /\btoken\b/i,
    /\bsecret\b/i,
    /\b\d{3}[-.\s]\d{2}[-.\s]\d{4}\b/,
    /\b\d{10,}\b/,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  ];

  return privateDetailPatterns.some((pattern) => pattern.test(value));
}

export function validateTaskStatusChange(
  currentStatus: TaskStatus,
  nextStatus: TaskStatus,
  privateDetailsClear: boolean,
  title: string,
) {
  if (currentStatus === nextStatus) {
    return { valid: true };
  }

  if (!taskStatusTransitionRules[currentStatus].includes(nextStatus)) {
    return {
      valid: false,
      message: `Task must move through the approved workflow before ${nextStatus}.`,
    };
  }

  if ((!privateDetailsClear || hasPrivateDetailsRisk(title)) && (nextStatus === "Review" || nextStatus === "Done")) {
    return {
      valid: false,
      message: "Clean private details before moving this task into Review or Done.",
    };
  }

  return { valid: true };
}

export function nextReminderRun(cadence: ReminderCadence) {
  if (cadence === "Weekly") {
    return "Next Monday 09:00";
  }

  if (cadence === "Twice a day") {
    return "Today 16:00";
  }

  return "Tomorrow 09:00";
}

export function makeId(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

export function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value.trim();
}
