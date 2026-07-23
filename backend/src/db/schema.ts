import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const taskStatusEnum = pgEnum("task_status", [
  "Backlog",
  "In progress",
  "Review",
  "Blocked",
  "Done",
]);

export const priorityEnum = pgEnum("priority", ["Critical", "High", "Medium", "Low"]);
export const riskEnum = pgEnum("risk", ["Healthy", "Watch", "Blocked"]);

export const projectStageEnum = pgEnum("project_stage", [
  "Discovery",
  "Planning",
  "Build",
  "Review",
  "Launch ready",
  "Live",
]);

export const workstreamEnum = pgEnum("task_workstream", [
  "Project Ops",
  "Integrations",
  "Security",
  "Implementation",
  "Customer Success",
]);

export const teamEnum = pgEnum("team", [
  "Engineering",
  "Operations",
  "Product",
  "Security",
  "Customer Success",
]);

export const accessLevelEnum = pgEnum("access_level", [
  "Owner",
  "Admin",
  "Reviewer",
  "Editor",
  "Viewer",
]);

export const userStatusEnum = pgEnum("user_status", ["Active", "Invited", "Suspended"]);
export const batchStatusEnum = pgEnum("batch_status", ["Queued", "In progress", "Review", "Ready"]);
export const integrationMethodEnum = pgEnum("integration_method", [
  "API",
  "Webhook",
  "CSV bridge",
  "Manual update",
]);
export const integrationStatusEnum = pgEnum("integration_status", [
  "Connected",
  "Mapping",
  "Needs credentials",
  "Sync warning",
]);
export const docAreaEnum = pgEnum("doc_area", [
  "Runbook",
  "Security",
  "Implementation",
  "API",
  "Training",
]);
export const docStatusEnum = pgEnum("doc_status", ["Published", "Draft", "Needs review"]);
export const auditAreaEnum = pgEnum("audit_area", [
  "Access",
  "Project Ops",
  "Integrations",
  "Docs",
  "Projects",
]);
export const reminderCadenceEnum = pgEnum("reminder_cadence", [
  "Daily",
  "Twice a day",
  "Weekly",
]);
export const reminderChannelEnum = pgEnum("reminder_channel", ["Email", "Slack", "Dashboard"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  shortName: text("short_name").notNull().unique(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  team: teamEnum("team").notNull(),
  access: accessLevelEnum("access").notNull(),
  status: userStatusEnum("status").notNull().default("Invited"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  area: text("area").notNull(),
  stage: projectStageEnum("stage").notNull().default("Discovery"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  risk: riskEnum("risk").notNull().default("Healthy"),
  workItems: integer("work_items").notNull().default(0),
  progress: integer("progress").notNull().default(0),
  targetDate: text("target_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  workstream: workstreamEnum("workstream").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  status: taskStatusEnum("status").notNull().default("Backlog"),
  priority: priorityEnum("priority").notNull().default("Medium"),
  due: text("due").notNull(),
  comments: integer("comments").notNull().default(0),
  privateDetailsClear: boolean("private_details_clear").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectMembers = pgTable("project_members", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const taskAssignees = pgTable("task_assignees", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectComments = pgTable("project_comments", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  authorId: text("author_id").references(() => users.id),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const taskComments = pgTable("task_comments", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id),
  authorId: text("author_id").references(() => users.id),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workBatches = pgTable("work_batches", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  team: text("team").notNull(),
  workType: text("work_type").notNull(),
  items: integer("items").notNull().default(0),
  qualityScore: real("quality_score").notNull().default(0),
  reviewItems: integer("review_items").notNull().default(0),
  status: batchStatusEnum("status").notNull().default("Queued"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const integrations = pgTable("integrations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  system: text("system").notNull(),
  method: integrationMethodEnum("method").notNull(),
  status: integrationStatusEnum("status").notNull().default("Mapping"),
  mappingProgress: integer("mapping_progress").notNull().default(0),
  lastSync: text("last_sync").notNull().default("Pending"),
  openIssues: integer("open_issues").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const docs = pgTable("docs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  area: docAreaEnum("area").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  updatedLabel: text("updated_label").notNull(),
  status: docStatusEnum("status").notNull().default("Draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reminderRules = pgTable("reminder_rules", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .unique()
    .references(() => users.id),
  cadence: reminderCadenceEnum("cadence").notNull().default("Daily"),
  channel: reminderChannelEnum("channel").notNull().default("Email"),
  enabled: boolean("enabled").notNull().default(true),
  nextRun: text("next_run").notNull(),
  lastSent: text("last_sent").notNull().default("Not sent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reminderLogs = pgTable("reminder_logs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  cadence: reminderCadenceEnum("cadence").notNull(),
  channel: reminderChannelEnum("channel").notNull(),
  taskCount: integer("task_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => users.id),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  area: auditAreaEnum("area").notNull(),
  timeLabel: text("time_label").notNull().default("Just now"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
