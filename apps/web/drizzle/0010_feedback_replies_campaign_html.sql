CREATE TABLE "feedback_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"body" text NOT NULL,
	"sent_by" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN "body_html" text;--> statement-breakpoint
ALTER TABLE "feedback_replies" ADD CONSTRAINT "feedback_replies_submission_id_feedback_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."feedback_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_replies_submission_sent_idx" ON "feedback_replies" USING btree ("submission_id","sent_at");