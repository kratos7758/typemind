import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";
import { id, ownerReadOnly, timestamps, userId } from "./_shared";
import { keyboardLayouts, locale } from "./users";

export const exerciseKind = pgEnum("exercise_kind", ["lesson", "library", "ai", "assessment"]);
export const sessionMode = pgEnum("session_mode", [
  "assessment",
  "lesson",
  "adaptive",
  "ai_text",
  "speed_test",
  "accuracy",
]);
export const sessionStatus = pgEnum("session_status", ["completed", "abandoned"]);
export const skillLevel = pgEnum("skill_level", [
  "novice",
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);
export const trend = pgEnum("trend", ["improving", "stable", "declining", "unknown"]);

export const exercises = pgTable(
  "exercises",
  {
    id: id(),
    kind: exerciseKind("kind").notNull(),
    language: locale("language").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    topicKey: text("topic_key"),
    difficulty: smallint("difficulty").notNull(),
    targetChars: text("target_chars").array().notNull().default(sql`'{}'::text[]`),
    /** null = shared catalogue; set = private (e.g. AI text generated for one user). */
    ownerId: uuid("owner_id").references(() => authUsers.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    index("exercises_catalogue_idx").on(t.kind, t.language, t.difficulty),
    index("exercises_owner_idx").on(t.ownerId),
    check("difficulty_range", sql`${t.difficulty} between 1 and 10`),
    check("body_length", sql`char_length(${t.body}) between 1 and 5000`),
    pgPolicy("exercises_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.ownerId} is null or ${t.ownerId} = ${authUid}`,
    }),
  ],
).enableRLS();

export const typingSessions = pgTable(
  "typing_sessions",
  {
    id: id(),
    userId: userId(),
    exerciseId: uuid("exercise_id").references(() => exercises.id, { onDelete: "set null" }),
    /** Source of built-in content, e.g. "lesson:home-index", "lib:fr-science-1", "speed:60". */
    exerciseKey: text("exercise_key"),
    layoutId: text("layout_id")
      .notNull()
      .references(() => keyboardLayouts.id),
    mode: sessionMode("mode").notNull(),
    status: sessionStatus("status").notNull(),
    /** Generated in the browser; makes offline retries idempotent. */
    clientSessionId: uuid("client_session_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    unique("typing_sessions_client_id").on(t.userId, t.clientSessionId),
    index("typing_sessions_user_started_idx").on(t.userId, t.startedAt.desc()),
    index("typing_sessions_user_exercise_idx").on(t.userId, t.exerciseKey),
    check("duration_positive", sql`${t.durationMs} > 0`),
    ...ownerReadOnly("typing_sessions", t.userId),
  ],
).enableRLS();

export const sessionStatistics = pgTable(
  "session_statistics",
  {
    sessionId: uuid("session_id")
      .primaryKey()
      .references(() => typingSessions.id, { onDelete: "cascade" }),
    userId: userId(),
    netWpm: real("net_wpm").notNull(),
    rawWpm: real("raw_wpm").notNull(),
    accuracy: real("accuracy").notNull(),
    keystrokes: integer("keystrokes").notNull(),
    correctKeystrokes: integer("correct_keystrokes").notNull(),
    /** Correct characters in the final text (basis of net WPM). */
    correctChars: integer("correct_chars").notNull().default(0),
    correctedErrors: integer("corrected_errors").notNull(),
    uncorrectedErrors: integer("uncorrected_errors").notNull(),
    consistency: real("consistency"),
    /** ≤ 1 sample per second: [{ t: seconds, wpm, errors }]. */
    wpmTimeline: jsonb("wpm_timeline").notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [
    index("session_statistics_user_idx").on(t.userId),
    check("accuracy_range", sql`${t.accuracy} between 0 and 100`),
    ...ownerReadOnly("session_statistics", t.userId),
  ],
).enableRLS();

/** Per-character performance, updated after each session with exponential moving averages. */
export const keyStatistics = pgTable(
  "key_statistics",
  {
    id: id(),
    userId: userId(),
    layoutId: text("layout_id")
      .notNull()
      .references(() => keyboardLayouts.id),
    char: text("char").notNull(),
    attempts: integer("attempts").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    ewmaLatencyMs: real("ewma_latency_ms"),
    ewmaErrorRate: real("ewma_error_rate"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("key_statistics_user_layout_char").on(t.userId, t.layoutId, t.char),
    ...ownerReadOnly("key_statistics", t.userId),
  ],
).enableRLS();

export const bigramStatistics = pgTable(
  "bigram_statistics",
  {
    id: id(),
    userId: userId(),
    layoutId: text("layout_id")
      .notNull()
      .references(() => keyboardLayouts.id),
    bigram: text("bigram").notNull(),
    attempts: integer("attempts").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    ewmaLatencyMs: real("ewma_latency_ms"),
    ewmaErrorRate: real("ewma_error_rate"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("bigram_statistics_user_layout_bigram").on(t.userId, t.layoutId, t.bigram),
    ...ownerReadOnly("bigram_statistics", t.userId),
  ],
).enableRLS();

export const learningProfiles = pgTable(
  "learning_profiles",
  {
    id: id(),
    userId: userId().unique(),
    skillLevel: skillLevel("skill_level"),
    currentWpm: real("current_wpm"),
    currentAccuracy: real("current_accuracy"),
    targetWpm: integer("target_wpm"),
    weakKeys: text("weak_keys").array().notNull().default(sql`'{}'::text[]`),
    weakBigrams: text("weak_bigrams").array().notNull().default(sql`'{}'::text[]`),
    wpmTrend: trend("wpm_trend").notNull().default("unknown"),
    accuracyTrend: trend("accuracy_trend").notNull().default("unknown"),
    lastPracticeAt: timestamp("last_practice_at", { withTimezone: true }),
    streakDays: integer("streak_days").notNull().default(0),
    assessedAt: timestamp("assessed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [...ownerReadOnly("learning_profiles", t.userId)],
).enableRLS();

export const learningPlans = pgTable(
  "learning_plans",
  {
    id: id(),
    userId: userId(),
    status: text("status", { enum: ["active", "completed", "replaced"] }).notNull(),
    steps: jsonb("steps").notNull(),
    ruleVersion: text("rule_version").notNull(),
    ...timestamps,
  },
  (t) => [
    index("learning_plans_user_status_idx").on(t.userId, t.status),
    ...ownerReadOnly("learning_plans", t.userId),
  ],
).enableRLS();

export const aiRecommendations = pgTable(
  "ai_recommendations",
  {
    id: id(),
    userId: userId(),
    ruleId: text("rule_id").notNull(),
    payload: jsonb("payload").notNull(),
    explanation: text("explanation"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("ai_recommendations_user_idx").on(t.userId, t.createdAt.desc()),
    ...ownerReadOnly("ai_recommendations", t.userId),
  ],
).enableRLS();
