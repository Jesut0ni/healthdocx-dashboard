import type {
  AuditEvent,
  Integration,
  KnowledgeDoc,
  Project,
  Task,
  TaskStatus,
  TeamUser,
  WorkBatch,
} from "./healthdocx-data";
import type { ReminderCadence } from "./workflow-rules";

export type ReminderChannel = "Email" | "Slack" | "Dashboard";

export type ReminderRule = {
  id?: string;
  owner: string;
  ownerId?: string;
  cadence: ReminderCadence;
  channel: ReminderChannel;
  enabled: boolean;
  nextRun: string;
  lastSent: string;
  pendingTasks?: number;
};

export type ReminderLog = {
  id: string;
  owner: string;
  ownerId?: string;
  cadence: ReminderCadence;
  channel: ReminderChannel;
  taskCount: number;
  sentAt: string;
  deliveryStatus?: "sent" | "not_configured" | "failed";
  deliveryDetail?: string;
};

export type DashboardBootstrap = {
  users: TeamUser[];
  projects: Project[];
  tasks: Task[];
  workBatches: WorkBatch[];
  integrations: Integration[];
  docs: KnowledgeDoc[];
  auditEvents: AuditEvent[];
  reminderRules: ReminderRule[];
  reminderLogs: ReminderLog[];
};

export type AuthSession = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    access: string;
    role: string;
  };
};

export type BootstrapAdminInput = {
  displayName: string;
  email: string;
  role: string;
  team: TeamUser["team"];
  accessCode: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");
const authStorageKey = "healthdocx-auth-session";

type ApiErrorResponse = {
  error?: string;
};

export function getStoredAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(authStorageKey);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    window.localStorage.removeItem(authStorageKey);
    return null;
  }
}

export function storeAuthSession(session: AuthSession) {
  window.localStorage.setItem(authStorageKey, JSON.stringify(session));
}

export function clearAuthSession() {
  window.localStorage.removeItem(authStorageKey);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getStoredAuthSession();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `HealthDocX API request failed with ${response.status}.`;

    try {
      const body = (await response.json()) as ApiErrorResponse;
      message = body.error || message;
    } catch {
      // Keep the HTTP status fallback if the body is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function loginToBackend(email: string, accessCode: string) {
  return request<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, accessCode }),
  });
}

export function fetchAuthBootstrapStatus() {
  return request<{ hasUsers: boolean }>("/api/auth/bootstrap-status");
}

export function bootstrapFirstAdmin(input: BootstrapAdminInput) {
  return request<AuthSession>("/api/auth/bootstrap-admin", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchCurrentAuthSession() {
  return request<{ user: unknown }>("/api/auth/me");
}

export function fetchDashboardBootstrap() {
  return request<DashboardBootstrap>("/api/dashboard/bootstrap");
}

export function createBackendTask(input: Omit<Task, "id" | "comments">) {
  return request("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBackendTaskStatus(id: string, status: TaskStatus) {
  return request(`/api/tasks/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, actor: "Dashboard" }),
  });
}

export function updateBackendTaskOwner(id: string, owner: string) {
  return request(`/api/tasks/${id}/owner`, {
    method: "PATCH",
    body: JSON.stringify({ owner, actor: "Dashboard" }),
  });
}

export function createBackendProject(input: Omit<Project, "id">) {
  return request("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createBackendWorkBatch(
  input: Omit<WorkBatch, "id" | "qualityScore" | "reviewItems">,
) {
  return request("/api/work-batches", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createBackendIntegration(
  input: Omit<Integration, "id" | "mappingProgress" | "lastSync" | "openIssues">,
) {
  return request("/api/integrations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createBackendDoc(input: Omit<KnowledgeDoc, "id" | "updated">) {
  return request("/api/docs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function inviteBackendUser(input: Omit<TeamUser, "id" | "shortName" | "status">) {
  return request("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteBackendUser(id: string) {
  return request(`/api/users/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ actor: "Dashboard" }),
  });
}

export function updateBackendUserAccess(id: string, access: TeamUser["access"]) {
  return request(`/api/users/${id}/access`, {
    method: "PATCH",
    body: JSON.stringify({ access, actor: "Dashboard" }),
  });
}

export function updateBackendUserStatus(id: string, status: TeamUser["status"]) {
  return request(`/api/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, actor: "Dashboard" }),
  });
}

export function updateBackendReminderRule(owner: string, input: ReminderRule) {
  return request(`/api/reminders/${owner}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function sendBackendReminders(owner?: string) {
  return request<{ sent: ReminderLog[] }>("/api/reminders/send", {
    method: "POST",
    body: JSON.stringify({ owner, actor: "Dashboard" }),
  });
}
