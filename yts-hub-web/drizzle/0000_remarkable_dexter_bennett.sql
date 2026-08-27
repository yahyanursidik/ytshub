CREATE TYPE "public"."application_kind" AS ENUM('aplikasi', 'website', 'portal');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'in_review', 'approved', 'published', 'needs_review', 'archived');--> statement-breakpoint
CREATE TYPE "public"."event_format" AS ENUM('onsite', 'online', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."link_health" AS ENUM('healthy', 'redirected', 'warning', 'broken');--> statement-breakpoint
CREATE TYPE "public"."program_status" AS ENUM('berjalan', 'akan-datang', 'selesai');--> statement-breakpoint
CREATE TYPE "public"."unit_kind" AS ENUM('pendidikan', 'dakwah', 'sosial', 'digital', 'operasional');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'internal', 'restricted');--> statement-breakpoint
CREATE TABLE "applications" (
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
	"owner_unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "application_kind" NOT NULL,
	"url" text,
	"cta_label" text DEFAULT 'Buka' NOT NULL,
	"technical_owner" text,
	"repository_reference" text,
	"hosting_provider" text,
	"database_provider" text,
	"integration_notes" text,
	"criticality" text,
	"link_health" "link_health",
	"link_checked_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_unit_id" uuid NOT NULL,
	"label" text NOT NULL,
	"channel" text NOT NULL,
	"value" text,
	"note" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
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
	"organizer_unit_id" uuid NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"format" "event_format" DEFAULT 'onsite' NOT NULL,
	"location" text,
	"map_url" text,
	"speaker_summary" text,
	"registration_url" text,
	"related_program_id" uuid
);
--> statement-breakpoint
CREATE TABLE "faq_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"summary" text
);
--> statement-breakpoint
CREATE TABLE "faqs" (
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
	"owner_unit_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"helpful_yes" integer DEFAULT 0 NOT NULL,
	"helpful_no" integer DEFAULT 0 NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs_to_programs" (
	"faq_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	CONSTRAINT "faqs_to_programs_faq_id_program_id_pk" PRIMARY KEY("faq_id","program_id")
);
--> statement-breakpoint
CREATE TABLE "faqs_to_services" (
	"faq_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "faqs_to_services_faq_id_service_id_pk" PRIMARY KEY("faq_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "programs" (
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
	"owner_unit_id" uuid NOT NULL,
	"category" text NOT NULL,
	"program_status" "program_status" DEFAULT 'akan-datang' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"schedule_summary" text,
	"location_summary" text,
	"cta_label" text,
	"cta_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs_to_audiences" (
	"program_id" uuid NOT NULL,
	"audience_id" uuid NOT NULL,
	CONSTRAINT "programs_to_audiences_program_id_audience_id_pk" PRIMARY KEY("program_id","audience_id")
);
--> statement-breakpoint
CREATE TABLE "programs_to_services" (
	"program_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "programs_to_services_program_id_service_id_pk" PRIMARY KEY("program_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
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
	"owner_unit_id" uuid NOT NULL,
	"category" text NOT NULL,
	"requirements" text,
	"process_steps" text,
	"fee_information" text,
	"service_channel" text,
	"cta_label" text NOT NULL,
	"cta_url" text,
	"is_external" boolean DEFAULT false NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services_to_audiences" (
	"service_id" uuid NOT NULL,
	"audience_id" uuid NOT NULL,
	CONSTRAINT "services_to_audiences_service_id_audience_id_pk" PRIMARY KEY("service_id","audience_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
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
	"short_name" text NOT NULL,
	"kind" "unit_kind" NOT NULL,
	"about" text,
	"website_url" text,
	"parent_unit_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_owner_unit_id_units_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_unit_id_units_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_unit_id_units_id_fk" FOREIGN KEY ("organizer_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_related_program_id_programs_id_fk" FOREIGN KEY ("related_program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_owner_unit_id_units_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_category_id_faq_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."faq_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs_to_programs" ADD CONSTRAINT "faqs_to_programs_faq_id_faqs_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs_to_programs" ADD CONSTRAINT "faqs_to_programs_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs_to_services" ADD CONSTRAINT "faqs_to_services_faq_id_faqs_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs_to_services" ADD CONSTRAINT "faqs_to_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_owner_unit_id_units_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs_to_audiences" ADD CONSTRAINT "programs_to_audiences_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs_to_audiences" ADD CONSTRAINT "programs_to_audiences_audience_id_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs_to_services" ADD CONSTRAINT "programs_to_services_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs_to_services" ADD CONSTRAINT "programs_to_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_owner_unit_id_units_id_fk" FOREIGN KEY ("owner_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services_to_audiences" ADD CONSTRAINT "services_to_audiences_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services_to_audiences" ADD CONSTRAINT "services_to_audiences_audience_id_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_parent_unit_id_fk" FOREIGN KEY ("parent_unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_slug_key" ON "applications" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_code_key" ON "applications" USING btree ("code");--> statement-breakpoint
CREATE INDEX "applications_owner_idx" ON "applications" USING btree ("owner_unit_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status","visibility");--> statement-breakpoint
CREATE INDEX "applications_health_idx" ON "applications" USING btree ("link_health");--> statement-breakpoint
CREATE UNIQUE INDEX "audiences_slug_key" ON "audiences" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "contacts_owner_idx" ON "contacts" USING btree ("owner_unit_id","is_public");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_key" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "events_code_key" ON "events" USING btree ("code");--> statement-breakpoint
CREATE INDEX "events_organizer_idx" ON "events" USING btree ("organizer_unit_id");--> statement-breakpoint
CREATE INDEX "events_start_idx" ON "events" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status","visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "faq_categories_slug_key" ON "faq_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "faqs_slug_key" ON "faqs" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "faqs_code_key" ON "faqs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "faqs_category_idx" ON "faqs" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "faqs_owner_idx" ON "faqs" USING btree ("owner_unit_id");--> statement-breakpoint
CREATE INDEX "faqs_status_idx" ON "faqs" USING btree ("status","visibility");--> statement-breakpoint
CREATE INDEX "faqs_popular_idx" ON "faqs" USING btree ("is_popular","status");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_slug_key" ON "programs" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_code_key" ON "programs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "programs_owner_idx" ON "programs" USING btree ("owner_unit_id");--> statement-breakpoint
CREATE INDEX "programs_status_idx" ON "programs" USING btree ("status","visibility");--> statement-breakpoint
CREATE INDEX "programs_program_status_idx" ON "programs" USING btree ("program_status");--> statement-breakpoint
CREATE INDEX "programs_to_audiences_audience_idx" ON "programs_to_audiences" USING btree ("audience_id");--> statement-breakpoint
CREATE UNIQUE INDEX "services_slug_key" ON "services" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "services_code_key" ON "services" USING btree ("code");--> statement-breakpoint
CREATE INDEX "services_owner_idx" ON "services" USING btree ("owner_unit_id");--> statement-breakpoint
CREATE INDEX "services_status_idx" ON "services" USING btree ("status","visibility");--> statement-breakpoint
CREATE INDEX "services_popular_idx" ON "services" USING btree ("is_popular","status");--> statement-breakpoint
CREATE INDEX "services_to_audiences_audience_idx" ON "services_to_audiences" USING btree ("audience_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_key" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "units_slug_key" ON "units" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "units_code_key" ON "units" USING btree ("code");--> statement-breakpoint
CREATE INDEX "units_status_idx" ON "units" USING btree ("status","visibility");--> statement-breakpoint
CREATE INDEX "units_review_due_idx" ON "units" USING btree ("review_due_at");--> statement-breakpoint
CREATE INDEX "units_parent_idx" ON "units" USING btree ("parent_unit_id");