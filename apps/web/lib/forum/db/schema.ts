import { REPORT_STATUSES, THREAD_KINDS } from '../reports';
import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Members forum. Accounts are identified by their Auth0 `sub`, the same id email_preferences uses.
// Nothing here stores IP addresses or device ids.

export const FORUM_GROUPS = ['aletheia', 'projects', 'lab'] as const;
export type ForumGroup = (typeof FORUM_GROUPS)[number];
export const BODY_FORMATS = ['rich', 'markdown'] as const;
export type BodyFormat = (typeof BODY_FORMATS)[number];
export const DISPLAY_MODES = ['username', 'handle'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];
// A thread is a discussion, a bug report or a feature request. Reports carry a status that staff move.
export { REPORT_STATUSES, THREAD_KINDS, type ReportStatus, type ThreadKind } from '../reports';

// One row per board. Aletheia is seeded by the migration; project boards are synced from
// packages/research-registry (see syncCategories). Nothing else is invented.
export const forumCategories = pgTable('forum_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  group: text('group', { enum: FORUM_GROUPS }).notNull(),
  sort: integer('sort').notNull().default(0),
});

// One row per member who has opened the forum. `username` and `handle` are both lowercase and
// unique across the pair, so a mention name is never ambiguous. `email` is for admins only.
export const forumProfiles = pgTable(
  'forum_profiles',
  {
    auth0Sub: text('auth0_sub').primaryKey(),
    email: text('email').notNull(), // lowercased; admin-only, never sent to members
    username: text('username').notNull(),
    handle: text('handle').notNull(), // random, like dancing-stark
    displayMode: text('display_mode', { enum: DISPLAY_MODES }).notNull().default('username'),
    usernameConfirmedAt: timestamp('username_confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('forum_profiles_username_idx').on(t.username), uniqueIndex('forum_profiles_handle_idx').on(t.handle)],
);

// Author columns on threads and posts are a snapshot of how the author appeared at the time, so
// switching between username and handle later does not link the two names.
export const forumThreads = pgTable(
  'forum_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => forumCategories.id),
    authorSub: text('author_sub').notNull(),
    authorName: text('author_name').notNull(),
    authorMode: text('author_mode', { enum: DISPLAY_MODES }).notNull(),
    authorIsStaff: boolean('author_is_staff').notNull().default(false),
    title: text('title').notNull(),
    bodyHtml: text('body_html').notNull(), // sanitized
    bodyFormat: text('body_format', { enum: BODY_FORMATS }).notNull(),
    bodySource: text('body_source'), // the Markdown source when bodyFormat = 'markdown'
    tags: text('tags').array().notNull().default([]),
    pinned: boolean('pinned').notNull().default(false),
    locked: boolean('locked').notNull().default(false),
    solutionPostId: uuid('solution_post_id'),
    replyCount: integer('reply_count').notNull().default(0),
    kind: text('kind', { enum: THREAD_KINDS }).notNull().default('discussion'),
    status: text('status', { enum: REPORT_STATUSES }), // null for discussions
    duplicateOfId: uuid('duplicate_of_id'),
    voteCount: integer('vote_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('forum_threads_category_activity_idx').on(t.categoryId, t.lastActivityAt),
    index('forum_threads_author_idx').on(t.authorSub),
    index('forum_threads_kind_status_idx').on(t.kind, t.status),
  ],
);

export const forumPosts = pgTable(
  'forum_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    authorSub: text('author_sub').notNull(),
    authorName: text('author_name').notNull(),
    authorMode: text('author_mode', { enum: DISPLAY_MODES }).notNull(),
    authorIsStaff: boolean('author_is_staff').notNull().default(false),
    bodyHtml: text('body_html').notNull(), // sanitized
    bodyFormat: text('body_format', { enum: BODY_FORMATS }).notNull(),
    bodySource: text('body_source'),
    quotePostId: uuid('quote_post_id'), // a post being replied to; null = the thread itself
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('forum_posts_thread_created_idx').on(t.threadId, t.createdAt)],
);

// An emoji reaction on the opening post (targetId = thread id) or on a reply (targetId = post id).
export const forumReactions = pgTable(
  'forum_reactions',
  {
    targetId: uuid('target_id').notNull(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    auth0Sub: text('auth0_sub').notNull(),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.targetId, t.auth0Sub, t.emoji] }), index('forum_reactions_thread_idx').on(t.threadId)],
);

export const forumBookmarks = pgTable(
  'forum_bookmarks',
  {
    auth0Sub: text('auth0_sub').notNull(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.auth0Sub, t.threadId] })],
);

// Views per thread and viewer, admin-only. A repeat visit inside an hour is not counted again.
export const forumThreadViews = pgTable(
  'forum_thread_views',
  {
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    auth0Sub: text('auth0_sub').notNull(),
    count: integer('count').notNull().default(1),
    firstViewedAt: timestamp('first_viewed_at', { withTimezone: true }).notNull().defaultNow(),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.auth0Sub] })],
);

// A mention of a member in a thread body (postId null) or a reply.
export const forumMentions = pgTable(
  'forum_mentions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').references(() => forumPosts.id, { onDelete: 'cascade' }),
    mentionedSub: text('mentioned_sub').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('forum_mentions_sub_idx').on(t.mentionedSub, t.createdAt)],
);

// "Me too" votes on bug reports and feature requests. One per member per thread.
export const forumVotes = pgTable(
  'forum_votes',
  {
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    auth0Sub: text('auth0_sub').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.auth0Sub] })],
);

// Each status change on a report, shown as a timeline on the thread.
export const forumStatusEvents = pgTable(
  'forum_status_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status', { enum: REPORT_STATUSES }),
    toStatus: text('to_status', { enum: REPORT_STATUSES }).notNull(),
    actorSub: text('actor_sub').notNull(),
    actorName: text('actor_name').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('forum_status_events_thread_idx').on(t.threadId, t.createdAt)],
);

export type ForumCategory = typeof forumCategories.$inferSelect;
export type ForumProfile = typeof forumProfiles.$inferSelect;
export type ForumThread = typeof forumThreads.$inferSelect;
export type ForumPost = typeof forumPosts.$inferSelect;
