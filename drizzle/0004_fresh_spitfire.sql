ALTER TABLE "educations" ADD COLUMN "field" varchar(200);--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "location" varchar(200);--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "extras" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "headline" varchar(120);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "location" varchar(200);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "skills" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "languages" text;