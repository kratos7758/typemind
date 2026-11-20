-- Reference data required by the application (also needed in production, hence not in seed.sql).
-- Prices are launch hypotheses (PRD §6) and stay editable in the database.

INSERT INTO public.keyboard_layouts (id, name, sort_order) VALUES
  ('fr-azerty', 'Français — AZERTY', 10),
  ('ca-fr-csa', 'Canadien français — CSA', 20),
  ('ca-multi', 'Canadien multilingue standard', 30),
  ('us-qwerty', 'English (US) — QWERTY', 40),
  ('uk-qwerty', 'English (UK) — QWERTY', 50),
  ('de-qwertz', 'Deutsch — QWERTZ', 60)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO public.subscription_plans (id, name, price_cents, currency, interval, entitlements) VALUES
  ('free', 'Free', 0, 'cad', NULL,
    '{"aiGenerationsPerMonth": 3, "historyDays": 7, "aiCoach": false, "advancedAnalytics": false}'),
  ('pro_monthly', 'Pro', 999, 'cad', 'month',
    '{"aiGenerationsPerMonth": 150, "historyDays": null, "aiCoach": true, "advancedAnalytics": true}'),
  ('pro_yearly', 'Pro Annual', 7999, 'cad', 'year',
    '{"aiGenerationsPerMonth": 150, "historyDays": null, "aiCoach": true, "advancedAnalytics": true}')
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- Creates the per-user rows when an auth user signs up.
-- SECURITY DEFINER + empty search_path: runs with owner rights, every name fully qualified.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  bracket public.age_bracket;
  ui public.locale;
BEGIN
  -- Metadata comes from the client: accept only known values, ignore anything else.
  IF meta->>'age_bracket' IN ('14_17', '18_plus') THEN
    bracket := (meta->>'age_bracket')::public.age_bracket;
  END IF;
  ui := CASE WHEN meta->>'locale' = 'en' THEN 'en'::public.locale ELSE 'fr'::public.locale END;

  INSERT INTO public.profiles (id, display_name, age_bracket)
  VALUES (new.id, left(nullif(trim(meta->>'display_name'), ''), 60), bracket);

  INSERT INTO public.user_preferences (user_id, ui_language, content_language)
  VALUES (new.id, ui, ui);

  INSERT INTO public.learning_profiles (user_id) VALUES (new.id);

  INSERT INTO public.subscriptions (user_id, plan_id, status) VALUES (new.id, 'free', 'active');

  RETURN new;
END;
$$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
