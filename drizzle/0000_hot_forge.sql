CREATE TYPE "public"."competition_level" AS ENUM('newcomer', 'novice', 'intermediate', 'advanced', 'allstar', 'champion');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'in_progress', 'compositing', 'complete');--> statement-breakpoint
CREATE TYPE "public"."skill_source" AS ENUM('coach', 'ai', 'student');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'coach', 'admin');--> statement-breakpoint
CREATE TYPE "public"."video_status" AS ENUM('uploading', 'processing', 'ready', 'review_in_progress', 'reviewed', 'error');--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"event_id" uuid,
	"location" text,
	"schedule_date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"lesson_duration_minutes" integer DEFAULT 45 NOT NULL,
	"gap_minutes" integer DEFAULT 0 NOT NULL,
	"max_students" integer,
	"booking_open_at" timestamp,
	"priority_booking_open_at" timestamp,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"availability_block_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_interests_block_student_unique" UNIQUE("availability_block_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "booking_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"coach_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"notes" text,
	"student_notes_before" text,
	"student_notes_after" text
);
--> statement-breakpoint
CREATE TABLE "coach_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coach_events_coach_event_unique" UNIQUE("coach_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "coach_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_student_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coach_students_coach_student_unique" UNIQUE("coach_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "event_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"coach_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_interests_event_coach_student_unique" UNIQUE("event_id","coach_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"city" text NOT NULL,
	"state_or_region" text NOT NULL,
	"country" text DEFAULT 'US' NOT NULL,
	"lat" real,
	"lng" real,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"is_local" boolean DEFAULT false NOT NULL,
	"external_event_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invisible_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invisible_blocks_coach_student_unique" UNIQUE("coach_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"availability_block_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"student_id" uuid,
	"booked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"site_name" text DEFAULT 'Perfect Rhythm' NOT NULL,
	"tagline" text,
	"logo_path" text,
	"accent_color" text,
	"owner_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skill_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "skill_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skill_definitions_name_category_unique" UNIQUE("name","category_id")
);
--> statement-breakpoint
CREATE TABLE "student_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_student_id" uuid NOT NULL,
	"skill_definition_id" uuid NOT NULL,
	"current_score" integer DEFAULT 5 NOT NULL,
	"effort_to_improve" integer DEFAULT 5 NOT NULL,
	"improvement_benefit" integer DEFAULT 5 NOT NULL,
	"priority_score" integer DEFAULT 5 NOT NULL,
	"source" "skill_source" DEFAULT 'student' NOT NULL,
	"coach_locked" boolean DEFAULT false NOT NULL,
	"coach_priority" integer,
	"student_priority" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_skills_coach_student_definition_unique" UNIQUE("coach_student_id","skill_definition_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"avatar_url" text,
	"bio" text,
	"leader_level" "competition_level",
	"follower_level" "competition_level",
	"years_dancing" integer,
	"phone" text,
	"password_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "video_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"coach_id" uuid NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"annotations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"voice_track_path" text,
	"composite_mux_asset_id" text,
	"composite_mux_playback_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"supabase_storage_path" text NOT NULL,
	"mux_asset_id" text,
	"mux_playback_id" text,
	"duration_seconds" integer,
	"status" "video_status" DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_interests" ADD CONSTRAINT "booking_interests_availability_block_id_availability_blocks_id_fk" FOREIGN KEY ("availability_block_id") REFERENCES "public"."availability_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_interests" ADD CONSTRAINT "booking_interests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_slot_id_lesson_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."lesson_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_events" ADD CONSTRAINT "coach_events_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_events" ADD CONSTRAINT "coach_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_notes" ADD CONSTRAINT "coach_notes_coach_student_id_coach_students_id_fk" FOREIGN KEY ("coach_student_id") REFERENCES "public"."coach_students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_students" ADD CONSTRAINT "coach_students_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_students" ADD CONSTRAINT "coach_students_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_interests" ADD CONSTRAINT "event_interests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_interests" ADD CONSTRAINT "event_interests_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_interests" ADD CONSTRAINT "event_interests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invisible_blocks" ADD CONSTRAINT "invisible_blocks_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invisible_blocks" ADD CONSTRAINT "invisible_blocks_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_slots" ADD CONSTRAINT "lesson_slots_availability_block_id_availability_blocks_id_fk" FOREIGN KEY ("availability_block_id") REFERENCES "public"."availability_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_slots" ADD CONSTRAINT "lesson_slots_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_definitions" ADD CONSTRAINT "skill_definitions_category_id_skill_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."skill_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_coach_student_id_coach_students_id_fk" FOREIGN KEY ("coach_student_id") REFERENCES "public"."coach_students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_skill_definition_id_skill_definitions_id_fk" FOREIGN KEY ("skill_definition_id") REFERENCES "public"."skill_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_reviews" ADD CONSTRAINT "video_reviews_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_reviews" ADD CONSTRAINT "video_reviews_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bookings_coach" ON "booking_requests" USING btree ("coach_id","status");--> statement-breakpoint
CREATE INDEX "idx_bookings_student" ON "booking_requests" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "idx_coach_events_coach" ON "coach_events" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "idx_event_interests_coach_event" ON "event_interests" USING btree ("coach_id","event_id");--> statement-breakpoint
CREATE INDEX "idx_invisible_blocks_lookup" ON "invisible_blocks" USING btree ("coach_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_slots_availability" ON "lesson_slots" USING btree ("availability_block_id","status");--> statement-breakpoint
CREATE INDEX "idx_slots_time" ON "lesson_slots" USING btree ("start_time") WHERE "lesson_slots"."status" = 'available';--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_student_skills_coach_student" ON "student_skills" USING btree ("coach_student_id");--> statement-breakpoint
CREATE INDEX "idx_student_skills_priority" ON "student_skills" USING btree ("coach_student_id","priority_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_videos_student" ON "videos" USING btree ("student_id");