CREATE TABLE "educations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"university" varchar(200) NOT NULL,
	"degree" varchar(200),
	"location" varchar(200),
	"start_date" varchar(7) NOT NULL,
	"end_date" varchar(7),
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company" varchar(200) NOT NULL,
	"role" varchar(200) NOT NULL,
	"start_date" varchar(7) NOT NULL,
	"end_date" varchar(7),
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100),
	"email" varchar(254),
	"phone" varchar(40),
	"linkedin" varchar(300),
	"github" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "educations" ADD CONSTRAINT "educations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "educations_user_id_idx" ON "educations" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "experiences_user_id_idx" ON "experiences" USING btree ("user_id","sort_order");