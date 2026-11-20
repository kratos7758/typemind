import { defineConfig } from "drizzle-kit";

// Local Supabase default; override with DATABASE_URL for other environments.
const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./supabase/migrations",
  dbCredentials: { url },
  entities: { roles: { provider: "supabase" } },
  migrations: { prefix: "supabase" },
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
