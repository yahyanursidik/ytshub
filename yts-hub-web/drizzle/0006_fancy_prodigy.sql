CREATE TYPE "public"."error_level" AS ENUM('warning', 'error');--> statement-breakpoint
CREATE TABLE "error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"level" "error_level" DEFAULT 'error' NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"path" text,
	"context" jsonb,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE TABLE "outbound_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"target_host" text NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "error_log" ADD CONSTRAINT "error_log_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "error_log_fingerprint_key" ON "error_log" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "error_log_last_seen_idx" ON "error_log" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "error_log_open_idx" ON "error_log" USING btree ("resolved_at","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_clicks_key" ON "outbound_clicks" USING btree ("path","target_host","day");--> statement-breakpoint
CREATE INDEX "outbound_clicks_day_idx" ON "outbound_clicks" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "page_views_path_day_key" ON "page_views" USING btree ("path","day");--> statement-breakpoint
CREATE INDEX "page_views_day_idx" ON "page_views" USING btree ("day");