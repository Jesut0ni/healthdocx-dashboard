import { eq } from "drizzle-orm";
import { Router } from "express";
import { getDb } from "../db/client";
import { projectComments, projectMembers, projects } from "../db/schema";
import { isOneOf, makeId, projectStageValues, riskValues } from "../lib/domain";
import { recordAuditEvent } from "../services/audit";
import { findUserByIdOrShortName } from "../services/lookups";

type CreateProjectBody = {
  id?: string;
  name?: string;
  area?: string;
  stage?: unknown;
  ownerId?: string;
  owner?: string;
  risk?: unknown;
  workItems?: number;
  progress?: number;
  targetDate?: string;
  members?: unknown;
};

type UpdateProjectMembersBody = {
  members?: unknown;
  actor?: string;
};

type CreateProjectCommentBody = {
  body?: string;
  comment?: string;
  author?: string;
  authorId?: string;
};

type LookupUser = NonNullable<Awaited<ReturnType<typeof findUserByIdOrShortName>>>;

export const projectsRouter = Router();

function normalizedStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

async function resolveUserList(value: unknown, excludedUserId?: string): Promise<LookupUser[]> {
  const resolvedUsers = await Promise.all(
    normalizedStringList(value).map((lookup) => findUserByIdOrShortName(lookup)),
  );
  const usersById = new Map<string, LookupUser>();

  for (const user of resolvedUsers) {
    if (user && user.id !== excludedUserId) {
      usersById.set(user.id, user);
    }
  }

  return Array.from(usersById.values());
}

projectsRouter.post("/projects", async (request, response) => {
  const body = request.body as CreateProjectBody;

  if (!body.name?.trim() || !body.area?.trim() || !body.targetDate?.trim()) {
    response.status(400).json({ error: "Project name, area, and target date are required." });
    return;
  }

  const ownerLookup = body.ownerId ?? body.owner;

  if (!ownerLookup) {
    response.status(400).json({ error: "Project owner is required." });
    return;
  }

  const owner = await findUserByIdOrShortName(ownerLookup);

  if (!owner) {
    response.status(404).json({ error: "Project owner was not found." });
    return;
  }

  const stage = isOneOf(projectStageValues, body.stage) ? body.stage : "Discovery";
  const risk = isOneOf(riskValues, body.risk) ? body.risk : "Healthy";
  const db = getDb();
  const members = await resolveUserList(body.members, owner.id);
  const [createdProject] = await db
    .insert(projects)
    .values({
      id: body.id ?? makeId("PRJ"),
      name: body.name.trim(),
      area: body.area.trim(),
      stage,
      ownerId: owner.id,
      risk,
      workItems: body.workItems ?? 0,
      progress: body.progress ?? 0,
      targetDate: body.targetDate.trim(),
    })
    .returning();

  if (members.length > 0) {
    await db.insert(projectMembers).values(
      members.map((member) => ({
        id: makeId("PMB"),
        projectId: createdProject.id,
        userId: member.id,
      })),
    );
  }

  await recordAuditEvent({
    actorId: owner.id,
    actorName: owner.shortName,
    action: `created project ${createdProject.name}`,
    area: "Projects",
  });

  response.status(201).json({ project: createdProject });
});

projectsRouter.patch("/projects/:id/members", async (request, response) => {
  const body = request.body as UpdateProjectMembersBody;

  if (!Array.isArray(body.members)) {
    response.status(400).json({ error: "Project members must be a list." });
    return;
  }

  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, request.params.id)).limit(1);

  if (!project) {
    response.status(404).json({ error: "Project was not found." });
    return;
  }

  const members = await resolveUserList(body.members, project.ownerId);

  await db.delete(projectMembers).where(eq(projectMembers.projectId, project.id));

  if (members.length > 0) {
    await db.insert(projectMembers).values(
      members.map((member) => ({
        id: makeId("PMB"),
        projectId: project.id,
        userId: member.id,
      })),
    );
  }

  await recordAuditEvent({
    actorName: body.actor ?? "Dashboard",
    action: `updated members for ${project.name}`,
    area: "Projects",
  });

  response.json({ members: members.map((member) => member.shortName) });
});

projectsRouter.post("/projects/:id/comments", async (request, response) => {
  const body = request.body as CreateProjectCommentBody;
  const commentBody = (body.body ?? body.comment ?? "").trim();

  if (!commentBody) {
    response.status(400).json({ error: "Comment text is required." });
    return;
  }

  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, request.params.id)).limit(1);

  if (!project) {
    response.status(404).json({ error: "Project was not found." });
    return;
  }

  const authorLookup = body.authorId ?? body.author;
  const author = authorLookup ? await findUserByIdOrShortName(authorLookup) : undefined;
  const authorName = author?.shortName ?? (body.author?.trim() || "Dashboard");
  const [comment] = await db
    .insert(projectComments)
    .values({
      id: makeId("PCM"),
      projectId: project.id,
      authorId: author?.id,
      authorName,
      body: commentBody,
    })
    .returning();

  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, project.id));
  await recordAuditEvent({
    actorId: author?.id,
    actorName: authorName,
    action: `commented on ${project.name}`,
    area: "Projects",
  });

  response.status(201).json({
    comment: {
      id: comment.id,
      author: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    },
  });
});
