CREATE TABLE "beta_applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"answers" jsonb NOT NULL,
	"consents" jsonb NOT NULL,
	"updates_opt_in" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sign_link_hash" text,
	"sign_link_expires_at" timestamp with time zone,
	"sign_link_used_at" timestamp with time zone,
	"session_hash" text,
	"session_expires_at" timestamp with time zone,
	"email_confirmed_at" timestamp with time zone,
	"draft_pdf_path" text,
	"draft_pdf_sha256" text,
	"signature_block" jsonb,
	"document_created_at" timestamp with time zone,
	"document_viewed_at" timestamp with time zone,
	"document_id" uuid,
	"lid" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"reviewer" text NOT NULL,
	"decision" text NOT NULL,
	"license_check" jsonb,
	"notes" text,
	"lid" uuid,
	"decided_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lid" uuid NOT NULL,
	"application_id" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "key_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "signed_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"doc_type" text NOT NULL,
	"doc_version" text NOT NULL,
	"application_id" uuid,
	"signer_email" text NOT NULL,
	"signer_name" text NOT NULL,
	"answers" jsonb NOT NULL,
	"blocks" jsonb NOT NULL,
	"typed_signature" text NOT NULL,
	"email_confirmed_at" timestamp with time zone NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"signer_ip" text,
	"signer_ua" text,
	"unsigned_sha256" text NOT NULL,
	"pdf_path" text NOT NULL,
	"pdf_sha256" text NOT NULL,
	"audit_path" text NOT NULL,
	"audit_sha256" text NOT NULL,
	"seal_alg" text NOT NULL,
	"seal_key_id" text NOT NULL,
	"seal_fingerprint" text,
	"seal" text NOT NULL,
	"supersedes" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_sends" ALTER COLUMN "lid" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "beta_applications_email_idx" ON "beta_applications" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "beta_applications_sign_link_idx" ON "beta_applications" USING btree ("sign_link_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "beta_applications_session_idx" ON "beta_applications" USING btree ("session_hash");--> statement-breakpoint
CREATE INDEX "document_reviews_document_idx" ON "document_reviews" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signed_documents_signer_idx" ON "signed_documents" USING btree ("doc_type","signer_email");--> statement-breakpoint
CREATE INDEX "signed_documents_application_idx" ON "signed_documents" USING btree ("application_id");