import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

dotenv.config({ path: "backend/.env" });

let pool: Pool | undefined;

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for HealthDocX backend database routes.");
  }

  pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

type Database = ReturnType<typeof createDatabase>;

let database: Database | undefined;

export function getDb() {
  database ??= createDatabase();
  return database;
}

export async function closeDb() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
  database = undefined;
}
