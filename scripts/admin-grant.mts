/**
 * Grants (or revokes) platform admin rights.
 *   npm run admin:grant -- someone@example.com
 *   npm run admin:grant -- someone@example.com --revoke
 * Uses DATABASE_URL from .env.local. Admin rights are never writable from the app itself.
 */
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && m[2] !== "" && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const email = process.argv[2]?.trim().toLowerCase();
const revoke = process.argv.includes("--revoke");
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:grant -- <email> [--revoke]");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
try {
  const [user] = await sql<{ id: string }[]>`select id from auth.users where lower(email) = ${email}`;
  if (!user) {
    console.error(`No account for ${email}`);
    process.exitCode = 1;
  } else if (revoke) {
    await sql`delete from public.app_admins where user_id = ${user.id}`;
    console.log(`Admin rights revoked for ${email}`);
  } else {
    await sql`insert into public.app_admins (user_id) values (${user.id}) on conflict do nothing`;
    console.log(`Admin rights granted to ${email}`);
  }
} finally {
  await sql.end();
}
