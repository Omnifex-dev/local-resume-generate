CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"openai_key_enc" text,
	"openai_key_hint" varchar(4),
	"default_model" varchar(100),
	"default_prompt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "pdf_file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "json_file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar(10) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_single_row" CHECK ("id" = 1);
