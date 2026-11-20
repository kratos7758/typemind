ALTER TABLE "session_statistics" ADD COLUMN "correct_chars" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "typing_sessions" ADD COLUMN "exercise_key" text;--> statement-breakpoint
CREATE INDEX "typing_sessions_user_exercise_idx" ON "typing_sessions" USING btree ("user_id","exercise_key");