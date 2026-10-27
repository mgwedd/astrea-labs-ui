CREATE TABLE "forum_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_sub" text NOT NULL,
	"actor_name" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_votes" (
	"thread_id" uuid NOT NULL,
	"auth0_sub" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_votes_thread_id_auth0_sub_pk" PRIMARY KEY("thread_id","auth0_sub")
);
--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "kind" text DEFAULT 'discussion' NOT NULL;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "duplicate_of_id" uuid;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "vote_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "forum_status_events" ADD CONSTRAINT "forum_status_events_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_votes" ADD CONSTRAINT "forum_votes_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forum_status_events_thread_idx" ON "forum_status_events" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "forum_threads_kind_status_idx" ON "forum_threads" USING btree ("kind","status");