CREATE TABLE "email_campaign_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"email" text NOT NULL,
	"resend_email_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_suppressions" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"resend_email_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_campaign_sends" ADD CONSTRAINT "email_campaign_sends_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_campaign_sends_campaign_email_uq" ON "email_campaign_sends" USING btree ("campaign_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "email_campaign_sends_resend_email_id_uq" ON "email_campaign_sends" USING btree ("resend_email_id");--> statement-breakpoint
CREATE INDEX "email_campaign_sends_email_idx" ON "email_campaign_sends" USING btree ("email");--> statement-breakpoint
ALTER TABLE "email_campaigns" DROP COLUMN "broadcast_id";