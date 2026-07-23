export type View =
  | "command"
  | "tasks"
  | "reminders"
  | "projects"
  | "integrations"
  | "docs"
  | "users";

export type TaskStatus = "Backlog" | "In progress" | "Review" | "Blocked" | "Done";
export type Priority = "Critical" | "High" | "Medium" | "Low";
export type Risk = "Healthy" | "Watch" | "Blocked";

export type WorkComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type Task = {
  id: string;
  title: string;
  project: string;
  workstream: "Project Ops" | "Integrations" | "Security" | "Implementation" | "Customer Success";
  owner: string;
  assignees: string[];
  status: TaskStatus;
  priority: Priority;
  due: string;
  comments: number;
  commentItems: WorkComment[];
  privateDetailsClear: boolean;
};

export type Project = {
  id: string;
  name: string;
  area: string;
  stage: "Discovery" | "Planning" | "Build" | "Review" | "Launch ready" | "Live";
  owner: string;
  members: string[];
  risk: Risk;
  workItems: number;
  progress: number;
  targetDate: string;
  comments: number;
  commentItems: WorkComment[];
};

export type WorkBatch = {
  id: string;
  project: string;
  team: string;
  workType: string;
  items: number;
  qualityScore: number;
  reviewItems: number;
  status: "Queued" | "In progress" | "Review" | "Ready";
};

export type Integration = {
  id: string;
  project: string;
  system: string;
  method: "API" | "Webhook" | "CSV bridge" | "Manual update";
  status: "Connected" | "Mapping" | "Needs credentials" | "Sync warning";
  mappingProgress: number;
  lastSync: string;
  openIssues: number;
};

export type KnowledgeDoc = {
  id: string;
  title: string;
  area: "Runbook" | "Security" | "Implementation" | "API" | "Training";
  owner: string;
  updated: string;
  status: "Published" | "Draft" | "Needs review";
};

export type TeamUser = {
  id: string;
  name: string;
  shortName?: string;
  email: string;
  role: string;
  team: "Engineering" | "Operations" | "Product" | "Security" | "Customer Success";
  access: "Owner" | "Admin" | "Reviewer" | "Editor" | "Viewer";
  status: "Active" | "Invited" | "Suspended";
};

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  area: "Access" | "Project Ops" | "Integrations" | "Docs" | "Projects";
  time: string;
};
