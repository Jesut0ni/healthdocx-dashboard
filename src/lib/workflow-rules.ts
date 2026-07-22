import type { Task, TaskStatus } from "./healthdocx-data";

export type ReminderCadence = "Daily" | "Twice a day" | "Weekly";
export type TaskDueState = "Overdue" | "Due today" | "Upcoming" | "Done";
export type WorkflowValidation = {
  valid: boolean;
  message?: string;
};

export const statusTransitionRules: Record<TaskStatus, TaskStatus[]> = {
  Backlog: ["In progress", "Blocked"],
  "In progress": ["Backlog", "Review", "Blocked"],
  "Review": ["In progress", "Blocked", "Done"],
  Blocked: ["Backlog", "In progress"],
  Done: ["In progress"],
};

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseTaskDueDate(value: string, referenceDate = new Date()) {
  const cleaned = value.trim();
  const lowered = cleaned.toLowerCase();
  const today = dayStart(referenceDate);

  if (!cleaned) {
    return null;
  }

  if (lowered === "today") {
    return today;
  }

  if (lowered === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow;
  }

  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const monthDayMatch = cleaned.match(
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})$/i,
  );
  if (!monthDayMatch) {
    return null;
  }

  const monthIndex = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ].indexOf(monthDayMatch[1].slice(0, 3).toLowerCase());
  const parsed = new Date(referenceDate.getFullYear(), monthIndex, Number(monthDayMatch[2]));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTaskDueState(task: Task, referenceDate = new Date()): TaskDueState {
  if (task.status === "Done") {
    return "Done";
  }

  const dueDate = parseTaskDueDate(task.due, referenceDate);
  const today = dayStart(referenceDate);

  if (!dueDate) {
    return "Upcoming";
  }

  if (dueDate.getTime() < today.getTime()) {
    return "Overdue";
  }

  if (dueDate.getTime() === today.getTime()) {
    return "Due today";
  }

  return "Upcoming";
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

export function validateTaskInput({
  title,
  due,
  privateDetailsClear,
}: {
  title: string;
  due: string;
  privateDetailsClear: boolean;
}): WorkflowValidation {
  if (!title.trim()) {
    return { valid: false, message: "Add a clear task title before saving." };
  }

  if (hasPrivateDetailsRisk(title)) {
    return {
      valid: false,
      message: "Remove private details from the task title before saving.",
    };
  }

  if (!parseTaskDueDate(due)) {
    return {
      valid: false,
      message: "Use a due date like Today, Tomorrow, Jul 30, or 2026-07-30.",
    };
  }

  if (!privateDetailsClear) {
    return {
      valid: false,
      message: "Confirm the task text does not contain private details before saving.",
    };
  }

  return { valid: true };
}

export function validateTaskStatusChange(task: Task, status: TaskStatus): WorkflowValidation {
  if (task.status === status) {
    return { valid: true };
  }

  if (!statusTransitionRules[task.status].includes(status)) {
    return {
      valid: false,
      message: `${task.id} must move through the approved workflow before ${status}.`,
    };
  }

  if ((!task.privateDetailsClear || hasPrivateDetailsRisk(task.title)) && (status === "Review" || status === "Done")) {
    return {
      valid: false,
      message: `${task.id} needs private details cleanup before review or completion.`,
    };
  }

  return { valid: true };
}

export function getAllowedTaskStatuses(task: Task) {
  return new Set<TaskStatus>([
    task.status,
    ...statusTransitionRules[task.status].filter((status) => validateTaskStatusChange(task, status).valid),
  ]);
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
