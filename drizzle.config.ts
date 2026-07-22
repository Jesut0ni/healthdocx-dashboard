import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({ path: "backend/.env" });

export default defineConfig({
  schema: "./backend/src/db/schema.ts",
  out: "./backend/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
