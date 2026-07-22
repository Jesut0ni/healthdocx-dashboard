import { describe, expect, it } from "vitest";
import type { Task } from "./healthdocx-data";
import {
  getAllowedTaskStatuses,
  getTaskDueState,
  hasPrivateDetailsRisk,
  nextReminderRun,
  parseTaskDueDate,
  validateTaskInput,
  validateTaskStatusChange,
} from "./workflow-rules";

const referenceDate = new Date(2026, 6, 15);

function expectLocalDate(value: Date | null, year: number, monthIndex: number, day: number) {
  expect(value).not.toBeNull();
  expect(value?.getFullYear()).toBe(year);
  expect(value?.getMonth()).toBe(monthIndex);
  expect(value?.getDate()).toBe(day);
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "HDX-TEST",
    title: "Validate encrypted storage retention settings",
    project: "Team access setup",
    workstream: "Security",
    owner: "Ife",
    status: "Backlog",
    priority: "High",
    due: "Jul 16",
    comments: 0,
    privateDetailsClear: true,
    ...overrides,
  };
}

describe("workflow rules", () => {
  it("parses supported due date formats", () => {
    expectLocalDate(parseTaskDueDate("Today", referenceDate), 2026, 6, 15);
    expectLocalDate(parseTaskDueDate("Tomorrow", referenceDate), 2026, 6, 16);
    expectLocalDate(parseTaskDueDate("Jul 30", referenceDate), 2026, 6, 30);
    expectLocalDate(parseTaskDueDate("2026-08-01", referenceDate), 2026, 7, 1);
    expect(parseTaskDueDate("next month", referenceDate)).toBeNull();
  });

  it("classifies task due states", () => {
    expect(getTaskDueState(task({ due: "Jul 14" }), referenceDate)).toBe("Overdue");
    expect(getTaskDueState(task({ due: "Jul 15" }), referenceDate)).toBe("Due today");
    expect(getTaskDueState(task({ due: "Jul 16" }), referenceDate)).toBe("Upcoming");
    expect(getTaskDueState(task({ status: "Done", due: "Jul 01" }), referenceDate)).toBe("Done");
  });

  it("detects likely private details in task text", () => {
    expect(hasPrivateDetailsRisk("Rotate API token for integration")).toBe(true);
    expect(hasPrivateDetailsRisk("Remove password from setup note")).toBe(true);
    expect(hasPrivateDetailsRisk("Remove contact team.member@example.com")).toBe(true);
    expect(hasPrivateDetailsRisk("Publish staff training checklist")).toBe(false);
  });

  it("validates new task input", () => {
    expect(validateTaskInput({ title: "Schedule launch review", due: "Jul 25", privateDetailsClear: true }).valid).toBe(true);
    expect(validateTaskInput({ title: "", due: "Jul 25", privateDetailsClear: true }).valid).toBe(false);
    expect(validateTaskInput({ title: "Follow up on API token", due: "Jul 25", privateDetailsClear: true }).valid).toBe(false);
    expect(validateTaskInput({ title: "Schedule launch review", due: "soon", privateDetailsClear: true }).valid).toBe(false);
    expect(validateTaskInput({ title: "Schedule launch review", due: "Jul 25", privateDetailsClear: false }).valid).toBe(false);
  });

  it("enforces status transitions and completion gates", () => {
    expect(validateTaskStatusChange(task({ status: "Backlog" }), "In progress").valid).toBe(true);
    expect(validateTaskStatusChange(task({ status: "Backlog" }), "Done").valid).toBe(false);
    expect(validateTaskStatusChange(task({ status: "Review" }), "Done").valid).toBe(true);
    expect(validateTaskStatusChange(task({ status: "In progress", privateDetailsClear: false }), "Review").valid).toBe(false);
    expect(validateTaskStatusChange(task({ status: "Done" }), "In progress").valid).toBe(true);
  });

  it("returns only allowed statuses for the current task state", () => {
    const backlogStatuses = getAllowedTaskStatuses(task({ status: "Backlog" }));
    expect(backlogStatuses.has("Backlog")).toBe(true);
    expect(backlogStatuses.has("In progress")).toBe(true);
    expect(backlogStatuses.has("Blocked")).toBe(true);
    expect(backlogStatuses.has("Done")).toBe(false);

    const unsafeStatuses = getAllowedTaskStatuses(task({ status: "In progress", privateDetailsClear: false }));
    expect(unsafeStatuses.has("Review")).toBe(false);
  });

  it("calculates the next reminder run by cadence", () => {
    expect(nextReminderRun("Daily")).toBe("Tomorrow 09:00");
    expect(nextReminderRun("Twice a day")).toBe("Today 16:00");
    expect(nextReminderRun("Weekly")).toBe("Next Monday 09:00");
  });
});
