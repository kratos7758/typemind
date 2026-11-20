import { readFileSync, existsSync } from "node:fs";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

// Load .env.local (local Supabase keys) without adding a dotenv dependency.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}
