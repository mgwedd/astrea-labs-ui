CREATE TABLE "test_licenses" (
	"lid" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"kid" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by" text NOT NULL
);
