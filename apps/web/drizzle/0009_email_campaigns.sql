CREATE TABLE "email_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"audience" text NOT NULL,
	"sent_by" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"broadcast_id" text,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_preferences" (
	"auth0_sub" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"product_opt_in_at" timestamp with time zone,
	"news_opt_in_at" timestamp with time zone,
	"product_slugs" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_campaigns_sent_at_idx" ON "email_campaigns" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "email_preferences_email_idx" ON "email_preferences" USING btree ("email");