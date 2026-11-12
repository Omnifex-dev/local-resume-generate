CREATE TABLE "pending_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(32) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"code_expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sends" integer DEFAULT 1 NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" varchar(254);--> statement-breakpoint
CREATE INDEX "pending_signups_email_idx" ON "pending_signups" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pending_signups_created_idx" ON "pending_signups" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");