import { or, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { projects, users } from "../db/schema";

export async function findUserByIdOrShortName(value: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.id, value), eq(users.shortName, value)))
    .limit(1);

  return user;
}

export async function findProjectByIdOrName(value: string) {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(or(eq(projects.id, value), eq(projects.name, value)))
    .limit(1);

  return project;
}
