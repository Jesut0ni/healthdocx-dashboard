CREATE TYPE "public"."access_level" AS ENUM('Owner', 'Admin', 'Reviewer', 'Editor', 'Viewer');--> statement-breakpoint
CREATE TYPE "public"."audit_area" AS ENUM('Access', 'Project Ops', 'Integrations', 'Docs', 'Projects');--> statement-breakpoint
CREATE TYPE "public"."batch_status" AS ENUM('Queued', 'In progress', 'Review', 'Ready');--> statement-breakpoint
CREATE TYPE "public"."doc_area" AS ENUM('Runbook', 'Security', 'Implementation', 'API', 'Training');--> statement-breakpoint
CREATE TYPE "public"."doc_status" AS ENUM('Published', 'Draft', 'Needs review');--> statement-breakpoint
CREATE TYPE "public"."integration_method" AS ENUM('API', 'Webhook', 'CSV bridge', 'Manual update');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('Connected', 'Mapping', 'Needs credentials', 'Sync warning');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('Critical', 'High', 'Medium', 'Low');--> statement-breakpoint
CREATE TYPE "public"."project_stage" AS ENUM('Discovery', 'Planning', 'Build', 'Review', 'Launch ready', 'Live');--> statement-breakpoint
CREATE TYPE "public"."reminder_cadence" AS ENUM('Daily', 'Twice a day', 'Weekly');--> statement-breakpoint
CREATE TYPE "public"."reminder_channel" AS ENUM('Email', 'Slack', 'Dashboard');--> statement-breakpoint
CREATE TYPE "public"."risk" AS ENUM('Healthy', 'Watch', 'Blocked');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('Backlog', 'In progress', 'Review', 'Blocked', 'Done');--> statement-breakpoint
CREATE TYPE "public"."team" AS ENUM('Engineering', 'Operations', 'Product', 'Security', 'Customer Success');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('Active', 'Invited', 'Suspended');--> statement-breakpoint
CREATE TYPE "public"."task_workstream" AS ENUM('Project Ops', 'Integrations', 'Security', 'Implementation', 'Customer Success');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"area" "audit_area" NOT NULL,
	"time_label" text DEFAULT 'Just now' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"area" "doc_area" NOT NULL,
	"owner_id" text NOT NULL,
	"updated_label" text NOT NULL,
	"status" "doc_status" DEFAULT 'Draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"system" text NOT NULL,
	"method" "integration_method" NOT NULL,
	"status" "integration_status" DEFAULT 'Mapping' NOT NULL,
	"mapping_progress" integer DEFAULT 0 NOT NULL,
	"last_sync" text DEFAULT 'Pending' NOT NULL,
	"open_issues" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"area" text NOT NULL,
	"stage" "project_stage" DEFAULT 'Discovery' NOT NULL,
	"owner_id" text NOT NULL,
	"risk" "risk" DEFAULT 'Healthy' NOT NULL,
	"work_items" integer DEFAULT 0 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"target_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "reminder_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"cadence" "reminder_cadence" NOT NULL,
	"channel" "reminder_channel" NOT NULL,
	"task_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"cadence" "reminder_cadence" DEFAULT 'Daily' NOT NULL,
	"channel" "reminder_channel" DEFAULT 'Email' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run" text NOT NULL,
	"last_sent" text DEFAULT 'Not sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_rules_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"project_id" text NOT NULL,
	"workstream" "task_workstream" NOT NULL,
	"owner_id" text NOT NULL,
	"status" "task_status" DEFAULT 'Backlog' NOT NULL,
	"priority" "priority" DEFAULT 'Medium' NOT NULL,
	"due" text NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"private_details_clear" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"short_name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"team" "team" NOT NULL,
	"access" "access_level" NOT NULL,
	"status" "user_status" DEFAULT 'Invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_short_name_unique" UNIQUE("short_name"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "work_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"team" text NOT NULL,
	"work_type" text NOT NULL,
	"items" integer DEFAULT 0 NOT NULL,
	"quality_score" real DEFAULT 0 NOT NULL,
	"review_items" integer DEFAULT 0 NOT NULL,
	"status" "batch_status" DEFAULT 'Queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs" ADD CONSTRAINT "docs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_batches" ADD CONSTRAINT "work_batches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;