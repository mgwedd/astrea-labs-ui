CREATE TABLE "email_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"kind" text NOT NULL,
	"lid" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"lid" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"updates_opt_in" boolean DEFAULT false NOT NULL,
	"tier" text DEFAULT 'beta' NOT NULL,
	"kid" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"replaced_by" uuid,
	"renewal_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_sends_email_sent_at_idx" ON "email_sends" USING btree ("email","sent_at");--> statement-breakpoint
CREATE INDEX "licenses_email_idx" ON "licenses" USING btree ("email");--> statement-breakpoint
CREATE INDEX "licenses_expires_at_idx" ON "licenses" USING btree ("expires_at");