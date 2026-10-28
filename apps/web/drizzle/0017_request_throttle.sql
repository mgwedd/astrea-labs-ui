CREATE TABLE "request_throttle" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "request_throttle_key_at_idx" ON "request_throttle" USING btree ("key","at");