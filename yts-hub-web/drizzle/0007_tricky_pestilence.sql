ALTER TYPE "public"."audit_entity" ADD VALUE 'announcement';--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"description" text,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_unit_id" uuid,
	"banner_text" text NOT NULL,
	"cta_label" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"is_highlighted" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('indonesian', coalesce("title", '')), 'A') || setweight(to_tsvector('indonesian', coalesce("summary", '')), 'B') || setweight(to_tsvector('indonesian', coalesce("description", '')), 'C')) STORED
);
--> statement-breakpoint
CREATE TABLE "announcements_to_applications" (
	"announcement_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "announcements_to_applications_announcement_id_application_id_pk" PRIMARY KEY("announcement_id","application_id")
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_owner_unit_id_units_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements_to_applications" ADD CONSTRAINT "announcements_to_applications_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements_to_applications" ADD CONSTRAINT "announcements_to_applications_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "announcements_slug_key" ON "announcements" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "announcements_code_key" ON "announcements" USING btree ("code");--> statement-breakpoint
CREATE INDEX "announcements_active_idx" ON "announcements" USING btree ("status","visibility","start_at");--> statement-breakpoint
CREATE INDEX "announcements_owner_idx" ON "announcements" USING btree ("owner_unit_id");--> statement-breakpoint
CREATE INDEX "announcements_search_idx" ON "announcements" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "announcements_to_applications_app_idx" ON "announcements_to_applications" USING btree ("application_id");