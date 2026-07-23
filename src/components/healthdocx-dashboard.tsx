"use client";

import Image from "next/image";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpenText,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock3,
  DatabaseZap,
  FileCheck2,
  FileText,
  Gauge,
  History,
  KeyRound,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Network,
  Plus,
  Send,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  CheckboxField,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Modal,
  SelectField,
  TextField,
  Toast,
} from "@/components/healthdocx-ui";
import {
  bootstrapFirstAdmin,
  clearAuthSession,
  createBackendDoc,
  createBackendIntegration,
  createBackendProject,
  createBackendTask,
  createBackendWorkBatch,
  fetchAuthBootstrapStatus,
  fetchCurrentAuthSession,
  fetchDashboardBootstrap,
  getStoredAuthSession,
  inviteBackendUser,
  loginToBackend,
  sendBackendReminders,
  storeAuthSession,
  updateBackendReminderRule,
  updateBackendTaskOwner,
  updateBackendTaskStatus,
  updateBackendUserAccess,
  updateBackendUserStatus,
} from "@/lib/healthdocx-api";
import type {
  AuthSession,
  BootstrapAdminInput,
  DashboardBootstrap,
  ReminderChannel,
  ReminderLog,
  ReminderRule,
} from "@/lib/healthdocx-api";
import type {
  AuditEvent,
  Project,
  Integration,
  KnowledgeDoc,
  Priority,
  WorkBatch,
  Risk,
  Task,
  TaskStatus,
  TeamUser,
  View,
} from "@/lib/healthdocx-data";
import {
  getAllowedTaskStatuses,
  getTaskDueState,
  hasPrivateDetailsRisk,
  nextReminderRun,
  validateTaskInput,
  validateTaskStatusChange,
} from "@/lib/workflow-rules";
import type { ReminderCadence, TaskDueState } from "@/lib/workflow-rules";

const statusColumns: TaskStatus[] = [
  "Backlog",
  "In progress",
  "Review",
  "Blocked",
  "Done",
];

const navItems: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "command", label: "Command", icon: LayoutDashboard },
  { id: "tasks", label: "Work Queue", icon: ClipboardList },
  { id: "reminders", label: "Reminders", icon: BellRing },
  { id: "projects", label: "Projects", icon: Building2 },
  { id: "integrations", label: "Integrations", icon: Network },
  { id: "docs", label: "Docs", icon: BookOpenText },
  { id: "users", label: "Access", icon: Users },
];

type ActiveModal =
  | "task"
  | "project"
  | "batch"
  | "integration"
  | "doc"
  | "user"
  | "reminder"
  | null;
type DetailSelection =
  | { type: "task"; id: string }
  | { type: "project"; id: string }
  | { type: "batch"; id: string }
  | { type: "integration"; id: string }
  | { type: "doc"; id: string }
  | { type: "user"; id: string }
  | null;
type ResolvedDetail =
  | { type: "task"; item?: Task }
  | { type: "project"; item?: Project }
  | { type: "batch"; item?: WorkBatch }
  | { type: "integration"; item?: Integration }
  | { type: "doc"; item?: KnowledgeDoc }
  | { type: "user"; item?: TeamUser }
  | null;
type BackendStatus = "syncing" | "connected" | "local";

const priorityOptions: Priority[] = ["Critical", "High", "Medium", "Low"];
const workstreamOptions: Task["workstream"][] = [
  "Project Ops",
  "Integrations",
  "Security",
  "Implementation",
  "Customer Success",
];
const stageOptions: Project["stage"][] = [
  "Discovery",
  "Planning",
  "Build",
  "Review",
  "Launch ready",
  "Live",
];
const riskOptions: Risk[] = ["Healthy", "Watch", "Blocked"];
const batchStatusOptions: WorkBatch["status"][] = [
  "Queued",
  "In progress",
  "Review",
  "Ready",
];
const integrationMethodOptions: Integration["method"][] = [
  "API",
  "Webhook",
  "CSV bridge",
  "Manual update",
];
const integrationStatusOptions: Integration["status"][] = [
  "Connected",
  "Mapping",
  "Needs credentials",
  "Sync warning",
];
const docAreaOptions: KnowledgeDoc["area"][] = [
  "Runbook",
  "Security",
  "Implementation",
  "API",
  "Training",
];
const docStatusOptions: KnowledgeDoc["status"][] = [
  "Published",
  "Draft",
  "Needs review",
];
const teamOptions: TeamUser["team"][] = [
  "Engineering",
  "Operations",
  "Product",
  "Security",
  "Customer Success",
];
const accessOptions: TeamUser["access"][] = [
  "Owner",
  "Admin",
  "Reviewer",
  "Editor",
  "Viewer",
];
const userStatusOptions: TeamUser["status"][] = ["Active", "Invited", "Suspended"];
const reminderCadenceOptions: ReminderCadence[] = ["Daily", "Twice a day", "Weekly"];
const reminderChannelOptions: ReminderChannel[] = ["Email"];

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value.trim();
}

function ownerKey(user: TeamUser) {
  return user.shortName ?? firstName(user.name);
}

function createDefaultReminderRule(owner: string, index = 0): ReminderRule {
  const cadence = reminderCadenceOptions[index % reminderCadenceOptions.length] ?? "Daily";

  return {
    owner,
    cadence,
    channel: "Email",
    enabled: true,
    nextRun: nextReminderRun(cadence),
    lastSent: "Not sent",
  };
}

const priorityStyles: Record<Priority, string> = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-cyan-200 bg-cyan-50 text-cyan-700",
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const taskColumnStyles: Record<TaskStatus, string> = {
  Backlog: "border-t-[#95A39A]",
  "In progress": "border-t-cyan-500",
  "Review": "border-t-amber-500",
  Blocked: "border-t-red-500",
  Done: "border-t-emerald-500",
};

