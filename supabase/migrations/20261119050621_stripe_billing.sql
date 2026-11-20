ALTER TYPE "public"."subscription_status" ADD VALUE 'paused';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_updated_at" timestamp with time zone;