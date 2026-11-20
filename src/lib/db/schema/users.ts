import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { id, ownerReadOnly, ownerReadWrite, publicRead, timestamps, userId } from "./_shared";

export const ageBracket = pgEnum("age_bracket", ["14_17", "18_plus"]);
export const locale = pgEnum("locale", ["fr", "en"]);
export const experienceLevel = pgEnum("experience_level", [
  "never",
  "beginner",
  "intermediate",
  "advanced",
]);

/** One row per auth user, created by the `handle_new_user` trigger. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    ageBracket: ageBracket("age_bracket"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    ...ownerReadOnly("profiles", t.id),
    check("display_name_length", sql`char_length(${t.displayName}) <= 60`),
  ],
).enableRLS();

/** Platform administrators. Never writable through the Data API. */
export const appAdmins = pgTable(
  "app_admins",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [...ownerReadOnly("app_admins", t.userId)],
).enableRLS();

/** Layout definitions (keys, fingers, dead keys) live in code; this table gates availability. */
export const keyboardLayouts = pgTable(
  "keyboard_layouts",
  {
    id: text("id").primaryKey(), // e.g. "fr-azerty"
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  () => [...publicRead("keyboard_layouts")],
).enableRLS();

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: id(),
    userId: userId().unique(),
    uiLanguage: locale("ui_language").notNull().default("fr"),
    contentLanguage: locale("content_language").notNull().default("fr"),
    keyboardLayoutId: text("keyboard_layout_id")
      .notNull()
      .default("fr-azerty")
      .references(() => keyboardLayouts.id),
    experienceLevel: experienceLevel("experience_level"),
    goals: text("goals").array().notNull().default(sql`'{}'::text[]`),
    dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(10),
    /** IANA zone from the browser, for "today" and streaks. */
    timeZone: text("time_zone"),
    soundEnabled: boolean("sound_enabled").notNull().default(false),
    showVirtualKeyboard: boolean("show_virtual_keyboard").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    ...ownerReadWrite("user_preferences", t.userId),
    check("daily_goal_range", sql`${t.dailyGoalMinutes} between 1 and 240`),
  ],
).enableRLS();

export const userInterests = pgTable(
  "user_interests",
  {
    id: id(),
    userId: userId(),
    topicKey: text("topic_key").notNull(),
    customLabel: text("custom_label"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    unique("user_interests_user_topic").on(t.userId, t.topicKey),
    ...ownerReadWrite("user_interests", t.userId),
    check("custom_label_length", sql`char_length(${t.customLabel}) <= 60`),
  ],
).enableRLS();
