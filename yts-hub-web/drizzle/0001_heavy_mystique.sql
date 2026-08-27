-- DITAMBAHKAN MANUAL. Sisa file ini dihasilkan drizzle-kit; empat statement di bawah
-- tidak bisa dihasilkannya (CREATE EXTENSION dan index atas ekspresi), jadi ditulis
-- tangan dan tidak boleh dihapus saat migrasi berikutnya di-generate.
--
-- pg_trgm dipakai untuk toleransi salah ketik: 07-SEARCH-AND-FAQ.md §5 mengizinkan
-- "trigram/fuzzy support bila perlu", dan §7 mewajibkan halaman tanpa hasil
-- menawarkan koreksi kata kunci — itu mustahil tanpa ukuran kemiripan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
-- Index untuk pencarian kemiripan pada judul/pertanyaan. gin_trgm_ops, bukan GiST:
-- pencarian di sini selalu baca, tidak pernah update per-baris, jadi GIN lebih cepat.
CREATE INDEX "faqs_question_trgm_idx" ON "faqs" USING gin (lower("question") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "services_title_trgm_idx" ON "services" USING gin (lower("title") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "programs_title_trgm_idx" ON "programs" USING gin (lower("title") gin_trgm_ops);--> statement-breakpoint
CREATE TYPE "public"."faq_feedback_reason" AS ENUM('kurang-jelas', 'kurang-lengkap', 'sudah-tidak-berlaku', 'bukan-jawaban-yang-dicari');--> statement-breakpoint
CREATE TYPE "public"."search_entity" AS ENUM('faq', 'service', 'program', 'unit', 'event', 'application');--> statement-breakpoint
CREATE TABLE "faq_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faq_id" uuid NOT NULL,
	"is_helpful" boolean NOT NULL,
	"reason" "faq_feedback_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_raw" text NOT NULL,
	"query_normalized" text NOT NULL,
	"result_count" integer NOT NULL,
	"clicked_entity" "search_entity",
	"clicked_slug" text,
	"clicked_rank" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('indonesian', coalesce("name", '')), 'A') || setweight(to_tsvector('indonesian', coalesce("title", '')), 'A') || setweight(to_tsvector('indonesian', coalesce("summary", '')), 'B') || setweight(to_tsvector('indonesian', coalesce("description", '')), 'C')) STORED;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('indonesian', coalesce("title", '')), 'A') || setweight(to_tsvector('indonesian', coalesce("summary", '')), 'B') || setweight(to_tsvector('indonesian', coalesce("description", '')), 'C') || setweight(to_tsvector('indonesian', coalesce("location", '')), 'C') || setweight(to_tsvector('indonesian', coalesce("speaker_summary", '')), 'C')) STORED;--> statement-breakpoint
ALTER TABLE "faqs" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('indonesian', coalesce("question", '')), 'A') || setweight(to_tsvector('indonesian', coalesce("summary", '')), 'B') || setweight(to_tsvector('indonesian', coalesce("answer", '')), 'C')) STORED;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('indonesian', coalesce("title", '')), 'A') || setweight(to_tsvector('indonesian', coalesce("category", '')), 'B') || setweight(to_tsvector('indonesian', coalesce("summary", '')), 'B') || setweight(to_tsvector('indonesian', coalesce("description", '')), 'C') || setweight(to_tsvector('indonesian', coalesce("schedule_summary", '')), 'C') || setweight(to_tsvector('indonesian', coalesce("location_summary", '')), 'C')) STORED;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('indonesian', coalesce("title", '')), 'A') || setweight(to_tsvector('indonesian', coalesce("category", '')), 'B') || setweight(to_tsvector('indonesian', coalesce("summary", '')), 'B') || setweight(to_tsvector('indonesian', coalesce("description", '')), 'C') || setweight(to_tsvector('indonesian', coalesce("requirements", '')), 'C') || setweight(to_tsvector('indonesian', coalesce("service_channel", '')), 'C')) STORED;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('indonesian', coalesce("title", '')), 'A') || setweight(to_tsvector('indonesian', coalesce("short_name", '')), 'A') || setweight(to_tsvector('indonesian', coalesce("summary", '')), 'B') || setweight(to_tsvector('indonesian', coalesce("about", '')), 'C')) STORED;--> statement-breakpoint
ALTER TABLE "faq_feedback" ADD CONSTRAINT "faq_feedback_faq_id_faqs_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faq_feedback_faq_idx" ON "faq_feedback" USING btree ("faq_id","created_at");--> statement-breakpoint
CREATE INDEX "search_queries_normalized_idx" ON "search_queries" USING btree ("query_normalized");--> statement-breakpoint
CREATE INDEX "search_queries_created_idx" ON "search_queries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "search_queries_zero_idx" ON "search_queries" USING btree ("result_count","created_at");--> statement-breakpoint
CREATE INDEX "applications_search_idx" ON "applications" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "events_search_idx" ON "events" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "faqs_search_idx" ON "faqs" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "faqs_keywords_idx" ON "faqs" USING gin ("keywords");--> statement-breakpoint
CREATE INDEX "programs_search_idx" ON "programs" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "services_search_idx" ON "services" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "units_search_idx" ON "units" USING gin ("search_vector");