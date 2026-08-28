ALTER TABLE "applications" ADD COLUMN "category" text;--> statement-breakpoint
CREATE INDEX "applications_category_idx" ON "applications" USING btree ("category","status");