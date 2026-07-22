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

export type Task = {
  id: string;
  title: string;
  project: string;
  workstream: "Project Ops" | "Integrations" | "Security" | "Implementation" | "Customer Success";
  owner: string;
  status: TaskStatus;
  priority: Priority;
  due: string;
  comments: number;
  privateDetailsClear: boolean;
};

export type Project = {
  id: string;
  name: string;
  area: string;
  stage: "Discovery" | "Planning" | "Build" | "Review" | "Launch ready" | "Live";
  owner: string;
  risk: Risk;
  workItems: number;
  progress: number;
  targetDate: string;
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

export const assignees = ["Terry", "Toni", "Kene", "Peace", "David", "Chimaobi"];

export const initialTasks: Task[] = [
  {
    id: "HDX-142",
    title: "Finalize task assignment flow",
    project: "Dashboard launch",
    workstream: "Project Ops",
    owner: "Terry",
    status: "In progress",
    priority: "Critical",
    due: "Jul 15",
    comments: 9,
    privateDetailsClear: true,
  },
  {
    id: "HDX-143",
    title: "Validate reminder schedule settings",
    project: "Reminder workflow",
    workstream: "Integrations",
    owner: "Peace",
    status: "Review",
    priority: "High",
    due: "Jul 17",
    comments: 5,
    privateDetailsClear: true,
  },
  {
    id: "HDX-144",
    title: "Confirm access levels for the six-person team",
    project: "Team access setup",
    workstream: "Security",
    owner: "Kene",
    status: "Backlog",
    priority: "High",
    due: "Jul 19",
    comments: 3,
    privateDetailsClear: true,
  },
  {
    id: "HDX-145",
    title: "Clean private details from imported task notes",
    project: "Dashboard launch",
    workstream: "Project Ops",
    owner: "Chimaobi",
    status: "Blocked",
    priority: "Critical",
    due: "Today",
    comments: 12,
    privateDetailsClear: false,
  },
  {
    id: "HDX-146",
    title: "Publish staff training checklist",
    project: "Team enablement",
    workstream: "Customer Success",
    owner: "Toni",
    status: "Done",
    priority: "Medium",
    due: "Jul 10",
    comments: 2,
    privateDetailsClear: true,
  },
  {
    id: "HDX-147",
    title: "Validate encrypted storage retention settings",
    project: "Team access setup",
    workstream: "Security",
    owner: "David",
    status: "In progress",
    priority: "Medium",
    due: "Jul 22",
    comments: 4,
    privateDetailsClear: true,
  },
  {
    id: "HDX-148",
    title: "Prepare technical docs index",
    project: "Technical documentation",
    workstream: "Implementation",
    owner: "Toni",
    status: "Backlog",
    priority: "Low",
    due: "Jul 25",
    comments: 1,
    privateDetailsClear: true,
  },
];

export const projects: Project[] = [
  {
    id: "PRJ-01",
    name: "Dashboard launch",
    area: "Internal operations",
    stage: "Build",
    owner: "Terry",
    risk: "Watch",
    workItems: 18,
    progress: 68,
    targetDate: "Jul 17",
  },
  {
    id: "PRJ-02",
    name: "Reminder workflow",
    area: "Operations",
    stage: "Review",
    owner: "Peace",
    risk: "Healthy",
    workItems: 12,
    progress: 82,
    targetDate: "Jul 17",
  },
  {
    id: "PRJ-03",
    name: "Team access setup",
    area: "Security",
    stage: "Planning",
    owner: "Kene",
    risk: "Blocked",
    workItems: 6,
    progress: 42,
    targetDate: "Jul 18",
  },
  {
    id: "PRJ-04",
    name: "Technical documentation",
    area: "Engineering",
    stage: "Build",
    owner: "Toni",
    risk: "Healthy",
    workItems: 9,
    progress: 56,
    targetDate: "Jul 18",
  },
];

export const workBatches: WorkBatch[] = [
  {
    id: "BAT-811",
    project: "Dashboard launch",
    team: "Product & Ops",
    workType: "Assignment flow",
    items: 18,
    qualityScore: 92.6,
    reviewItems: 3,
    status: "Review",
  },
  {
    id: "BAT-812",
    project: "Reminder workflow",
    team: "Operations",
    workType: "Reminder schedules",
    items: 12,
    qualityScore: 88.4,
    reviewItems: 5,
    status: "In progress",
  },
  {
    id: "BAT-813",
    project: "Team access setup",
    team: "Security",
    workType: "Roles and permissions",
    items: 6,
    qualityScore: 95.0,
    reviewItems: 1,
    status: "Ready",
  },
  {
    id: "BAT-814",
    project: "Technical documentation",
    team: "Engineering",
    workType: "Runbooks and docs",
    items: 9,
    qualityScore: 90.0,
    reviewItems: 2,
    status: "Queued",
  },
];

export const integrations: Integration[] = [
  {
    id: "INT-501",
    project: "Reminder workflow",
    system: "Slack",
    method: "Webhook",
    status: "Mapping",
    mappingProgress: 74,
    lastSync: "2h ago",
    openIssues: 2,
  },
  {
    id: "INT-502",
    project: "Reminder workflow",
    system: "Email",
    method: "API",
    status: "Connected",
    mappingProgress: 100,
    lastSync: "12m ago",
    openIssues: 0,
  },
  {
    id: "INT-503",
    project: "Dashboard launch",
    system: "Task database",
    method: "API",
    status: "Mapping",
    mappingProgress: 58,
    lastSync: "Pending",
    openIssues: 3,
  },
  {
    id: "INT-504",
    project: "Technical documentation",
    system: "Google Drive",
    method: "CSV bridge",
    status: "Sync warning",
    mappingProgress: 77,
    lastSync: "45m ago",
    openIssues: 2,
  },
];

export const docs: KnowledgeDoc[] = [
  {
    id: "DOC-01",
    title: "Task workflow runbook",
    area: "Runbook",
    owner: "Chimaobi",
    updated: "Today",
    status: "Published",
  },
  {
    id: "DOC-02",
    title: "Access review checklist",
    area: "Security",
    owner: "Kene",
    updated: "Yesterday",
    status: "Needs review",
  },
  {
    id: "DOC-03",
    title: "Project onboarding playbook",
    area: "Implementation",
    owner: "Toni",
    updated: "Jul 08",
    status: "Published",
  },
  {
    id: "DOC-04",
    title: "Reminder delivery contract",
    area: "API",
    owner: "Peace",
    updated: "Jul 07",
    status: "Draft",
  },
  {
    id: "DOC-05",
    title: "Dashboard handoff guide",
    area: "Training",
    owner: "Terry",
    updated: "Jul 04",
    status: "Published",
  },
];

export const users: TeamUser[] = [
  {
    id: "USR-01",
    name: "Terry",
    role: "Product Lead",
    team: "Product",
    access: "Admin",
    status: "Active",
  },
  {
    id: "USR-02",
    name: "Toni",
    role: "Implementation Manager",
    team: "Operations",
    access: "Editor",
    status: "Active",
  },
  {
    id: "USR-03",
    name: "Kene",
    role: "Security Engineer",
    team: "Security",
    access: "Owner",
    status: "Active",
  },
  {
    id: "USR-04",
    name: "Peace",
    role: "Integration Engineer",
    team: "Engineering",
    access: "Editor",
    status: "Active",
  },
  {
    id: "USR-05",
    name: "Chimaobi",
    role: "Reviewer",
    team: "Product",
    access: "Reviewer",
    status: "Active",
  },
  {
    id: "USR-06",
    name: "David",
    role: "Customer Success",
    team: "Customer Success",
    access: "Viewer",
    status: "Invited",
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "AUD-01",
    actor: "Kene",
    action: "updated role policy for the internal team",
    area: "Access",
    time: "11m ago",
  },
  {
    id: "AUD-02",
    actor: "Chimaobi",
    action: "flagged 3 task notes for private detail cleanup",
    area: "Project Ops",
    time: "26m ago",
  },
  {
    id: "AUD-03",
    actor: "Peace",
    action: "validated email reminder delivery settings",
    area: "Integrations",
    time: "1h ago",
  },
  {
    id: "AUD-04",
    actor: "Toni",
    action: "published the project onboarding playbook",
    area: "Docs",
    time: "2h ago",
  },
];
