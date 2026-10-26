ALTER TABLE "licenses" ADD COLUMN "revoked_by" text;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "attestation_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "attested_at" timestamp with time zone;