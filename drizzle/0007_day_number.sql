ALTER TABLE "generations" ADD COLUMN "day_number" integer;--> statement-breakpoint
UPDATE "generations" SET "day_number" = substring("pdf_file_name" from '^([0-9]{1,6})-')::integer WHERE "pdf_file_name" ~ '^[0-9]{1,6}-';
