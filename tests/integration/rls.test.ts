/**
 * Row Level Security tests against the local Supabase stack (`npx supabase start`).
 * Verifies acceptance criterion #11: a user can never read another user's data,
 * and cannot forge server-owned data (subscription, quotas, statistics) through the Data API.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { adminDb, withUserDb } from "@/lib/db/client";
import { profiles, subscriptions, userPreferences } from "@/lib/db/schema";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, { auth: { persistSession: false } });

type TestUser = { id: string; client: SupabaseClient; claims: { sub: string; role: string } };

async function createUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${crypto.randomUUID()}@example.test`;
  const password = "integration-test-password";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `User ${label}`, age_bracket: "18_plus", locale: "en" },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client, claims: { sub: data.user.id, role: "authenticated" } };
}

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
});

afterAll(async () => {
  for (const user of [alice, bob]) if (user) await admin.auth.admin.deleteUser(user.id);
});

describe("signup trigger", () => {
  it("creates profile, preferences, learning profile and a free subscription", async () => {
    const db = adminDb();
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, alice.id));
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, alice.id));
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, alice.id));
    expect(profile?.displayName).toBe("User alice");
    expect(profile?.ageBracket).toBe("18_plus");
    expect(prefs?.uiLanguage).toBe("en");
    expect(sub?.planId).toBe("free");
  });
});

describe("Data API (PostgREST) isolation", () => {
  it("only returns the caller's own profile", async () => {
    const { data, error } = await alice.client.from("profiles").select("id");
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([alice.id]);
  });

  it("cannot read another user's preferences", async () => {
    const { data } = await alice.client.from("user_preferences").select("user_id").eq("user_id", bob.id);
    expect(data).toEqual([]);
  });

  it("cannot upgrade its own subscription", async () => {
    const { data } = await alice.client
      .from("subscriptions")
      .update({ plan_id: "pro_monthly" })
      .eq("user_id", alice.id)
      .select();
    expect(data ?? []).toEqual([]);
    const [sub] = await adminDb().select().from(subscriptions).where(eq(subscriptions.userId, alice.id));
    expect(sub?.planId).toBe("free");
  });

  it("cannot grant itself admin rights", async () => {
    const { error } = await alice.client.from("app_admins").insert({ user_id: alice.id });
    expect(error).not.toBeNull();
  });

  it("cannot forge learning statistics", async () => {
    const { error } = await alice.client
      .from("key_statistics")
      .insert({ user_id: alice.id, layout_id: "us-qwerty", char: "a", attempts: 999 });
    expect(error).not.toBeNull();
  });

  it("cannot insert preferences on behalf of another user", async () => {
    const { error } = await alice.client.from("user_interests").insert({ user_id: bob.id, topic_key: "finance" });
    expect(error).not.toBeNull();
  });

  it("can manage its own interests", async () => {
    const { error } = await alice.client.from("user_interests").insert({ user_id: alice.id, topic_key: "science" });
    expect(error).toBeNull();
  });

  it("anonymous visitors can read plans but no private data", async () => {
    const anon = createClient(url, publishableKey, { auth: { persistSession: false } });
    const plans = await anon.from("subscription_plans").select("id");
    expect(plans.data?.length).toBeGreaterThanOrEqual(3);
    const profilesRes = await anon.from("profiles").select("id");
    expect(profilesRes.data ?? []).toEqual([]);
  });
});

describe("Drizzle withUserDb applies RLS (ADR-004)", () => {
  it("sees only the caller's rows even without a WHERE clause", async () => {
    const rows = await withUserDb(alice.claims, (tx) => tx.select({ id: profiles.id }).from(profiles));
    expect(rows.map((r) => r.id)).toEqual([alice.id]);
  });

  it("cannot update another user's preferences", async () => {
    const updated = await withUserDb(alice.claims, (tx) =>
      tx
        .update(userPreferences)
        .set({ dailyGoalMinutes: 99 })
        .where(eq(userPreferences.userId, bob.id))
        .returning(),
    );
    expect(updated).toEqual([]);
  });
});