const taskDueStateStyles: Record<TaskDueState, string> = {
  Overdue: "border-red-200 bg-red-50 text-red-700",
  "Due today": "border-amber-200 bg-amber-50 text-amber-700",
  Upcoming: "border-[#C1C9BE]/70 bg-white text-[#414941]",
  Done: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const riskStyles: Record<Risk, string> = {
  Healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Watch: "border-amber-200 bg-amber-50 text-amber-700",
  Blocked: "border-red-200 bg-red-50 text-red-700",
};

const batchStatusStyles: Record<WorkBatch["status"], string> = {
  Queued: "border-[#C1C9BE]/70 bg-[#F7FAF7] text-[#414941]",
  "In progress": "border-cyan-200 bg-cyan-50 text-cyan-700",
  Review: "border-amber-200 bg-amber-50 text-amber-700",
  Ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const integrationStatusStyles: Record<Integration["status"], string> = {
  Connected: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Mapping: "border-cyan-200 bg-cyan-50 text-cyan-700",
  "Needs credentials": "border-red-200 bg-red-50 text-red-700",
  "Sync warning": "border-amber-200 bg-amber-50 text-amber-700",
};

const docStatusStyles: Record<KnowledgeDoc["status"], string> = {
  Published: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Draft: "border-[#C1C9BE]/70 bg-[#F7FAF7] text-[#414941]",
  "Needs review": "border-amber-200 bg-amber-50 text-amber-700",
};

const accessStyles: Record<TeamUser["access"], string> = {
  Owner: "border-[#B4F1BD] bg-[#B4F1BD]/30 text-[#006D34]",
  Admin: "border-blue-200 bg-blue-50 text-blue-700",
  "Reviewer": "border-violet-200 bg-violet-50 text-violet-700",
  Editor: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Viewer: "border-[#C1C9BE]/70 bg-[#F7FAF7] text-[#414941]",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function nextId(prefix: string, sequence: number) {
  return `${prefix}-${String(sequence).padStart(3, "0")}`;
}

function formatBackendError(error: unknown) {
  return error instanceof Error ? error.message : "Backend is unavailable.";
}

function taskArea(workstream: Task["workstream"]): AuditEvent["area"] {
  if (workstream === "Project Ops") {
    return "Project Ops";
  }

  if (workstream === "Integrations") {
    return "Integrations";
  }

  if (workstream === "Security") {
    return "Access";
  }

  return "Projects";
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-md border border-[#C1C9BE]/60 bg-white text-[#414941] shadow-sm transition hover:border-[#008943] hover:bg-[#B4F1BD]/25 hover:text-[#006D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008943]/20"
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  icon,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-md bg-[#008943] px-3.5 text-sm font-bold text-white shadow-sm shadow-[#008943]/20 transition hover:bg-[#006D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008943]/25"
    >
      {icon}
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  icon,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-[#C1C9BE]/60 bg-white px-3.5 text-sm font-bold text-[#414941] shadow-sm transition hover:border-[#008943] hover:bg-[#B4F1BD]/25 hover:text-[#006D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008943]/20"
    >
      {icon}
      {children}
    </button>
  );
}

function SectionHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow ? <p className="mb-1 text-[11px] font-extrabold uppercase text-[#008943]">{eyebrow}</p> : null}
        <h2 className="text-lg font-bold text-[#07160F]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function InlineNotice({
  tone,
  title,
  detail,
}: {
  tone: "amber" | "red" | "green";
  title: string;
  detail: string;
}) {
  const toneClass = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    green: "border-[#B4F1BD] bg-[#B4F1BD]/20 text-[#006D34]",
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-5">{detail}</p>
    </div>
  );
}

function BackendSyncBadge({ status, message }: { status: BackendStatus; message: string }) {
  const badgeClass =
    status === "connected"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "syncing"
        ? "border-cyan-200 bg-cyan-50 text-cyan-700"
        : "border-amber-200 bg-amber-50 text-amber-800";
  const label = status === "connected" ? "Backend synced" : status === "syncing" ? "Syncing" : "Local mode";

  return (
    <span
      title={message}
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${badgeClass}`}
    >
      <DatabaseZap className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function LoginScreen({
  loading,
  error,
  setupMode,
  onLogin,
  onBootstrapAdmin,
}: {
  loading: boolean;
  error: string;
  setupMode: boolean;
  onLogin: (email: string, accessCode: string) => void;
  onBootstrapAdmin: (input: BootstrapAdminInput) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [team, setTeam] = useState<TeamUser["team"]>("Operations");
  const [accessCode, setAccessCode] = useState("");

  return (
    <main className="grid min-h-screen place-items-center bg-[#F5F8F5] p-4 text-[#07160F]">
      <section className="w-full max-w-md rounded-lg border border-[#C1C9BE]/60 bg-white p-5 shadow-2xl shadow-[#062218]/10">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-[#F8FCF8] shadow-sm ring-1 ring-[#C1C9BE]/60">
            <Image
              src="/healthdocx-logo.svg"
              alt="HealthDocX logo"
              width={40}
              height={40}
              priority
              className="h-10 w-10 rounded-md"
            />
          </div>
          <div>
            <p className="text-lg font-extrabold text-[#07160F]">HealthDocX</p>
            <p className="text-xs font-bold uppercase text-[#008943]">
              {setupMode ? "First admin setup" : "Team dashboard login"}
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (setupMode) {
              onBootstrapAdmin({ displayName, email, role, team, accessCode });
              return;
            }

            onLogin(email, accessCode);
          }}
          className="mt-5 grid gap-4"
        >
          <InlineNotice
            tone="green"
            title={setupMode ? "Fresh workspace" : "Team access"}
            detail={
              setupMode
                ? "No users exist yet. Create the first owner account with the shared internal dashboard access code."
                : "Use your HealthDocX team email and the shared internal dashboard access code."
            }
          />
          {error ? (
            <InlineNotice
              tone="red"
              title={setupMode ? "Setup failed" : "Login failed"}
              detail={error}
            />
          ) : null}
          {setupMode ? (
            <>
              <TextField label="Full name" value={displayName} onChange={setDisplayName} required />
              <TextField label="Role" value={role} onChange={setRole} required />
              <SelectField label="Team" value={team} options={teamOptions} onChange={setTeam} />
            </>
          ) : null}
          <TextField label="Email" value={email} onChange={setEmail} type="email" required />
          <TextField
            label="Access code"
            value={accessCode}
            onChange={setAccessCode}
            type="password"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#008943] px-4 text-sm font-semibold text-white shadow-sm shadow-[#008943]/20 transition hover:bg-[#006D34] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <LockKeyhole className="h-4 w-4" />
            {loading ? (setupMode ? "Creating admin" : "Signing in") : setupMode ? "Create first admin" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F7FAF7] p-4 text-[#07160F]">
      <div className="rounded-md border border-[#C1C9BE]/70 bg-white px-4 py-3 text-sm font-semibold shadow-sm">
        Checking HealthDocX access...
      </div>
    </main>
  );
}

export function HealthDocXDashboard() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [needsFirstAdmin, setNeedsFirstAdmin] = useState(false);
  const [activeView, setActiveView] = useState<View>("command");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectItems, setProjectItems] = useState<Project[]>([]);
  const [workBatchItems, setWorkBatchItems] = useState<WorkBatch[]>([]);
  const [integrationItems, setIntegrationItems] = useState<Integration[]>([]);
  const [docItems, setDocItems] = useState<KnowledgeDoc[]>([]);
  const [userItems, setUserItems] = useState<TeamUser[]>([]);
  const [auditItems, setAuditItems] = useState<AuditEvent[]>([]);
  const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
  const [reminderLogs, setReminderLogs] = useState<ReminderLog[]>([]);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<Priority | "All">("All");
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [ownerFilter, setOwnerFilter] = useState<string>("All");
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [selectedReminderOwner, setSelectedReminderOwner] = useState("");
  const [detailSelection, setDetailSelection] = useState<DetailSelection>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("syncing");
  const [backendMessage, setBackendMessage] = useState("Connecting to backend");
  const ownerOptions = useMemo(() => {
    const owners = userItems.map(ownerKey).filter(Boolean);
    return Array.from(new Set(owners));
  }, [userItems]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const storedSession = getStoredAuthSession();

        if (!storedSession) {
          try {
            const status = await fetchAuthBootstrapStatus();
            setNeedsFirstAdmin(!status.hasUsers);
          } catch {
            setNeedsFirstAdmin(false);
          }

          setAuthReady(true);
          return;
        }

        try {
          await fetchCurrentAuthSession();
          setAuthSession(storedSession);
          setNeedsFirstAdmin(false);
        } catch {
          clearAuthSession();
          setAuthSession(null);

          try {
            const status = await fetchAuthBootstrapStatus();
            setNeedsFirstAdmin(!status.hasUsers);
          } catch {
            setNeedsFirstAdmin(false);
          }
        } finally {
          setAuthReady(true);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const applyDashboardBootstrap = useCallback((data: DashboardBootstrap) => {
    setTasks(data.tasks);
    setProjectItems(data.projects);
    setWorkBatchItems(data.workBatches);
    setIntegrationItems(data.integrations);
    setDocItems(data.docs);
    setUserItems(data.users);
    setAuditItems(data.auditEvents);
    setReminderRules(
      data.reminderRules.length > 0
        ? data.reminderRules
        : data.users.map((user, index) => createDefaultReminderRule(ownerKey(user), index)),
    );
    setReminderLogs(data.reminderLogs);
    setSelectedReminderOwner((current) => {
      const owners =
        data.reminderRules.length > 0
          ? data.reminderRules.map((rule) => rule.owner)
          : data.users.map(ownerKey);
      return owners.includes(current) ? current : owners[0] ?? "";
    });
  }, []);

  const refreshFromBackend = useCallback(
    async (silent = false) => {
      try {
        const data = await fetchDashboardBootstrap();
        applyDashboardBootstrap(data);
        setBackendStatus("connected");
        setBackendMessage("Backend synced");
        return true;
      } catch (error) {
        setBackendStatus("local");
        setBackendMessage(formatBackendError(error));

        if (!silent) {
          setToast("Backend unavailable. Changes will stay local until the database is connected.");
        }

        return false;
      }
    },
    [applyDashboardBootstrap],
  );

  useEffect(() => {
    if (!authReady || !authSession) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshFromBackend(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [authReady, authSession, refreshFromBackend]);

  async function handleLogin(email: string, accessCode: string) {
    setLoginLoading(true);
    setLoginError("");

    try {
      const session = await loginToBackend(email, accessCode);
      storeAuthSession(session);
      setAuthSession(session);
      setNeedsFirstAdmin(false);
      setBackendStatus("syncing");
      setBackendMessage("Connecting to backend");
    } catch (error) {
      setLoginError(formatBackendError(error));
      clearAuthSession();
      setAuthSession(null);
    } finally {
      setLoginLoading(false);
      setAuthReady(true);
    }
  }

  async function handleBootstrapAdmin(input: BootstrapAdminInput) {
    setLoginLoading(true);
    setLoginError("");

    try {
      const session = await bootstrapFirstAdmin(input);
      storeAuthSession(session);
      setAuthSession(session);
      setNeedsFirstAdmin(false);
      setBackendStatus("syncing");
      setBackendMessage("Connecting to backend");
    } catch (error) {
      setLoginError(formatBackendError(error));
      clearAuthSession();
      setAuthSession(null);
    } finally {
      setLoginLoading(false);
      setAuthReady(true);
    }
  }

  function handleLogout() {
    clearAuthSession();
    setAuthSession(null);
    setLoginError("");
    setBackendStatus("syncing");
    setBackendMessage("Signed out");
  }

  const filteredTasks = useMemo(() => {
    const search = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const searchable = [
        task.id,
        task.title,
        task.project,
        task.owner,
        task.status,
        task.workstream,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !search || searchable.includes(search);
      const matchesPriority = priority === "All" || task.priority === priority;
      const matchesProject = projectFilter === "All" || task.project === projectFilter;
      const matchesOwner = ownerFilter === "All" || task.owner === ownerFilter;

      return matchesSearch && matchesPriority && matchesProject && matchesOwner;
    });
  }, [projectFilter, ownerFilter, priority, query, tasks]);

  const openTasks = tasks.filter((task) => task.status !== "Done");
  const pendingTasksByOwner = useMemo(() => {
    return ownerOptions.reduce<Record<string, Task[]>>((ownerMap, owner) => {
      ownerMap[owner] = tasks.filter((task) => task.owner === owner && task.status !== "Done");
      return ownerMap;
    }, {});
  }, [ownerOptions, tasks]);
  const blockedTasks = tasks.filter((task) => task.status === "Blocked");
  const reviewTasks = tasks.filter((task) => task.status === "Review");
  const totalWorkItems = projectItems.reduce((sum, project) => sum + project.workItems, 0);
  const averageQuality =
    workBatchItems.length > 0
      ? workBatchItems.reduce((sum, batch) => sum + batch.qualityScore, 0) / workBatchItems.length
      : 0;
  const connectedIntegrations = integrationItems.filter(
    (integration) => integration.status === "Connected",
  );
  const activeProjects = projectItems.filter((project) => project.stage !== "Discovery");
  const selectedDetail = useMemo<ResolvedDetail>(() => {
    if (!detailSelection) {
      return null;
    }

    if (detailSelection.type === "task") {
      return { type: "task" as const, item: tasks.find((item) => item.id === detailSelection.id) };
    }

    if (detailSelection.type === "project") {
      return {
        type: "project" as const,
        item: projectItems.find((item) => item.id === detailSelection.id),
      };
    }

    if (detailSelection.type === "batch") {
      return {
        type: "batch" as const,
        item: workBatchItems.find((item) => item.id === detailSelection.id),
      };
    }

    if (detailSelection.type === "integration") {
      return {
        type: "integration" as const,
        item: integrationItems.find((item) => item.id === detailSelection.id),
      };
    }

    if (detailSelection.type === "doc") {
      return { type: "doc" as const, item: docItems.find((item) => item.id === detailSelection.id) };
    }

    return { type: "user" as const, item: userItems.find((item) => item.id === detailSelection.id) };
  }, [
    detailSelection,
    docItems,
    projectItems,
    integrationItems,
    workBatchItems,
    tasks,
    userItems,
  ]);

  function showToast(message: string) {
    setToast(message);
  }

  function addAudit(area: AuditEvent["area"], action: string, actor = "System") {
    setAuditItems((current) => [
      {
        id: nextId("AUD", current.length + 1),
        actor,
        action,
        area,
        time: "just now",
      },
      ...current,
    ]);
  }

  function markBackendFallback(error: unknown) {
    setBackendStatus("local");
    setBackendMessage(formatBackendError(error));
  }

  async function updateTaskStatus(id: string, status: TaskStatus) {
    const task = tasks.find((item) => item.id === id);

    if (!task) {
      return;
    }

    const validation = validateTaskStatusChange(task, status);

    if (!validation.valid) {
      showToast(validation.message ?? "This task cannot move to that status yet.");
      return;
    }

    if (backendStatus !== "local") {
      try {
        await updateBackendTaskStatus(id, status);
        await refreshFromBackend(true);
        showToast(`Task ${id} moved to ${status}.`);
        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, status } : task)),
    );
    addAudit("Projects", `updated ${id} status to ${status}`);
    showToast(`Task ${id} moved to ${status}.`);
  }

  async function updateTaskOwner(id: string, owner: string) {
    if (backendStatus !== "local") {
      try {
        await updateBackendTaskOwner(id, owner);
        await refreshFromBackend(true);
        showToast(`Task ${id} assigned to ${owner}.`);
        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, owner } : task)),
    );
    addAudit("Projects", `assigned ${id} to ${owner}`);
    showToast(`Task ${id} assigned to ${owner}.`);
  }

  async function configureReminder(input: ReminderRule) {
    if (backendStatus !== "local") {
      try {
        await updateBackendReminderRule(input.owner, input);
        await refreshFromBackend(true);
        showToast(`${input.owner}'s reminder schedule updated.`);
        setActiveModal(null);
        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    setReminderRules((current) =>
      current.map((rule) => (rule.owner === input.owner ? input : rule)),
    );
    addAudit("Projects", `updated reminder schedule for ${input.owner}`);
    showToast(`${input.owner}'s reminder schedule updated.`);
    setActiveModal(null);
  }

  function openReminderConfig(owner: string) {
    setSelectedReminderOwner(owner);
    setActiveModal("reminder");
  }

  async function sendReminder(owner: string) {
    const ownerTasks = pendingTasksByOwner[owner] ?? [];
    const rule = reminderRules.find((item) => item.owner === owner);

    if (!rule) {
      return;
    }

    if (ownerTasks.length === 0) {
      showToast(`${owner} has no pending tasks to remind about.`);
      return;
    }

    if (backendStatus !== "local") {
      try {
        const result = await sendBackendReminders(owner);
        await refreshFromBackend(true);

        if (result.sent.length === 0) {
          showToast(`${owner} has no pending tasks to remind about.`);
        } else if (result.sent[0].deliveryStatus && result.sent[0].deliveryStatus !== "sent") {
          showToast(result.sent[0].deliveryDetail ?? "Reminder logged, but email was not sent.");
        } else {
          showToast(`Reminder sent to ${owner} for ${result.sent[0].taskCount} pending tasks.`);
        }

        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    setReminderLogs((current) => [
      {
        id: nextId("REM", current.length + 1),
        owner,
        cadence: rule.cadence,
        channel: rule.channel,
        taskCount: ownerTasks.length,
        sentAt: "just now",
      },
      ...current,
    ]);
    setReminderRules((current) =>
      current.map((item) =>
        item.owner === owner
          ? {
              ...item,
              lastSent: "just now",
              nextRun: nextReminderRun(item.cadence),
            }
          : item,
      ),
    );
    addAudit("Projects", `sent ${rule.channel.toLowerCase()} reminder to ${owner} for ${ownerTasks.length} pending tasks`);
    showToast(`Reminder sent to ${owner} for ${ownerTasks.length} pending tasks.`);
  }

  async function sendDueReminders() {
    const enabledRules = reminderRules.filter((rule) => rule.enabled);
    const sendableRules = enabledRules.filter((rule) => (pendingTasksByOwner[rule.owner] ?? []).length > 0);

    if (sendableRules.length === 0) {
      showToast("No enabled reminder schedules have pending tasks right now.");
      return;
    }

    const totalTasks = sendableRules.reduce(
      (sum, rule) => sum + (pendingTasksByOwner[rule.owner] ?? []).length,
      0,
    );

    if (backendStatus !== "local") {
      try {
        const result = await sendBackendReminders();
        await refreshFromBackend(true);
        const sentTaskCount = result.sent.reduce((sum, log) => sum + log.taskCount, 0);
        const deliveryIssue = result.sent.find(
          (log) => log.deliveryStatus && log.deliveryStatus !== "sent",
        );

        if (result.sent.length === 0) {
          showToast("No enabled reminder schedules have pending tasks right now.");
        } else if (deliveryIssue) {
          showToast(deliveryIssue.deliveryDetail ?? "Reminders logged, but email was not sent.");
        } else {
          showToast(`Sent ${result.sent.length} reminder schedules covering ${sentTaskCount} pending tasks.`);
        }

        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    setReminderLogs((current) => [
      ...sendableRules.map((rule, index) => ({
        id: nextId("REM", current.length + index + 1),
        owner: rule.owner,
        cadence: rule.cadence,
        channel: rule.channel,
        taskCount: (pendingTasksByOwner[rule.owner] ?? []).length,
        sentAt: "just now",
      })),
      ...current,
    ]);
    setReminderRules((current) =>
      current.map((rule) =>
        sendableRules.some((sendableRule) => sendableRule.owner === rule.owner)
          ? {
              ...rule,
              lastSent: "just now",
              nextRun: nextReminderRun(rule.cadence),
            }
          : rule,
      ),
    );
    addAudit(
      "Projects",
      `sent scheduled reminders to ${sendableRules.length} owners for ${totalTasks} pending tasks`,
    );
    showToast(`Sent ${sendableRules.length} reminder schedules covering ${totalTasks} pending tasks.`);
  }

  function handlePriorityChange(event: ChangeEvent<HTMLSelectElement>) {
    setPriority(event.target.value as Priority | "All");
  }

  async function createTask(input: Omit<Task, "id" | "comments">) {
    const validation = validateTaskInput(input);

    if (!validation.valid) {
      showToast(validation.message ?? "Check the task details before saving.");
      return;
    }

    if (backendStatus !== "local") {
      try {
        await createBackendTask(input);
        await refreshFromBackend(true);
        showToast("Work item created.");
        setActiveModal(null);
        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    const task: Task = {
      ...input,
      title: input.title.trim(),
      due: input.due.trim(),
      id: `HDX-${142 + tasks.length + 1}`,
      comments: 0,
    };

    setTasks((current) => [task, ...current]);
    addAudit(taskArea(task.workstream), `created task ${task.id} for ${task.project}`);
    showToast(`${task.id} created.`);
    setActiveModal(null);
  }

  async function createProject(input: Omit<Project, "id">) {
    if (backendStatus !== "local") {
      try {
        await createBackendProject(input);
        await refreshFromBackend(true);
        showToast(`${input.name} added to the pipeline.`);
        setActiveModal(null);
        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    const project: Project = {
      ...input,
      id: nextId("PRJ", projectItems.length + 1),
    };

    setProjectItems((current) => [project, ...current]);
    addAudit("Projects", `added project ${project.name}`);
    showToast(`${project.name} added to the pipeline.`);
    setActiveModal(null);
  }

  async function createBatch(input: Omit<WorkBatch, "id" | "qualityScore" | "reviewItems">) {
    if (backendStatus !== "local") {
      try {
        await createBackendWorkBatch(input);
        await refreshFromBackend(true);
        showToast("Work batch created.");
        setActiveModal(null);
        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    const batch: WorkBatch = {
      ...input,
      id: nextId("BAT", workBatchItems.length + 811),
      qualityScore: 0,
      reviewItems: 0,
    };

    setWorkBatchItems((current) => [batch, ...current]);
    addAudit("Project Ops", `created batch ${batch.id} for ${batch.project}`);
    showToast(`${batch.id} created.`);
    setActiveModal(null);
  }

  async function createIntegration(input: Omit<Integration, "id" | "mappingProgress" | "lastSync" | "openIssues">) {
    if (backendStatus !== "local") {
      try {
        await createBackendIntegration(input);
        await refreshFromBackend(true);
        showToast(`${input.project} integration added.`);
        setActiveModal(null);
        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    const integration: Integration = {
      ...input,
      id: nextId("INT", integrationItems.length + 501),
      mappingProgress: input.status === "Connected" ? 100 : 10,
      lastSync: input.status === "Connected" ? "just now" : "Pending",
      openIssues: input.status === "Connected" ? 0 : 1,
    };

    setIntegrationItems((current) => [integration, ...current]);
    addAudit("Integrations", `created ${integration.system} integration for ${integration.project}`);
    showToast(`${integration.project} integration added.`);
    setActiveModal(null);
  }

  async function createDoc(input: Omit<KnowledgeDoc, "id" | "updated">) {
    if (backendStatus !== "local") {
      try {
        await createBackendDoc(input);
        await refreshFromBackend(true);
        showToast(`${input.title} created.`);
        setActiveModal(null);
        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    const doc: KnowledgeDoc = {
      ...input,
      id: nextId("DOC", docItems.length + 1),
      updated: "Today",
    };

    setDocItems((current) => [doc, ...current]);
    addAudit("Docs", `created document ${doc.title}`);
    showToast(`${doc.title} created.`);
    setActiveModal(null);
  }

  async function inviteUser(input: Omit<TeamUser, "id" | "status">) {
    if (backendStatus !== "local") {
      try {
        await inviteBackendUser(input);
        await refreshFromBackend(true);
        showToast(`${input.name} invited.`);
        setActiveModal(null);
        return;
      } catch (error) {
        markBackendFallback(error);
      }
    }

    const user: TeamUser = {
      ...input,
      id: nextId("USR", userItems.length + 1),
      status: "Invited",
    };

    setUserItems((current) => [user, ...current]);
    addAudit("Access", `invited ${user.name} as ${user.access}`);
    showToast(`${user.name} invited.`);
    setActiveModal(null);
  }

  function updateUserAccess(userId: string, access: TeamUser["access"]) {
    const user = userItems.find((item) => item.id === userId);

    if (!user) {
      return;
    }

    setConfirmation({
      title: "Confirm access change",
      description: `Change ${user.name}'s access from ${user.access} to ${access}? This will be written to the audit trail.`,
      confirmLabel: "Change access",
      onConfirm: () => {
        void (async () => {
          if (backendStatus !== "local") {
            try {
              await updateBackendUserAccess(userId, access);
              await refreshFromBackend(true);
              showToast(`${user.name}'s access changed to ${access}.`);
              setConfirmation(null);
              return;
            } catch (error) {
              markBackendFallback(error);
            }
          }

          setUserItems((current) =>
            current.map((item) => (item.id === userId ? { ...item, access } : item)),
          );
          addAudit("Access", `changed ${user.name}'s access to ${access}`);
          showToast(`${user.name}'s access changed to ${access}.`);
          setConfirmation(null);
        })();
      },
    });
  }

  function updateUserStatus(userId: string, status: TeamUser["status"]) {
    const user = userItems.find((item) => item.id === userId);

    if (!user) {
      return;
    }

    setConfirmation({
      title: "Confirm user status change",
      description: `Change ${user.name}'s status from ${user.status} to ${status}? This affects whether the user can participate in HealthDocX operations.`,
      confirmLabel: "Change status",
      onConfirm: () => {
        void (async () => {
          if (backendStatus !== "local") {
            try {
              await updateBackendUserStatus(userId, status);
              await refreshFromBackend(true);
              showToast(`${user.name}'s status changed to ${status}.`);
              setConfirmation(null);
              return;
            } catch (error) {
              markBackendFallback(error);
            }
          }

          setUserItems((current) =>
            current.map((item) => (item.id === userId ? { ...item, status } : item)),
          );
          addAudit("Access", `changed ${user.name}'s status to ${status}`);
          showToast(`${user.name}'s status changed to ${status}.`);
          setConfirmation(null);
        })();
      },
    });
  }

  if (!authReady) {
    return <AuthLoadingScreen />;
  }

  if (!authSession) {
    return (
      <LoginScreen
        loading={loginLoading}
        error={loginError}
        setupMode={needsFirstAdmin}
        onLogin={handleLogin}
        onBootstrapAdmin={handleBootstrapAdmin}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F8F5] text-[#07160F]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[17rem] border-r border-[#0D3A28] bg-[#071A13] text-white lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-white shadow-sm">
                <Image
                  src="/healthdocx-logo.svg"
                  alt="HealthDocX logo"
                  width={44}
                  height={44}
                  priority
                  className="h-10 w-10 rounded-md"
                />
              </div>
              <div>
                <p className="text-lg font-extrabold text-white">HealthDocX</p>
                <p className="text-xs font-semibold text-white/55">Internal ops</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const selected = activeView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition ${
                    selected
                      ? "bg-white text-[#006D34] shadow-sm"
                      : "text-white/64 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <LockKeyhole className="h-4 w-4 text-[#B4F1BD]" />
                Team workspace
              </div>
              <p className="mt-2 text-xs leading-5 text-white/60">
                Keep passwords, tokens, and private customer details out of task titles.
              </p>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-[#C1C9BE]/55 bg-white/96 px-4 py-3 shadow-sm shadow-[#07160F]/[0.04] backdrop-blur md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md border border-[#C1C9BE]/60 bg-white lg:hidden">
                  <Image
                    src="/healthdocx-logo.svg"
                    alt="HealthDocX logo"
                    width={36}
                    height={36}
                    className="h-8 w-8 rounded-md"
                  />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase text-[#008943]">Team operations</p>
                  <h1 className="mt-1 text-2xl font-bold text-[#07160F] md:text-3xl">
                    HealthDocX Team Dashboard
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <BackendSyncBadge status={backendStatus} message={backendMessage} />
                <button
                  type="button"
                  onClick={handleLogout}
                  title={`Signed in as ${authSession.user.name}`}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-[#C1C9BE]/60 bg-white px-3 text-xs font-semibold text-[#414941] shadow-sm transition hover:border-[#008943] hover:bg-[#B4F1BD]/25 hover:text-[#006D34]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
                <div className="relative hidden md:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#717970]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search task, project, owner"
                    className="hdx-control h-10 w-72 pl-9 pr-3 text-sm placeholder:text-[#717970]"
                  />
                </div>
                <IconButton label="Filters">
                  <SlidersHorizontal className="h-4 w-4" />
                </IconButton>
                <PrimaryButton
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setActiveModal("task")}
                >
                  New work item
                </PrimaryButton>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                const selected = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                      selected
                        ? "bg-[#008943] text-white"
                        : "border border-[#C1C9BE]/60 bg-white text-[#414941]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </header>

          <div className="flex-1 p-4 md:p-6">
            {activeView === "command" && (
              <CommandView
                activeProjects={activeProjects.length}
                averageQuality={averageQuality}
                blockedTasks={blockedTasks.length}
                reviewTasks={reviewTasks.length}
                connectedIntegrations={connectedIntegrations.length}
                openTasks={openTasks.length}
                totalWorkItems={totalWorkItems}
                setActiveView={setActiveView}
                projects={projectItems}
                workBatches={workBatchItems}
                integrations={integrationItems}
                auditEvents={auditItems}
                onOpenDetail={setDetailSelection}
              />
            )}

            {activeView === "tasks" && (
              <TasksView
                tasks={filteredTasks}
                projects={projectItems}
                allTasks={tasks}
                priority={priority}
                projectFilter={projectFilter}
                ownerFilter={ownerFilter}
                ownerOptions={ownerOptions}
                onCreateTask={() => setActiveModal("task")}
                onPriorityChange={handlePriorityChange}
                onProjectChange={setProjectFilter}
                onOwnerFilterChange={setOwnerFilter}
                onStatusChange={updateTaskStatus}
                onOwnerChange={updateTaskOwner}
                onOpenDetail={(id) => setDetailSelection({ type: "task", id })}
              />
            )}

            {activeView === "reminders" && (
              <RemindersView
                allTasks={tasks}
                reminderRules={reminderRules}
                reminderLogs={reminderLogs}
                pendingTasksByOwner={pendingTasksByOwner}
                onConfigureReminder={openReminderConfig}
                onSendReminder={sendReminder}
                onSendDueReminders={sendDueReminders}
              />
            )}

            {activeView === "projects" && (
              <ProjectsView
                projects={projectItems}
                workBatches={workBatchItems}
                setActiveView={setActiveView}
                onCreateProject={() => setActiveModal("project")}
                onCreateBatch={() => setActiveModal("batch")}
                onOpenDetail={(id) => setDetailSelection({ type: "project", id })}
                onOpenBatchDetail={(id) => setDetailSelection({ type: "batch", id })}
              />
            )}

            {activeView === "integrations" && (
              <IntegrationsView
                integrations={integrationItems}
                onCreateIntegration={() => setActiveModal("integration")}
                onOpenDetail={(id) => setDetailSelection({ type: "integration", id })}
              />
            )}

            {activeView === "docs" && (
              <DocsView
                docs={docItems}
                onCreateDoc={() => setActiveModal("doc")}
                onOpenDetail={(id) => setDetailSelection({ type: "doc", id })}
              />
            )}

            {activeView === "users" && (
              <UsersView
                users={userItems}
                auditCount={auditItems.length}
                onInviteUser={() => setActiveModal("user")}
                onOpenDetail={(id) => setDetailSelection({ type: "user", id })}
              />
            )}
          </div>
        </section>
      </div>
      <CreateEntityModal
        activeModal={activeModal}
        projects={projectItems}
        ownerOptions={ownerOptions}
        reminderOwner={selectedReminderOwner}
        reminderRules={reminderRules}
        onClose={() => setActiveModal(null)}
        onCreateTask={createTask}
        onCreateProject={createProject}
        onCreateBatch={createBatch}
        onCreateIntegration={createIntegration}
        onCreateDoc={createDoc}
        onInviteUser={inviteUser}
        onConfigureReminder={configureReminder}
      />
      <DetailDrawer
        detail={selectedDetail}
        onClose={() => setDetailSelection(null)}
        onUpdateTaskStatus={updateTaskStatus}
        onUpdateTaskOwner={updateTaskOwner}
        ownerOptions={ownerOptions}
        onUpdateUserAccess={updateUserAccess}
        onUpdateUserStatus={updateUserStatus}
      />
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? ""}
        description={confirmation?.description ?? ""}
        confirmLabel={confirmation?.confirmLabel ?? "Confirm"}
        onConfirm={() => confirmation?.onConfirm()}
        onCancel={() => setConfirmation(null)}
      />
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function CommandView({
  activeProjects,
  averageQuality,
  blockedTasks,
  reviewTasks,
  connectedIntegrations,
  openTasks,
  totalWorkItems,
  setActiveView,
  projects,
  workBatches,
  integrations,
  auditEvents,
  onOpenDetail,
}: {
  activeProjects: number;
  averageQuality: number;
  blockedTasks: number;
  reviewTasks: number;
  connectedIntegrations: number;
  openTasks: number;
  totalWorkItems: number;
  setActiveView: (view: View) => void;
  projects: Project[];
  workBatches: WorkBatch[];
  integrations: Integration[];
  auditEvents: AuditEvent[];
  onOpenDetail: (selection: DetailSelection) => void;
}) {
  return (
    <div className="grid gap-4">
      <CommandHero
        activeProjects={activeProjects}
        averageQuality={averageQuality}
        blockedTasks={blockedTasks}
        connectedIntegrations={connectedIntegrations}
        openTasks={openTasks}
        setActiveView={setActiveView}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Building2 className="h-5 w-5" />}
          label="Active projects"
          value={activeProjects.toString()}
          detail={`${formatNumber(totalWorkItems)} work items in motion`}
          tone="brand"
        />
        <MetricCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Open work"
          value={openTasks.toString()}
          detail={`${blockedTasks} blocked, ${reviewTasks} in review`}
          tone="amber"
        />
        <MetricCard
          icon={<Gauge className="h-5 w-5" />}
          label="Review quality"
          value={`${averageQuality.toFixed(1)}%`}
          detail="Across active project batches"
          tone="cyan"
        />
        <MetricCard
          icon={<Network className="h-5 w-5" />}
          label="Integrations"
          value={`${connectedIntegrations}/${integrations.length}`}
          detail="Connected without open sync issues"
          tone="emerald"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="hdx-panel p-4">
          <SectionHeader
            eyebrow="Project pipeline"
            title="Move projects from planning to launch"
            action={
              <SecondaryButton
                icon={<ArrowRight className="h-4 w-4" />}
                onClick={() => setActiveView("projects")}
              >
                Open pipeline
              </SecondaryButton>
            }
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {projects.length > 0 ? (
              projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  compact
                  onOpen={() => onOpenDetail({ type: "project", id: project.id })}
                />
              ))
            ) : (
              <div className="lg:col-span-2">
                <EmptyState
                  icon={<Building2 className="h-5 w-5" />}
                  title="No projects yet"
                  description="Start the live workspace by creating the first HealthDocX project."
                  action={
                    <SecondaryButton
                      icon={<ArrowRight className="h-4 w-4" />}
                      onClick={() => setActiveView("projects")}
                    >
                      Open projects
                    </SecondaryButton>
                  }
                />
              </div>
            )}
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="hdx-panel p-4">
            <SectionHeader eyebrow="Today" title="Command focus" />
            <div className="mt-4 space-y-3">
              {projects.length === 0 && openTasks === 0 ? (
                <EmptyState
                  icon={<Plus className="h-5 w-5" />}
                  title="Ready for first setup"
                  description="Create a project, then add work items and owners for the team."
                />
              ) : (
                <>
                  <FocusItem
                    icon={<AlertTriangle className="h-4 w-4" />}
                    title="Open work"
                    detail={`${openTasks} work item${openTasks === 1 ? "" : "s"} need owner follow-up.`}
                    tone="red"
                  />
                  <FocusItem
                    icon={<ShieldCheck className="h-4 w-4" />}
                    title="Access review"
                    detail="Keep the six-person team access list current before sharing the live URL."
                    tone="amber"
                  />
                  <FocusItem
                    icon={<Workflow className="h-4 w-4" />}
                    title="Reminder delivery"
                    detail="Email reminders are ready once tasks are assigned."
                    tone="cyan"
                  />
                </>
              )}
            </div>
          </section>

          <section className="hdx-panel p-4">
            <SectionHeader title="Audit trail" />
            <AuditList auditEvents={auditEvents} />
          </section>
        </aside>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="hdx-panel p-4">
          <SectionHeader
            eyebrow="Project work"
            title="Work batches and review throughput"
            action={
              <button
                type="button"
                onClick={() => setActiveView("projects")}
                className="text-sm font-semibold text-[#008943] hover:text-[#006D34]"
              >
                Open projects
              </button>
            }
          />
          <div className="mt-4 space-y-3">
            {workBatches.length > 0 ? (
              workBatches.slice(0, 3).map((batch) => (
                <WorkBatchRow
                  key={batch.id}
                  batch={batch}
                  onOpen={() => onOpenDetail({ type: "batch", id: batch.id })}
                />
              ))
            ) : (
              <EmptyState
                icon={<Layers3 className="h-5 w-5" />}
                title="No work batches yet"
                description="Batches will appear here after a project has work to group and review."
              />
            )}
          </div>
        </section>

        <section className="hdx-panel p-4">
          <SectionHeader
            eyebrow="Integrations"
            title="Integration health"
            action={
              <button
                type="button"
                onClick={() => setActiveView("integrations")}
                className="text-sm font-semibold text-[#008943] hover:text-[#006D34]"
              >
                View integrations
              </button>
            }
          />
          <div className="mt-4 space-y-3">
            {integrations.length > 0 ? (
              integrations.slice(0, 3).map((integration) => (
                <IntegrationRow
                  key={integration.id}
                  integration={integration}
                  compact
                  onOpen={() => onOpenDetail({ type: "integration", id: integration.id })}
                />
              ))
            ) : (
              <EmptyState
                icon={<Network className="h-5 w-5" />}
                title="No integrations yet"
                description="Add integrations only when a project needs a system connection."
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CommandHero({
  activeProjects,
  averageQuality,
  blockedTasks,
  connectedIntegrations,
  openTasks,
  setActiveView,
}: {
  activeProjects: number;
  averageQuality: number;
  blockedTasks: number;
  connectedIntegrations: number;
  openTasks: number;
  setActiveView: (view: View) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#0D3A28] bg-[#071A13] text-white shadow-xl shadow-[#062218]/12">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 text-xs font-bold text-[#B4F1BD]">
              <Users className="h-3.5 w-3.5" />
              HealthDocX team
            </span>
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 text-xs font-bold text-white/78">
              <ShieldCheck className="h-3.5 w-3.5" />
              Safe workspace
            </span>
          </div>
          <h2 className="mt-5 max-w-3xl text-2xl font-bold leading-tight md:text-3xl">
            {openTasks} open work items across {activeProjects} active projects.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
            {blockedTasks} blocked item{blockedTasks === 1 ? "" : "s"}, {averageQuality.toFixed(1)}% review quality, and {connectedIntegrations} connected integration{connectedIntegrations === 1 ? "" : "s"}.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveView("tasks")}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-3.5 text-sm font-bold text-[#006D34] transition hover:bg-[#EEF7EE]"
            >
              Open work queue
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveView("projects")}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3.5 text-sm font-bold text-white transition hover:bg-white/15"
            >
              Project pipeline
              <Building2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <HeroStat label="Open work" value={openTasks.toString()} detail={`${blockedTasks} blocked`} />
          <HeroStat label="Projects" value={activeProjects.toString()} detail="In active motion" />
          <HeroStat label="Review quality" value={`${averageQuality.toFixed(1)}%`} detail="Average score" />
          <HeroStat label="Integrations" value={connectedIntegrations.toString()} detail="Connected systems" />
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.08] p-3">
      <p className="text-xs font-bold text-white/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/60">{detail}</p>
    </div>
  );
}

function TasksView({
  tasks,
  projects,
  allTasks,
  priority,
  projectFilter,
  ownerFilter,
  ownerOptions,
  onCreateTask,
  onPriorityChange,
  onProjectChange,
  onOwnerFilterChange,
  onStatusChange,
  onOwnerChange,
  onOpenDetail,
}: {
  tasks: Task[];
  projects: Project[];
  allTasks: Task[];
  priority: Priority | "All";
  projectFilter: string;
  ownerFilter: string;
  ownerOptions: string[];
  onCreateTask: () => void;
  onPriorityChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onProjectChange: (project: string) => void;
  onOwnerFilterChange: (owner: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onOwnerChange: (id: string, owner: string) => void;
  onOpenDetail: (id: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <section className="hdx-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader eyebrow="Work queue" title="Tasks, blockers, owners, and review" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="priority-filter">
              Priority
            </label>
            <select
              id="priority-filter"
              value={priority}
              onChange={onPriorityChange}
              className="hdx-control h-9 px-3 text-sm"
            >
              <option>All</option>
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>

            <label className="sr-only" htmlFor="project-filter">
              Project
            </label>
            <select
              id="project-filter"
              value={projectFilter}
              onChange={(event) => onProjectChange(event.target.value)}
              className="hdx-control h-9 px-3 text-sm"
            >
              <option>All</option>
              {projects.map((project) => (
                <option key={project.id}>{project.name}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="owner-filter">
              Owner
            </label>
            <select
              id="owner-filter"
              value={ownerFilter}
              onChange={(event) => onOwnerFilterChange(event.target.value)}
              className="hdx-control h-9 px-3 text-sm"
            >
              <option>All</option>
              {ownerOptions.map((owner) => (
                <option key={owner}>{owner}</option>
              ))}
            </select>
          </div>
        </div>

        <TaskWorkflowSummary tasks={allTasks} />

        <TaskBoard
          tasks={tasks}
          onCreateTask={onCreateTask}
          onStatusChange={onStatusChange}
          onOwnerChange={onOwnerChange}
          ownerOptions={ownerOptions}
          onOpenDetail={onOpenDetail}
        />
      </section>
    </div>
  );
}

function TaskWorkflowSummary({ tasks }: { tasks: Task[] }) {
  const openTasks = tasks.filter((task) => task.status !== "Done");
  const overdueTasks = openTasks.filter((task) => getTaskDueState(task) === "Overdue");
  const dueTodayTasks = openTasks.filter((task) => getTaskDueState(task) === "Due today");
  const privateDetailCleanupTasks = openTasks.filter((task) => !task.privateDetailsClear || hasPrivateDetailsRisk(task.title));
  const blockedTasks = openTasks.filter((task) => task.status === "Blocked");

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <WorkflowRuleCard
        label="Overdue"
        value={overdueTasks.length.toString()}
        detail={`${dueTodayTasks.length} due today`}
        tone={overdueTasks.length > 0 ? "red" : "green"}
      />
      <WorkflowRuleCard
        label="Private details"
        value={privateDetailCleanupTasks.length.toString()}
        detail="Clean before review"
        tone={privateDetailCleanupTasks.length > 0 ? "amber" : "green"}
      />
      <WorkflowRuleCard
        label="Blocked"
        value={blockedTasks.length.toString()}
        detail="Can reopen to Backlog or In progress"
        tone={blockedTasks.length > 0 ? "amber" : "green"}
      />
      <WorkflowRuleCard
        label="Done gate"
        value="Review"
        detail="Done only follows Review"
        tone="green"
      />
    </div>
  );
}

function WorkflowRuleCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "amber" | "red";
}) {
  const toneClass = {
    green: "border-[#B4F1BD] bg-[#B4F1BD]/20 text-[#006D34]",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs">{detail}</p>
    </div>
  );
}

function RemindersView({
  allTasks,
  reminderRules,
  reminderLogs,
  pendingTasksByOwner,
  onConfigureReminder,
  onSendReminder,
  onSendDueReminders,
}: {
  allTasks: Task[];
  reminderRules: ReminderRule[];
  reminderLogs: ReminderLog[];
  pendingTasksByOwner: Record<string, Task[]>;
  onConfigureReminder: (owner: string) => void;
  onSendReminder: (owner: string) => void;
  onSendDueReminders: () => void;
}) {
  return (
    <ReminderCenter
      allTasks={allTasks}
      reminderRules={reminderRules}
      reminderLogs={reminderLogs}
      pendingTasksByOwner={pendingTasksByOwner}
      onConfigureReminder={onConfigureReminder}
      onSendReminder={onSendReminder}
      onSendDueReminders={onSendDueReminders}
    />
  );
}

function ReminderCenter({
  allTasks,
  reminderRules,
  reminderLogs,
  pendingTasksByOwner,
  onConfigureReminder,
  onSendReminder,
  onSendDueReminders,
}: {
  allTasks: Task[];
  reminderRules: ReminderRule[];
  reminderLogs: ReminderLog[];
  pendingTasksByOwner: Record<string, Task[]>;
  onConfigureReminder: (owner: string) => void;
  onSendReminder: (owner: string) => void;
  onSendDueReminders: () => void;
}) {
  const totalPending = allTasks.filter((task) => task.status !== "Done").length;
  const totalOverdue = allTasks.filter((task) => getTaskDueState(task) === "Overdue").length;
  const enabledSchedules = reminderRules.filter((rule) => rule.enabled).length;
  const latestLogs = reminderLogs.slice(0, 4);

  return (
    <section className="hdx-panel p-4 transition hover:-translate-y-0.5">
      <SectionHeader
        eyebrow="Reminders"
        title="Pending task reminders"
        action={
          <PrimaryButton icon={<Send className="h-4 w-4" />} onClick={onSendDueReminders}>
            Send due reminders
          </PrimaryButton>
        }
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ReminderMetric
          icon={<ClipboardList className="h-4 w-4" />}
          label="Pending tasks"
          value={totalPending.toString()}
          detail="Across all owners"
        />
        <ReminderMetric
          icon={<Clock3 className="h-4 w-4" />}
          label="Overdue"
          value={totalOverdue.toString()}
          detail="Needs owner follow-up"
        />
        <ReminderMetric
          icon={<BellRing className="h-4 w-4" />}
          label="Enabled schedules"
          value={`${enabledSchedules}/${reminderRules.length}`}
          detail="Daily, twice daily, or weekly"
        />
        <ReminderMetric
          icon={<Mail className="h-4 w-4" />}
          label="Sent this session"
          value={reminderLogs.length.toString()}
          detail="Email delivery"
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 lg:grid-cols-2">
          {reminderRules.map((rule) => {
            const pendingTasks = pendingTasksByOwner[rule.owner] ?? [];
            const overdueTasks = pendingTasks.filter((task) => getTaskDueState(task) === "Overdue");

            return (
              <article
                key={rule.owner}
                className="hdx-subpanel p-3 transition hover:border-[#008943]/45 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#008943] text-xs font-semibold text-white">
                      {initials(rule.owner)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0E1F12]">{rule.owner}</p>
                      <p className="mt-1 text-xs text-[#717970]">
                        {pendingTasks.length} pending task{pendingTasks.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {overdueTasks.length > 0 ? (
                      <Badge className="border-red-200 bg-red-50 text-red-700">
                        {overdueTasks.length} overdue
                      </Badge>
                    ) : null}
                    <Badge
                      className={
                        rule.enabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-[#C1C9BE]/70 bg-white text-[#414941]"
                      }
                    >
                      {rule.enabled ? "Enabled" : "Paused"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <MiniStat label="Cadence" value={rule.cadence} />
                  <MiniStat label="Channel" value={rule.channel} />
                  <MiniStat label="Next run" value={rule.nextRun} />
                  <MiniStat label="Last sent" value={rule.lastSent} />
                </div>

                {pendingTasks.length > 0 ? (
                  <div className="mt-3 rounded-md border border-[#C1C9BE]/55 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-[#717970]">Pending now</p>
                    <div className="mt-2 space-y-1">
                      {pendingTasks.slice(0, 2).map((task) => (
                        <p key={task.id} className="truncate text-xs font-medium text-[#414941]">
                          {task.id} / {task.title}
                        </p>
                      ))}
                      {pendingTasks.length > 2 ? (
                        <p className="text-xs font-semibold text-[#008943]">
                          +{pendingTasks.length - 2} more
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSendReminder(rule.owner)}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-[#008943] px-3 text-xs font-semibold text-white shadow-sm shadow-[#008943]/15 transition hover:bg-[#006D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008943]/20"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send now
                  </button>
                  <button
                    type="button"
                    onClick={() => onConfigureReminder(rule.owner)}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-[#C1C9BE]/55 bg-white px-3 text-xs font-semibold text-[#414941] shadow-sm transition hover:border-[#008943] hover:bg-[#B4F1BD]/25 hover:text-[#006D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008943]/20"
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    Configure
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="hdx-subpanel p-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#008943]" />
            <h3 className="text-sm font-semibold text-[#0E1F12]">Reminder log</h3>
          </div>

          {latestLogs.length === 0 ? (
            <div className="mt-3 rounded-md border border-dashed border-[#C1C9BE] bg-white p-4 text-sm leading-6 text-[#717970]">
              No reminders have been sent in this local session.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {latestLogs.map((log) => (
                <div key={log.id} className="rounded-md border border-[#C1C9BE]/55 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0E1F12]">{log.owner}</p>
                      <p className="mt-1 text-xs text-[#717970]">
                        {log.taskCount} task{log.taskCount === 1 ? "" : "s"} via {log.channel}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#008943]">{log.sentAt}</span>
                  </div>
                  <p className="mt-2 text-xs text-[#414941]">{log.cadence} schedule</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ReminderMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="hdx-subpanel p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#717970]">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-[#0E1F12]">{value}</p>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[#B4F1BD]/30 text-[#008943]">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-xs text-[#717970]">{detail}</p>
    </div>
  );
}

function ProjectsView({
  projects,
  workBatches,
  setActiveView,
  onCreateProject,
  onCreateBatch,
  onOpenDetail,
  onOpenBatchDetail,
}: {
  projects: Project[];
  workBatches: WorkBatch[];
  setActiveView: (view: View) => void;
  onCreateProject: () => void;
  onCreateBatch: () => void;
  onOpenDetail: (id: string) => void;
  onOpenBatchDetail: (id: string) => void;
}) {
  const [sortBy, setSortBy] = useState<"risk" | "workItems" | "progress">("risk");
  const [batchSortBy, setBatchSortBy] = useState<"reviewItems" | "items" | "accuracy">(
    "reviewItems",
  );
  const riskRank: Record<Risk, number> = { Blocked: 0, Watch: 1, Healthy: 2 };
  const sortedProjects = [...projects].sort((left, right) => {
    if (sortBy === "workItems") {
      return right.workItems - left.workItems;
    }

    if (sortBy === "progress") {
      return right.progress - left.progress;
    }

    return riskRank[left.risk] - riskRank[right.risk];
  });
  const reviewItemTotal = workBatches.reduce((sum, batch) => sum + batch.reviewItems, 0);
  const itemTotal = workBatches.reduce((sum, batch) => sum + batch.items, 0);
  const readyBatches = workBatches.filter((batch) => batch.status === "Ready").length;
  const sortedBatches = [...workBatches].sort((left, right) => {
    if (batchSortBy === "items") {
      return right.items - left.items;
    }

    if (batchSortBy === "accuracy") {
      return left.qualityScore - right.qualityScore;
    }

    return right.reviewItems - left.reviewItems;
  });

  return (
    <div className="grid gap-4">
      <section className="hdx-panel p-4">
        <SectionHeader
          eyebrow="Project lifecycle"
          title="Active project pipeline"
          action={
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="h-10 rounded-md border border-[#C1C9BE]/55 bg-white px-3 text-sm font-semibold text-[#414941] outline-none focus:border-[#008943]"
              >
                <option value="risk">Risk first</option>
                <option value="workItems">Most work items</option>
                <option value="progress">Most progressed</option>
              </select>
              <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={onCreateProject}>
                Add project
              </PrimaryButton>
            </div>
          }
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sortedProjects.length > 0 ? (
            sortedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => onOpenDetail(project.id)}
              />
            ))
          ) : (
            <div className="lg:col-span-2">
              <EmptyState
                icon={<Building2 className="h-5 w-5" />}
                title="No projects yet"
                description="Create the first project to begin assigning work, batches, docs, and integrations."
                action={
                  <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={onCreateProject}>
                    Add project
                  </PrimaryButton>
                }
              />
            </div>
          )}
        </div>
      </section>

      <section className="hdx-panel p-4">
        <SectionHeader
          eyebrow="Implementation controls"
          title="What each project needs before launch"
          action={
            <SecondaryButton icon={<DatabaseZap className="h-4 w-4" />}>
              Export report
            </SecondaryButton>
          }
        />
        {sortedProjects.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-md border border-[#C1C9BE]/70">
            <table className="w-full min-w-[840px] border-collapse text-sm">
              <thead className="bg-[#F3F8F3] text-left text-xs uppercase text-[#717970]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Project</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">Work items</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Risk</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C1C9BE]/70">
                {sortedProjects.map((project) => (
                  <tr key={project.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#0E1F12]">{project.name}</p>
                      <p className="mt-1 text-xs text-[#717970]">{project.area}</p>
                    </td>
                    <td className="px-4 py-4 text-[#414941]">{project.stage}</td>
                    <td className="px-4 py-4 text-[#414941]">{project.owner}</td>
                    <td className="px-4 py-4 text-[#414941]">{project.workItems}</td>
                    <td className="px-4 py-4 text-[#414941]">{project.targetDate}</td>
                    <td className="px-4 py-4">
                      <Badge className={riskStyles[project.risk]}>{project.risk}</Badge>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(project.id)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-[#C1C9BE]/70 px-3 text-sm font-semibold text-[#414941] transition hover:border-[#008943] hover:bg-[#B4F1BD]/25 hover:text-[#006D34]"
                      >
                        Details
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={<FileCheck2 className="h-5 w-5" />}
              title="No launch controls yet"
              description="Project controls will populate after the first project is added."
            />
          </div>
        )}
      </section>

      <section className="hdx-panel p-4">
        <SectionHeader
          eyebrow="Project work"
          title="Work batches inside each project"
          action={
            <div className="flex items-center gap-2">
              <select
                value={batchSortBy}
                onChange={(event) => setBatchSortBy(event.target.value as typeof batchSortBy)}
                className="h-10 rounded-md border border-[#C1C9BE]/55 bg-white px-3 text-sm font-semibold text-[#414941] outline-none focus:border-[#008943]"
              >
                <option value="reviewItems">Most review items</option>
                <option value="items">Largest batch</option>
                <option value="accuracy">Lowest quality</option>
              </select>
              <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={onCreateBatch}>
                New batch
              </PrimaryButton>
            </div>
          }
        />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="hdx-subpanel p-3">
            <p className="text-xs font-semibold uppercase text-[#717970]">Items in motion</p>
            <p className="mt-1 text-2xl font-semibold text-[#0E1F12]">
              {formatNumber(itemTotal)}
            </p>
          </div>
          <div className="hdx-subpanel p-3">
            <p className="text-xs font-semibold uppercase text-[#717970]">Review items</p>
            <p className="mt-1 text-2xl font-semibold text-[#0E1F12]">{reviewItemTotal}</p>
          </div>
          <div className="hdx-subpanel p-3">
            <p className="text-xs font-semibold uppercase text-[#717970]">Ready batches</p>
            <p className="mt-1 text-2xl font-semibold text-[#0E1F12]">{readyBatches}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sortedBatches.length > 0 ? (
            sortedBatches.map((batch) => (
              <WorkBatchRow
                key={batch.id}
                batch={batch}
                onOpen={() => onOpenBatchDetail(batch.id)}
              />
            ))
          ) : (
            <div className="lg:col-span-2">
              <EmptyState
                icon={<Layers3 className="h-5 w-5" />}
                title="No work batches yet"
                description="Create batches after a project has grouped work that needs review."
              />
            </div>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={() => setActiveView("tasks")}
        className="justify-self-start text-sm font-semibold text-[#008943] hover:text-[#006D34]"
      >
        Review project-related work queue
      </button>
    </div>
  );
}

function IntegrationsView({
  integrations,
  onCreateIntegration,
  onOpenDetail,
}: {
  integrations: Integration[];
  onCreateIntegration: () => void;
  onOpenDetail: (id: string) => void;
}) {
  const [sortBy, setSortBy] = useState<"issues" | "progress" | "status">("issues");
  const integrationStatusRank: Record<Integration["status"], number> = {
    "Needs credentials": 0,
    "Sync warning": 1,
    Mapping: 2,
    Connected: 3,
  };
  const sortedIntegrations = [...integrations].sort((left, right) => {
    if (sortBy === "progress") {
      return left.mappingProgress - right.mappingProgress;
    }

    if (sortBy === "status") {
      return integrationStatusRank[left.status] - integrationStatusRank[right.status];
    }

    return right.openIssues - left.openIssues;
  });

  return (
    <section className="hdx-panel p-4">
      <SectionHeader
        eyebrow="Integration"
        title="Connection status, mapping progress, and sync risk"
        action={
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              className="h-10 rounded-md border border-[#C1C9BE]/55 bg-white px-3 text-sm font-semibold text-[#414941] outline-none focus:border-[#008943]"
            >
              <option value="issues">Most issues</option>
              <option value="progress">Least mapped</option>
              <option value="status">Risk status</option>
            </select>
            <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={onCreateIntegration}>
              New integration
            </PrimaryButton>
          </div>
        }
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {sortedIntegrations.length > 0 ? (
          sortedIntegrations.map((integration) => (
            <IntegrationPanel
              key={integration.id}
              integration={integration}
              onOpen={() => onOpenDetail(integration.id)}
            />
          ))
        ) : (
          <div className="lg:col-span-2">
            <EmptyState
              icon={<Network className="h-5 w-5" />}
              title="No integrations yet"
              description="Connect systems only after the team has a project that needs one."
              action={
                <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={onCreateIntegration}>
                  New integration
                </PrimaryButton>
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}

function DocsView({
  docs,
  onCreateDoc,
  onOpenDetail,
}: {
  docs: KnowledgeDoc[];
  onCreateDoc: () => void;
  onOpenDetail: (id: string) => void;
}) {
  const [sortBy, setSortBy] = useState<"review" | "title" | "area">("review");
  const docStatusRank: Record<KnowledgeDoc["status"], number> = {
    "Needs review": 0,
    Draft: 1,
    Published: 2,
  };
  const sortedDocs = [...docs].sort((left, right) => {
    if (sortBy === "title") {
      return left.title.localeCompare(right.title);
    }

    if (sortBy === "area") {
      return left.area.localeCompare(right.area);
    }

    return docStatusRank[left.status] - docStatusRank[right.status];
  });

  return (
    <section className="hdx-panel p-4">
      <SectionHeader
        eyebrow="Knowledge base"
        title="Runbooks, API docs, implementation notes, and security policies"
        action={
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              className="h-10 rounded-md border border-[#C1C9BE]/55 bg-white px-3 text-sm font-semibold text-[#414941] outline-none focus:border-[#008943]"
            >
              <option value="review">Needs review first</option>
              <option value="title">Title</option>
              <option value="area">Area</option>
            </select>
            <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={onCreateDoc}>
              New doc
            </PrimaryButton>
          </div>
        }
      />
      {sortedDocs.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-md border border-[#C1C9BE]/70">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-[#F3F8F3] text-left text-xs uppercase text-[#717970]">
              <tr>
                <th className="px-4 py-3 font-semibold">Document</th>
                <th className="px-4 py-3 font-semibold">Area</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#C1C9BE]/70">
              {sortedDocs.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-md bg-[#B4F1BD]/25 text-[#008943]">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0E1F12]">{doc.title}</p>
                        <p className="mt-1 text-xs text-[#717970]">{doc.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[#414941]">{doc.area}</td>
                  <td className="px-4 py-4 text-[#414941]">{doc.owner}</td>
                  <td className="px-4 py-4 text-[#414941]">{doc.updated}</td>
                  <td className="px-4 py-4">
                    <Badge className={docStatusStyles[doc.status]}>{doc.status}</Badge>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <IconButton label={`Open ${doc.title}`} onClick={() => onOpenDetail(doc.id)}>
                      <ArrowRight className="h-4 w-4" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            icon={<BookOpenText className="h-5 w-5" />}
            title="No documents yet"
            description="Add runbooks, policies, or technical notes after the live workspace is set up."
            action={
              <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={onCreateDoc}>
                New doc
              </PrimaryButton>
            }
          />
        </div>
      )}
    </section>
  );
}

function UsersView({
  users,
  auditCount,
  onInviteUser,
  onOpenDetail,
}: {
  users: TeamUser[];
  auditCount: number;
  onInviteUser: () => void;
  onOpenDetail: (id: string) => void;
}) {
  const owners = users.filter((user) => user.access === "Owner").length;
  const admins = users.filter((user) => user.access === "Admin").length;
  const reviewers = users.filter((user) => user.access === "Reviewer").length;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AccessTile icon={<KeyRound className="h-5 w-5" />} label="Owners" value={owners.toString()} />
        <AccessTile icon={<ShieldCheck className="h-5 w-5" />} label="Admins" value={admins.toString()} />
        <AccessTile
          icon={<UserCog className="h-5 w-5" />}
          label="Reviewers"
          value={reviewers.toString()}
        />
        <AccessTile icon={<History className="h-5 w-5" />} label="Audit events" value={auditCount.toString()} />
      </div>

      <section className="hdx-panel p-4">
        <SectionHeader
          eyebrow="Access control"
          title="Team, role, and project access management"
          action={
            <PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={onInviteUser}>
              Invite user
            </PrimaryButton>
          }
        />
        <div className="mt-4 overflow-x-auto rounded-md border border-[#C1C9BE]/70">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead className="bg-[#F3F8F3] text-left text-xs uppercase text-[#717970]">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Team</th>
                <th className="px-4 py-3 font-semibold">Access</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#C1C9BE]/70">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-md bg-[#008943] text-xs font-semibold text-white">
                        {initials(user.name)}
                      </div>
                      <div>
                        <p className="font-semibold text-[#0E1F12]">{user.name}</p>
                        <p className="mt-1 text-xs text-[#717970]">{user.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[#414941]">{user.team}</td>
                  <td className="px-4 py-4">
                    <Badge className={accessStyles[user.access]}>{user.access}</Badge>
                  </td>
                  <td className="px-4 py-4 text-[#414941]">{user.status}</td>
                  <td className="px-4 py-4 text-right">
                    <IconButton label={`Manage ${user.name}`} onClick={() => onOpenDetail(user.id)}>
                      <UserCog className="h-4 w-4" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-[#B4F1BD] bg-[#B4F1BD]/25 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#008943]" />
          <div>
            <h3 className="text-sm font-semibold text-[#0E1F12]">Data boundary</h3>
            <p className="mt-1 text-sm leading-6 text-[#414941]">
              This workspace tracks team operations metadata. Keep private customer data in source systems until backend permissions are ready.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function CreateEntityModal({
  activeModal,
  projects,
  ownerOptions,
  reminderOwner,
  reminderRules,
  onClose,
  onCreateTask,
  onCreateProject,
  onCreateBatch,
  onCreateIntegration,
  onCreateDoc,
  onInviteUser,
  onConfigureReminder,
}: {
  activeModal: ActiveModal;
  projects: Project[];
  ownerOptions: string[];
  reminderOwner: string;
  reminderRules: ReminderRule[];
  onClose: () => void;
  onCreateTask: (input: Omit<Task, "id" | "comments">) => void;
  onCreateProject: (input: Omit<Project, "id">) => void;
  onCreateBatch: (input: Omit<WorkBatch, "id" | "qualityScore" | "reviewItems">) => void;
  onCreateIntegration: (
    input: Omit<Integration, "id" | "mappingProgress" | "lastSync" | "openIssues">,
  ) => void;
  onCreateDoc: (input: Omit<KnowledgeDoc, "id" | "updated">) => void;
  onInviteUser: (input: Omit<TeamUser, "id" | "status">) => void;
  onConfigureReminder: (input: ReminderRule) => void;
}) {
  const projectNames = projects.map((project) => project.name);
  const selectedReminderRule =
    reminderRules.find((rule) => rule.owner === reminderOwner) ??
    {
      owner: reminderOwner,
      cadence: "Daily" as const,
      channel: "Email" as const,
      enabled: true,
      nextRun: "Tomorrow 09:00",
      lastSent: "Not sent",
    };

  if (
    projectNames.length === 0 &&
    (activeModal === "task" || activeModal === "batch" || activeModal === "integration")
  ) {
    return <ProjectRequiredModal onClose={onClose} />;
  }

  if (
    ownerOptions.length === 0 &&
    (activeModal === "task" || activeModal === "project" || activeModal === "doc")
  ) {
    return <UserRequiredModal onClose={onClose} />;
  }

  if (activeModal === "task") {
    return (
      <TaskFormModal
        projects={projectNames}
        ownerOptions={ownerOptions}
        onClose={onClose}
        onSubmit={onCreateTask}
      />
    );
  }

  if (activeModal === "project") {
    return (
      <ProjectFormModal
        ownerOptions={ownerOptions}
        onClose={onClose}
        onSubmit={onCreateProject}
      />
    );
  }

  if (activeModal === "batch") {
    return (
      <BatchFormModal
        projects={projectNames}
        onClose={onClose}
        onSubmit={onCreateBatch}
      />
    );
  }

  if (activeModal === "integration") {
    return (
      <IntegrationFormModal
        projects={projectNames}
        onClose={onClose}
        onSubmit={onCreateIntegration}
      />
    );
  }

  if (activeModal === "doc") {
    return <DocFormModal ownerOptions={ownerOptions} onClose={onClose} onSubmit={onCreateDoc} />;
  }

  if (activeModal === "user") {
    return <InviteUserModal onClose={onClose} onSubmit={onInviteUser} />;
  }

  if (activeModal === "reminder") {
    return (
      <ReminderFormModal
        rule={selectedReminderRule}
        onClose={onClose}
        onSubmit={onConfigureReminder}
      />
    );
  }

  return null;
}

function ProjectRequiredModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open
      title="Create a project first"
      description="Tasks, work batches, and integrations need a project to belong to."
      onClose={onClose}
    >
      <div className="grid gap-4">
        <InlineNotice
          tone="green"
          title="Fresh workspace"
          detail="The live database starts clean. Add the first project from the Projects page, then create work items for it."
        />
        <div className="flex justify-end">
          <PrimaryButton icon={<ArrowRight className="h-4 w-4" />} onClick={onClose}>
            Go back
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function UserRequiredModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open
      title="Create a user first"
      description="Tasks, projects, and documents need a real owner."
      onClose={onClose}
    >
      <div className="grid gap-4">
        <InlineNotice
          tone="green"
          title="Fresh workspace"
          detail="Create the first admin on the login screen, then invite the correct team members from Access."
        />
        <div className="flex justify-end">
          <PrimaryButton icon={<ArrowRight className="h-4 w-4" />} onClick={onClose}>
            Go back
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function ModalActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-[#C1C9BE]/70 pt-4">
      <SecondaryButton icon={<ArrowRight className="h-4 w-4 rotate-180" />} onClick={onCancel}>
        Cancel
      </SecondaryButton>
      <PrimaryButton icon={<Plus className="h-4 w-4" />} type="submit">
        Save
      </PrimaryButton>
    </div>
  );
}

function TaskFormModal({
  projects,
  ownerOptions,
  onClose,
  onSubmit,
}: {
  projects: string[];
  ownerOptions: string[];
  onClose: () => void;
  onSubmit: (input: Omit<Task, "id" | "comments">) => void;
}) {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState(projects[0] ?? "");
  const [workstream, setWorkstream] = useState<Task["workstream"]>("Project Ops");
  const [owner, setOwner] = useState(ownerOptions[0] ?? "");
  const [priority, setPriority] = useState<Priority>("High");
  const [due, setDue] = useState("Jul 30");
  const [privateDetailsClear, setPrivateDetailsClear] = useState(true);
  const [error, setError] = useState("");
  const privateDetailsRisk = hasPrivateDetailsRisk(title);

  return (
    <Modal
      open
      title="New work item"
      description="Create a simple task for the HealthDocX team."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const validation = validateTaskInput({ title, due, privateDetailsClear });

          if (!validation.valid) {
            setError(validation.message ?? "Check the task details before saving.");
            return;
          }

          setError("");
          onSubmit({
            title: title.trim(),
            project,
            workstream,
            owner,
            status: "Backlog",
            priority,
            due: due.trim(),
            privateDetailsClear,
          });
        }}
        className="grid gap-4"
      >
        <InlineNotice
          tone="green"
          title="Workflow rule"
          detail="New work starts in Backlog. Completion is only available after review, and tasks with private details must be cleaned before completion."
        />
        {privateDetailsRisk ? (
          <InlineNotice
            tone="red"
            title="Possible private detail"
            detail="Remove passwords, tokens, email addresses, phone numbers, IDs, or private customer details from this task."
          />
        ) : null}
        {error ? <InlineNotice tone="red" title="Cannot save task" detail={error} /> : null}
        <TextField label="Task title" value={title} onChange={setTitle} required />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Project" value={project} options={projects} onChange={setProject} />
          <SelectField label="Workstream" value={workstream} options={workstreamOptions} onChange={setWorkstream} />
          <SelectField label="Owner" value={owner} options={ownerOptions} onChange={setOwner} />
          <SelectField label="Priority" value={priority} options={priorityOptions} onChange={setPriority} />
          <TextField label="Due date" value={due} onChange={setDue} required />
          <CheckboxField label="No private details in task text" checked={privateDetailsClear} onChange={setPrivateDetailsClear} />
        </div>
        <ModalActions onCancel={onClose} />
      </form>
    </Modal>
  );
}

function ProjectFormModal({
  ownerOptions,
  onClose,
  onSubmit,
}: {
  ownerOptions: string[];
  onClose: () => void;
  onSubmit: (input: Omit<Project, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("Operations");
  const [stage, setStage] = useState<Project["stage"]>("Planning");
  const [owner, setOwner] = useState(ownerOptions[0] ?? "");
  const [risk, setRisk] = useState<Risk>("Healthy");
  const [workItems, setWorkItems] = useState("1");
  const [progress, setProgress] = useState("5");
  const [targetDate, setTargetDate] = useState("Jul 18");

  return (
    <Modal
      open
      title="Add project"
      description="Add a HealthDocX internal project to the pipeline."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            name,
            area,
            stage,
            owner,
            risk,
            workItems: Number(workItems),
            progress: Number(progress),
            targetDate,
          });
        }}
        className="grid gap-4"
      >
        <TextField label="Project name" value={name} onChange={setName} required />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Area" value={area} onChange={setArea} required />
          <SelectField label="Stage" value={stage} options={stageOptions} onChange={setStage} />
          <SelectField label="Owner" value={owner} options={ownerOptions} onChange={setOwner} />
          <SelectField label="Risk" value={risk} options={riskOptions} onChange={setRisk} />
          <TextField label="Work items" value={workItems} onChange={setWorkItems} type="number" />
          <TextField label="Progress %" value={progress} onChange={setProgress} type="number" />
          <TextField label="Target date" value={targetDate} onChange={setTargetDate} required />
        </div>
        <ModalActions onCancel={onClose} />
      </form>
    </Modal>
  );
}

function BatchFormModal({
  projects,
  onClose,
  onSubmit,
}: {
  projects: string[];
  onClose: () => void;
  onSubmit: (input: Omit<WorkBatch, "id" | "qualityScore" | "reviewItems">) => void;
}) {
  const [project, setProject] = useState(projects[0] ?? "");
  const [team, setTeam] = useState("Operations");
  const [workType, setWorkType] = useState("Launch checklist");
  const [items, setItems] = useState("0");
  const [status, setStatus] = useState<WorkBatch["status"]>("Queued");

  return (
    <Modal open title="New work batch" description="Create a batch for tracking project work." onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            project,
            team,
            workType,
            items: Number(items),
            status,
          });
        }}
        className="grid gap-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Project" value={project} options={projects} onChange={setProject} />
          <TextField label="Team" value={team} onChange={setTeam} required />
          <TextField label="Work type" value={workType} onChange={setWorkType} required />
          <TextField label="Items" value={items} onChange={setItems} type="number" />
          <SelectField label="Status" value={status} options={batchStatusOptions} onChange={setStatus} />
        </div>
        <ModalActions onCancel={onClose} />
      </form>
    </Modal>
  );
}

function IntegrationFormModal({
  projects,
  onClose,
  onSubmit,
}: {
  projects: string[];
  onClose: () => void;
  onSubmit: (
    input: Omit<Integration, "id" | "mappingProgress" | "lastSync" | "openIssues">,
  ) => void;
}) {
  const [project, setProject] = useState(projects[0] ?? "");
  const [system, setSystem] = useState("Email");
  const [method, setMethod] = useState<Integration["method"]>("API");
  const [status, setStatus] = useState<Integration["status"]>("Mapping");

  return (
    <Modal open title="New integration" description="Track a system connection for a project." onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ project, system, method, status });
        }}
        className="grid gap-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Project" value={project} options={projects} onChange={setProject} />
          <TextField label="System" value={system} onChange={setSystem} required />
          <SelectField label="Method" value={method} options={integrationMethodOptions} onChange={setMethod} />
          <SelectField label="Status" value={status} options={integrationStatusOptions} onChange={setStatus} />
        </div>
        <ModalActions onCancel={onClose} />
      </form>
    </Modal>
  );
}

function DocFormModal({
  ownerOptions,
  onClose,
  onSubmit,
}: {
  ownerOptions: string[];
  onClose: () => void;
  onSubmit: (input: Omit<KnowledgeDoc, "id" | "updated">) => void;
}) {
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<KnowledgeDoc["area"]>("Runbook");
  const [owner, setOwner] = useState(ownerOptions[0] ?? "");
  const [status, setStatus] = useState<KnowledgeDoc["status"]>("Draft");

  return (
    <Modal open title="New document" description="Register an internal runbook, policy, or API note." onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ title, area, owner, status });
        }}
        className="grid gap-4"
      >
        <TextField label="Document title" value={title} onChange={setTitle} required />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Area" value={area} options={docAreaOptions} onChange={setArea} />
          <SelectField label="Owner" value={owner} options={ownerOptions} onChange={setOwner} />
          <SelectField label="Status" value={status} options={docStatusOptions} onChange={setStatus} />
        </div>
        <ModalActions onCancel={onClose} />
      </form>
    </Modal>
  );
}

function InviteUserModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: Omit<TeamUser, "id" | "status">) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [team, setTeam] = useState<TeamUser["team"]>("Operations");
  const [access, setAccess] = useState<TeamUser["access"]>("Viewer");

  return (
    <Modal open title="Invite user" description="Invite a team member with scoped access." onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ name, role, team, access });
        }}
        className="grid gap-4"
      >
        <TextField label="Full name" value={name} onChange={setName} required />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Role" value={role} onChange={setRole} required />
          <SelectField label="Team" value={team} options={teamOptions} onChange={setTeam} />
          <SelectField label="Access" value={access} options={accessOptions} onChange={setAccess} />
        </div>
        <ModalActions onCancel={onClose} />
      </form>
    </Modal>
  );
}

function ReminderFormModal({
  rule,
  onClose,
  onSubmit,
}: {
  rule: ReminderRule;
  onClose: () => void;
  onSubmit: (input: ReminderRule) => void;
}) {
  const [cadence, setCadence] = useState<ReminderCadence>(rule.cadence);
  const [channel, setChannel] = useState<ReminderChannel>(rule.channel);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [nextRun, setNextRun] = useState(rule.nextRun);
  const [error, setError] = useState("");

  return (
    <Modal
      open
      title={`Reminder schedule for ${rule.owner}`}
      description="Set how pending task reminders are handled in this local dashboard."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (!nextRun.trim()) {
            setError("Add the next reminder run time before saving.");
            return;
          }

          setError("");
          onSubmit({
            ...rule,
            cadence,
            channel,
            enabled,
            nextRun: nextRun.trim(),
          });
        }}
        className="grid gap-4"
      >
        <InlineNotice
          tone="green"
          title="Reminder rule"
          detail="Scheduled sends only run for enabled owners with pending tasks. Manual sends still respect the current pending task count."
        />
        {error ? <InlineNotice tone="red" title="Cannot save schedule" detail={error} /> : null}
        <DetailRow label="Owner" value={rule.owner} />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Cadence"
            value={cadence}
            options={reminderCadenceOptions}
            onChange={setCadence}
          />
          <SelectField
            label="Delivery channel"
            value={channel}
            options={reminderChannelOptions}
            onChange={setChannel}
          />
          <TextField label="Next run" value={nextRun} onChange={setNextRun} required />
          <CheckboxField
            label="Enable this reminder schedule"
            checked={enabled}
            onChange={setEnabled}
          />
        </div>
        <ModalActions onCancel={onClose} />
      </form>
    </Modal>
  );
}

function DetailDrawer({
  detail,
  onClose,
  onUpdateTaskStatus,
  onUpdateTaskOwner,
  ownerOptions,
  onUpdateUserAccess,
  onUpdateUserStatus,
}: {
  detail: ResolvedDetail;
  onClose: () => void;
  onUpdateTaskStatus: (id: string, status: TaskStatus) => void;
  onUpdateTaskOwner: (id: string, owner: string) => void;
  ownerOptions: string[];
  onUpdateUserAccess: (id: string, access: TeamUser["access"]) => void;
  onUpdateUserStatus: (id: string, status: TeamUser["status"]) => void;
}) {
  if (!detail?.item) {
    return null;
  }

  if (detail.type === "task") {
    const task = detail.item;
    const dueState = getTaskDueState(task);
    const allowedStatuses = getAllowedTaskStatuses(task);
    const taskNeedsPrivateDetailCleanup = !task.privateDetailsClear || hasPrivateDetailsRisk(task.title);

    return (
      <Drawer open title={task.id} description={task.title} onClose={onClose}>
        <div className="grid gap-4">
          <DetailRow label="Project" value={task.project} />
          <DetailRow label="Workstream" value={task.workstream} />
          <DetailRow label="Priority" value={task.priority} />
          <DetailRow label="Due date" value={task.due} />
          <Badge className={taskDueStateStyles[dueState]}>{dueState}</Badge>
          {taskNeedsPrivateDetailCleanup ? (
            <InlineNotice
              tone="red"
              title="Private details cleanup required"
              detail="This task cannot move to review or done until the task text is cleaned."
            />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Status"
              value={task.status}
              options={statusColumns.filter((status) => allowedStatuses.has(status))}
              onChange={(status) => onUpdateTaskStatus(task.id, status)}
            />
            <SelectField
              label="Owner"
              value={task.owner}
              options={ownerOptions}
              onChange={(owner) => onUpdateTaskOwner(task.id, owner)}
            />
          </div>
        </div>
      </Drawer>
    );
  }

  if (detail.type === "project") {
    const project = detail.item;

    return (
      <Drawer open title={project.name} description={`${project.area} / ${project.stage}`} onClose={onClose}>
        <div className="grid gap-4">
          <DetailRow label="Owner" value={project.owner} />
          <DetailRow label="Risk" value={project.risk} />
          <DetailRow label="Work items" value={project.workItems.toString()} />
          <DetailRow label="Target date" value={project.targetDate} />
          <div>
            <p className="text-xs font-semibold uppercase text-[#717970]">Progress</p>
            <ProgressBar value={project.progress} />
          </div>
        </div>
      </Drawer>
    );
  }

  if (detail.type === "batch") {
    const batch = detail.item;

    return (
      <Drawer open title={batch.id} description={`${batch.project} / ${batch.team}`} onClose={onClose}>
        <div className="grid gap-4">
          <DetailRow label="Work type" value={batch.workType} />
          <DetailRow label="Items" value={formatNumber(batch.items)} />
          <DetailRow label="Quality score" value={`${batch.qualityScore.toFixed(1)}%`} />
          <DetailRow label="Review items" value={batch.reviewItems.toString()} />
          <DetailRow label="Status" value={batch.status} />
        </div>
      </Drawer>
    );
  }

  if (detail.type === "integration") {
    const integration = detail.item;

    return (
      <Drawer open title={integration.project} description={`${integration.system} via ${integration.method}`} onClose={onClose}>
        <div className="grid gap-4">
          <DetailRow label="Status" value={integration.status} />
          <DetailRow label="Last sync" value={integration.lastSync} />
          <DetailRow label="Open issues" value={integration.openIssues.toString()} />
          <div>
            <p className="text-xs font-semibold uppercase text-[#717970]">Mapping progress</p>
            <ProgressBar value={integration.mappingProgress} />
          </div>
        </div>
      </Drawer>
    );
  }

  if (detail.type === "doc") {
    const doc = detail.item;

    return (
      <Drawer open title={doc.title} description={`${doc.area} / ${doc.status}`} onClose={onClose}>
        <div className="grid gap-4">
          <DetailRow label="Owner" value={doc.owner} />
          <DetailRow label="Updated" value={doc.updated} />
          <DetailRow label="Status" value={doc.status} />
        </div>
      </Drawer>
    );
  }

  const user = detail.item;

  return (
    <Drawer open title={user.name} description={`${user.role} / ${user.team}`} onClose={onClose}>
      <div className="grid gap-4">
        <DetailRow label="Status" value={user.status} />
        <SelectField
          label="Access"
          value={user.access}
          options={accessOptions}
          onChange={(access) => onUpdateUserAccess(user.id, access)}
        />
        <SelectField
          label="Status"
          value={user.status}
          options={userStatusOptions}
          onChange={(status) => onUpdateUserStatus(user.id, status)}
        />
        <p className="rounded-md border border-[#B4F1BD] bg-[#B4F1BD]/20 p-3 text-sm leading-6 text-[#414941]">
          Access changes require confirmation and are written to the audit trail.
        </p>
      </div>
    </Drawer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="hdx-subpanel p-3">
      <p className="text-xs font-semibold uppercase text-[#717970]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#0E1F12]">{value}</p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "brand" | "cyan" | "amber" | "emerald";
}) {
  const toneClass = {
    brand: "bg-[#B4F1BD]/25 text-[#008943]",
    cyan: "bg-cyan-50 text-cyan-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <section className="hdx-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#717970]">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-[#0E1F12]">{value}</p>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-md ${toneClass}`}>{icon}</div>
      </div>
      <p className="mt-3 text-sm leading-5 text-[#717970]">{detail}</p>
    </section>
  );
}

function TaskBoard({
  tasks,
  onCreateTask,
  onStatusChange,
  onOwnerChange,
  ownerOptions,
  onOpenDetail,
}: {
  tasks: Task[];
  onCreateTask: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onOwnerChange: (id: string, owner: string) => void;
  ownerOptions: string[];
  onOpenDetail: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No work items match the current filters"
          description="Adjust the project or priority filter, or create a new work item for this operational queue."
          action={<PrimaryButton icon={<Plus className="h-4 w-4" />} onClick={onCreateTask}>New work item</PrimaryButton>}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-5">
      {statusColumns.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);

        return (
          <div key={status} className={`min-h-80 overflow-hidden border-t-4 hdx-subpanel ${taskColumnStyles[status]}`}>
            <div className="flex h-12 items-center justify-between border-b border-[#C1C9BE]/55 bg-white/70 px-3">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-[#717970]" />
                <h3 className="text-sm font-semibold text-[#07160F]">{status}</h3>
              </div>
              <span className="grid h-6 min-w-6 place-items-center rounded-md bg-[#EEF7EE] px-2 text-xs font-semibold text-[#006D34]">
                {columnTasks.length}
              </span>
            </div>

            <div className="space-y-3 p-3">
              {columnTasks.map((task) => {
                const dueState = getTaskDueState(task);
                const allowedStatuses = getAllowedTaskStatuses(task);
                const taskNeedsPrivateDetailCleanup = !task.privateDetailsClear || hasPrivateDetailsRisk(task.title);

                return (
                  <article
                    key={task.id}
                    className="rounded-md border border-[#C1C9BE]/55 bg-white p-3 shadow-sm shadow-[#07160F]/[0.04] transition hover:-translate-y-0.5 hover:border-[#008943]/45 hover:shadow-md hover:shadow-[#07160F]/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={priorityStyles[task.priority]}>{task.priority}</Badge>
                          <Badge className={taskDueStateStyles[dueState]}>{dueState}</Badge>
                          <Badge className={taskNeedsPrivateDetailCleanup ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
                            {taskNeedsPrivateDetailCleanup ? "Needs cleanup" : "Clean text"}
                          </Badge>
                        </div>
                        <h4 className="mt-3 text-sm font-semibold leading-5 text-[#07160F]">{task.title}</h4>
                      </div>
                      <IconButton label={`Open ${task.id}`} onClick={() => onOpenDetail(task.id)}>
                        <MoreHorizontal className="h-4 w-4" />
                      </IconButton>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-[#717970]">
                      <p className="font-semibold text-[#006D34]">{task.id}</p>
                      <p>{task.project}</p>
                      <p>{task.workstream}</p>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <label className="sr-only" htmlFor={`status-${task.id}`}>
                        Status
                      </label>
                      <select
                        id={`status-${task.id}`}
                        value={task.status}
                        onChange={(event) => onStatusChange(task.id, event.target.value as TaskStatus)}
                        className="hdx-control h-9 px-2 text-xs font-semibold"
                      >
                        {statusColumns.map((option) => (
                          <option key={option} disabled={!allowedStatuses.has(option)}>
                            {option}
                          </option>
                        ))}
                      </select>

                      <label className="sr-only" htmlFor={`owner-${task.id}`}>
                        Owner
                      </label>
                      <select
                        id={`owner-${task.id}`}
                        value={task.owner}
                        onChange={(event) => onOwnerChange(task.id, event.target.value)}
                        className="hdx-control h-9 px-2 text-xs font-semibold"
                      >
                        {ownerOptions.map((owner) => (
                          <option key={owner}>{owner}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-[#717970]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {task.due}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquareText className="h-3.5 w-3.5" />
                        {task.comments}
                      </span>
                    </div>
                  </article>
                );
              })}

              {columnTasks.length === 0 && (
                <div className="rounded-md border border-dashed border-[#C1C9BE] bg-white p-4 text-center text-sm text-[#717970]">
                  No work items
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProjectCard({
  project,
  compact = false,
  onOpen,
}: {
  project: Project;
  compact?: boolean;
  onOpen?: () => void;
}) {
  return (
    <article className="rounded-md border border-[#C1C9BE]/55 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className={riskStyles[project.risk]}>{project.risk}</Badge>
          <h3 className="mt-3 text-base font-semibold text-[#0E1F12]">{project.name}</h3>
          <p className="mt-1 text-sm text-[#717970]">{project.area}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-[#B4F1BD]/25 text-[#008943]">
          <Building2 className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-[#717970]">
          <span>{project.stage}</span>
          <span>{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} />
      </div>

      <div className={`mt-4 grid gap-3 text-sm ${compact ? "grid-cols-2" : "grid-cols-3"}`}>
        <MiniStat label="Owner" value={project.owner} />
        <MiniStat label="Work items" value={project.workItems.toString()} />
        {!compact ? <MiniStat label="Target" value={project.targetDate} /> : null}
      </div>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-[#C1C9BE]/70 px-3 text-sm font-semibold text-[#414941] transition hover:border-[#008943] hover:bg-[#B4F1BD]/25 hover:text-[#006D34]"
        >
          Details
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </article>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-md bg-[#EBEFE7]">
      <div className="h-full rounded-md bg-[#008943]" style={{ width: `${value}%` }} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#717970]">{label}</p>
      <p className="mt-1 font-semibold text-[#0E1F12]">{value}</p>
    </div>
  );
}

function FocusItem({
  icon,
  title,
  detail,
  tone,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  tone: "red" | "amber" | "cyan";
}) {
  const toneClass = {
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    cyan: "bg-cyan-50 text-cyan-700",
  }[tone];

  return (
    <div className="flex gap-3 rounded-md border border-[#C1C9BE]/70 p-3">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${toneClass}`}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-[#0E1F12]">{title}</p>
        <p className="mt-1 text-sm leading-5 text-[#717970]">{detail}</p>
      </div>
    </div>
  );
}

function AuditList({ auditEvents }: { auditEvents: AuditEvent[] }) {
  if (auditEvents.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title="No audit events yet"
          description="System activity will appear here after the team starts making changes."
        />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {auditEvents.map((event) => (
        <div key={event.id} className="flex gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#B4F1BD]/25 text-[#008943]">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-5 text-[#414941]">
              <span className="font-semibold text-[#0E1F12]">{event.actor}</span> {event.action}
            </p>
            <p className="mt-1 text-xs text-[#717970]">
              {event.area} / {event.time}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkBatchRow({ batch, onOpen }: { batch: WorkBatch; onOpen?: () => void }) {
  return (
    <div className="rounded-md border border-[#C1C9BE]/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0E1F12]">{batch.project}</p>
          <p className="mt-1 text-xs text-[#717970]">
            {batch.team} / {batch.workType}
          </p>
        </div>
        <Badge className={batchStatusStyles[batch.status]}>{batch.status}</Badge>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[#717970]">
        <span>{formatNumber(batch.items)} items</span>
        <span>{batch.qualityScore.toFixed(1)}% quality</span>
        <span>{batch.reviewItems} review items</span>
      </div>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 text-xs font-semibold text-[#008943] hover:text-[#006D34]"
        >
          Open batch
        </button>
      ) : null}
    </div>
  );
}

function IntegrationRow({
  integration,
  compact = false,
  onOpen,
}: {
  integration: Integration;
  compact?: boolean;
  onOpen?: () => void;
}) {
  return (
    <div className="rounded-md border border-[#C1C9BE]/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0E1F12]">{integration.project}</p>
          <p className="mt-1 text-xs text-[#717970]">
            {integration.system} / {integration.method}
          </p>
        </div>
        <Badge className={integrationStatusStyles[integration.status]}>{integration.status}</Badge>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#717970]">
          <span>Mapping</span>
          <span>{integration.mappingProgress}%</span>
        </div>
        <ProgressBar value={integration.mappingProgress} />
      </div>
      {!compact ? (
        <div className="mt-3 flex items-center justify-between text-xs text-[#717970]">
          <span>Last sync: {integration.lastSync}</span>
          <span>{integration.openIssues} open issues</span>
        </div>
      ) : null}
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 text-xs font-semibold text-[#008943] hover:text-[#006D34]"
        >
          Open integration
        </button>
      ) : null}
    </div>
  );
}

function IntegrationPanel({
  integration,
  onOpen,
}: {
  integration: Integration;
  onOpen?: () => void;
}) {
  return (
    <article className="rounded-md border border-[#C1C9BE]/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className={integrationStatusStyles[integration.status]}>{integration.status}</Badge>
          <h3 className="mt-3 text-base font-semibold text-[#0E1F12]">{integration.project}</h3>
          <p className="mt-1 text-sm text-[#717970]">
            {integration.system} using {integration.method}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-cyan-50 text-cyan-700">
          <Network className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-semibold text-[#717970]">
          <span>Field mapping</span>
          <span>{integration.mappingProgress}%</span>
        </div>
        <ProgressBar value={integration.mappingProgress} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="Last sync" value={integration.lastSync} />
        <MiniStat label="Open issues" value={integration.openIssues.toString()} />
      </div>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-[#C1C9BE]/70 px-3 text-sm font-semibold text-[#414941] transition hover:border-[#008943] hover:bg-[#B4F1BD]/25 hover:text-[#006D34]"
        >
          Details
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </article>
  );
}

function AccessTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="hdx-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#717970]">{label}</span>
        <span className="text-[#008943]">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold text-[#0E1F12]">{value}</p>
    </div>
  );
}
