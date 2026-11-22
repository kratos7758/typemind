-- Explicit table privileges for the API roles (ADR-028).
-- Recent Supabase projects no longer grant privileges on new public tables to
-- anon/authenticated by default (the local CLI still does). withUserDb() runs as
-- `authenticated`, so without these grants every RLS-scoped read fails in production.
-- Privileges mirror the RLS policies exactly; RLS still decides which rows are visible.
-- Idempotent: safe to run again.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
--> statement-breakpoint

GRANT SELECT ON public.keyboard_layouts, public.subscription_plans TO anon, authenticated;
--> statement-breakpoint

GRANT SELECT ON
  public.app_admins,
  public.profiles,
  public.user_interests,
  public.user_preferences,
  public.ai_recommendations,
  public.bigram_statistics,
  public.exercises,
  public.key_statistics,
  public.learning_plans,
  public.learning_profiles,
  public.session_statistics,
  public.typing_sessions,
  public.ai_generations,
  public.subscriptions,
  public.usage_quotas
TO authenticated;
--> statement-breakpoint

-- The only tables users write directly (ADR-012).
GRANT INSERT, UPDATE, DELETE ON public.user_interests, public.user_preferences TO authenticated;
