CREATE TABLE "forum_bookmarks" (
	"auth0_sub" text NOT NULL,
	"thread_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_bookmarks_auth0_sub_thread_id_pk" PRIMARY KEY("auth0_sub","thread_id")
);
--> statement-breakpoint
CREATE TABLE "forum_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"group" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "forum_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "forum_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"post_id" uuid,
	"mentioned_sub" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_sub" text NOT NULL,
	"author_name" text NOT NULL,
	"author_mode" text NOT NULL,
	"author_is_staff" boolean DEFAULT false NOT NULL,
	"body_html" text NOT NULL,
	"body_format" text NOT NULL,
	"body_source" text,
	"quote_post_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_profiles" (
	"auth0_sub" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"handle" text NOT NULL,
	"display_mode" text DEFAULT 'username' NOT NULL,
	"username_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_reactions" (
	"target_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"auth0_sub" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_reactions_target_id_auth0_sub_emoji_pk" PRIMARY KEY("target_id","auth0_sub","emoji")
);
--> statement-breakpoint
CREATE TABLE "forum_thread_views" (
	"thread_id" uuid NOT NULL,
	"auth0_sub" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"first_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_thread_views_thread_id_auth0_sub_pk" PRIMARY KEY("thread_id","auth0_sub")
);
--> statement-breakpoint
CREATE TABLE "forum_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"author_sub" text NOT NULL,
	"author_name" text NOT NULL,
	"author_mode" text NOT NULL,
	"author_is_staff" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"body_html" text NOT NULL,
	"body_format" text NOT NULL,
	"body_source" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"solution_post_id" uuid,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_bookmarks" ADD CONSTRAINT "forum_bookmarks_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_mentions" ADD CONSTRAINT "forum_mentions_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_mentions" ADD CONSTRAINT "forum_mentions_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_thread_views" ADD CONSTRAINT "forum_thread_views_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_category_id_forum_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."forum_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forum_mentions_sub_idx" ON "forum_mentions" USING btree ("mentioned_sub","created_at");--> statement-breakpoint
CREATE INDEX "forum_posts_thread_created_idx" ON "forum_posts" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_profiles_username_idx" ON "forum_profiles" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_profiles_handle_idx" ON "forum_profiles" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "forum_reactions_thread_idx" ON "forum_reactions" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "forum_threads_category_activity_idx" ON "forum_threads" USING btree ("category_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "forum_threads_author_idx" ON "forum_threads" USING btree ("author_sub");--> statement-breakpoint
INSERT INTO "forum_categories" ("slug", "name", "group", "sort") VALUES ('aletheia', 'Aletheia', 'aletheia', 0) ON CONFLICT ("slug") DO NOTHING;
