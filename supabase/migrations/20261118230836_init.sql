CREATE TYPE "public"."age_bracket" AS ENUM('14_17', '18_plus');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('never', 'beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('fr', 'en');--> statement-breakpoint
CREATE TYPE "public"."exercise_kind" AS ENUM('lesson', 'library', 'ai', 'assessment');--> statement-breakpoint
CREATE TYPE "public"."session_mode" AS ENUM('assessment', 'lesson', 'adaptive', 'ai_text', 'speed_test', 'accuracy');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."skill_level" AS ENUM('novice', 'beginner', 'intermediate', 'advanced', 'expert');--> statement-breakpoint
CREATE TYPE "public"."trend" AS ENUM('improving', 'stable', 'declining', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."quota_feature" AS ENUM('ai_generation', 'ai_coach_message');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid');--> statement-breakpoint
CREATE TABLE "app_admins" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "keyboard_layouts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keyboard_layouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"age_bracket" "age_bracket",
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "display_name_length" CHECK (char_length("profiles"."display_name") <= 60)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_key" text NOT NULL,
	"custom_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interests_user_topic" UNIQUE("user_id","topic_key"),
	CONSTRAINT "custom_label_length" CHECK (char_length("user_interests"."custom_label") <= 60)
);
--> statement-breakpoint
ALTER TABLE "user_interests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ui_language" "locale" DEFAULT 'fr' NOT NULL,
	"content_language" "locale" DEFAULT 'fr' NOT NULL,
	"keyboard_layout_id" text DEFAULT 'fr-azerty' NOT NULL,
	"experience_level" "experience_level",
	"goals" text[] DEFAULT '{}'::text[] NOT NULL,
	"daily_goal_minutes" integer DEFAULT 10 NOT NULL,
	"sound_enabled" boolean DEFAULT false NOT NULL,
	"show_virtual_keyboard" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "daily_goal_range" CHECK ("user_preferences"."daily_goal_minutes" between 1 and 240)
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"explanation" text,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_recommendations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bigram_statistics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"layout_id" text NOT NULL,
	"bigram" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"ewma_latency_ms" real,
	"ewma_error_rate" real,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bigram_statistics_user_layout_bigram" UNIQUE("user_id","layout_id","bigram")
);
--> statement-breakpoint
ALTER TABLE "bigram_statistics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "exercise_kind" NOT NULL,
	"language" "locale" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"topic_key" text,
	"difficulty" smallint NOT NULL,
	"target_chars" text[] DEFAULT '{}'::text[] NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "difficulty_range" CHECK ("exercises"."difficulty" between 1 and 10),
	CONSTRAINT "body_length" CHECK (char_length("exercises"."body") between 1 and 5000)
);
--> statement-breakpoint
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "key_statistics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"layout_id" text NOT NULL,
	"char" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"ewma_latency_ms" real,
	"ewma_error_rate" real,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "key_statistics_user_layout_char" UNIQUE("user_id","layout_id","char")
);
--> statement-breakpoint
ALTER TABLE "key_statistics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "learning_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"steps" jsonb NOT NULL,
	"rule_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "learning_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_level" "skill_level",
	"current_wpm" real,
	"current_accuracy" real,
	"target_wpm" integer,
	"weak_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"weak_bigrams" text[] DEFAULT '{}'::text[] NOT NULL,
	"wpm_trend" "trend" DEFAULT 'unknown' NOT NULL,
	"accuracy_trend" "trend" DEFAULT 'unknown' NOT NULL,
	"last_practice_at" timestamp with time zone,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"assessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "learning_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_statistics" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"net_wpm" real NOT NULL,
	"raw_wpm" real NOT NULL,
	"accuracy" real NOT NULL,
	"keystrokes" integer NOT NULL,
	"correct_keystrokes" integer NOT NULL,
	"corrected_errors" integer NOT NULL,
	"uncorrected_errors" integer NOT NULL,
	"consistency" real,
	"wpm_timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "accuracy_range" CHECK ("session_statistics"."accuracy" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "session_statistics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "typing_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid,
	"layout_id" text NOT NULL,
	"mode" "session_mode" NOT NULL,
	"status" "session_status" NOT NULL,
	"client_session_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "typing_sessions_client_id" UNIQUE("user_id","client_session_id"),
	CONSTRAINT "duration_positive" CHECK ("typing_sessions"."duration_ms" > 0)
);
--> statement-breakpoint
ALTER TABLE "typing_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_estimate_micros" bigint,
	"error_code" text,
	"exercise_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_generations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"stripe_price_id" text,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'cad' NOT NULL,
	"interval" text,
	"entitlements" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_stripe_price_id_unique" UNIQUE("stripe_price_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "usage_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feature" "quota_feature" NOT NULL,
	"period_start" date NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"quota_limit" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_quotas_user_feature_period" UNIQUE("user_id","feature","period_start"),
	CONSTRAINT "used_within_bounds" CHECK ("usage_quotas"."used" >= 0 and "usage_quotas"."used" <= "usage_quotas"."quota_limit")
);
--> statement-breakpoint
ALTER TABLE "usage_quotas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_admins" ADD CONSTRAINT "app_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_keyboard_layout_id_keyboard_layouts_id_fk" FOREIGN KEY ("keyboard_layout_id") REFERENCES "public"."keyboard_layouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigram_statistics" ADD CONSTRAINT "bigram_statistics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigram_statistics" ADD CONSTRAINT "bigram_statistics_layout_id_keyboard_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."keyboard_layouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_statistics" ADD CONSTRAINT "key_statistics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_statistics" ADD CONSTRAINT "key_statistics_layout_id_keyboard_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."keyboard_layouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_profiles" ADD CONSTRAINT "learning_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_statistics" ADD CONSTRAINT "session_statistics_session_id_typing_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."typing_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_statistics" ADD CONSTRAINT "session_statistics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "typing_sessions" ADD CONSTRAINT "typing_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "typing_sessions" ADD CONSTRAINT "typing_sessions_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "typing_sessions" ADD CONSTRAINT "typing_sessions_layout_id_keyboard_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."keyboard_layouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_recommendations_user_idx" ON "ai_recommendations" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "exercises_catalogue_idx" ON "exercises" USING btree ("kind","language","difficulty");--> statement-breakpoint
CREATE INDEX "exercises_owner_idx" ON "exercises" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "learning_plans_user_status_idx" ON "learning_plans" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "session_statistics_user_idx" ON "session_statistics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "typing_sessions_user_started_idx" ON "typing_sessions" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_generations_user_idx" ON "ai_generations" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "app_admins_owner_select" ON "app_admins" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("app_admins"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "keyboard_layouts_public_select" ON "keyboard_layouts" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "profiles_owner_select" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_interests_owner_select" ON "user_interests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_interests"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_interests_owner_insert" ON "user_interests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_interests"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_interests_owner_update" ON "user_interests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user_interests"."user_id" = (select auth.uid())) WITH CHECK ("user_interests"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_interests_owner_delete" ON "user_interests" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("user_interests"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_preferences_owner_select" ON "user_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_preferences_owner_insert" ON "user_preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_preferences_owner_update" ON "user_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user_preferences"."user_id" = (select auth.uid())) WITH CHECK ("user_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_preferences_owner_delete" ON "user_preferences" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("user_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "ai_recommendations_owner_select" ON "ai_recommendations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ai_recommendations"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "bigram_statistics_owner_select" ON "bigram_statistics" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("bigram_statistics"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "exercises_select" ON "exercises" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("exercises"."owner_id" is null or "exercises"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "key_statistics_owner_select" ON "key_statistics" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("key_statistics"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "learning_plans_owner_select" ON "learning_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("learning_plans"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "learning_profiles_owner_select" ON "learning_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("learning_profiles"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "session_statistics_owner_select" ON "session_statistics" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("session_statistics"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "typing_sessions_owner_select" ON "typing_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("typing_sessions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "ai_generations_owner_select" ON "ai_generations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ai_generations"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "subscription_plans_public_select" ON "subscription_plans" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "subscriptions_owner_select" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "usage_quotas_owner_select" ON "usage_quotas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("usage_quotas"."user_id" = (select auth.uid()));