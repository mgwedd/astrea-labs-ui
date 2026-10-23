CREATE TABLE "feedback_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'unconfirmed' NOT NULL,
	"email" text NOT NULL,
	"project_slug" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"fields" jsonb NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"issue_number" integer,
	"issue_url" text,
	CONSTRAINT "feedback_submissions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "agreement_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" text NOT NULL,
	"version" text NOT NULL,
	"sha256" text NOT NULL,
	"subject" text NOT NULL,
	"subject_verified" boolean NOT NULL,
	"ticks" jsonb NOT NULL,
	"shown_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE INDEX "feedback_submissions_email_created_idx" ON "feedback_submissions" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "feedback_submissions_status_idx" ON "feedback_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agreement_acceptances_subject_idx" ON "agreement_acceptances" USING btree ("agreement_id","subject","accepted_at");--> statement-breakpoint
CREATE TRIGGER agreement_acceptances_append_only
  BEFORE UPDATE OR DELETE ON agreement_acceptances
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER agreement_acceptances_no_truncate
  BEFORE TRUNCATE ON agreement_acceptances
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
