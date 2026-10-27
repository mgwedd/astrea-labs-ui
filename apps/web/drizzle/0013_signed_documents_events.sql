ALTER TABLE "signed_documents" ALTER COLUMN "audit_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "signed_documents" ALTER COLUMN "audit_sha256" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "signed_documents" ADD COLUMN "events" jsonb;