-- Fase 6 — pemantauan tautan (08-INTEGRATION-AND-ROUTING.md §6).
--
-- Dua kolom di `applications` dibuang di bawah: `link_health` dan
-- `link_checked_at` ditambahkan pada Fase 2 sebagai persiapan dan tidak pernah
-- terisi. Menyimpannya berarti hasil pemeriksaan hidup di dua tempat, sementara
-- lima entity lain yang juga punya URL tidak punya kolom serupa. Tabel
-- `external_links` menggantikannya sebagai satu-satunya sumber.
CREATE TABLE "external_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" "audit_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"url" text NOT NULL,
	"status" "link_health",
	"http_status" integer,
	"redirect_target" text,
	"error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"checked_at" timestamp with time zone,
	"first_broken_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "applications_health_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "external_links_target_key" ON "external_links" USING btree ("entity","entity_id","field");--> statement-breakpoint
CREATE INDEX "external_links_status_idx" ON "external_links" USING btree ("status","checked_at");--> statement-breakpoint
CREATE INDEX "external_links_entity_idx" ON "external_links" USING btree ("entity","entity_id");--> statement-breakpoint
ALTER TABLE "applications" DROP COLUMN "link_health";--> statement-breakpoint
ALTER TABLE "applications" DROP COLUMN "link_checked_at";