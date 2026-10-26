# Forum data layer

Members-only forum. This directory is the data layer, access gate and service API; the pages live in `app/(site)/forum`.

| File | What |
| --- | --- |
| `db/schema.ts` | Drizzle tables (migration `drizzle/0010_forum.sql`) |
| `service.ts` | All reads and writes. Takes `deps` first, `viewer` second |
| `gate.ts` | `requireForumMember()` and `canUseForum(user)` |
| `server.ts` | `forumDeps()`: production deps (Neon) |
| `content.ts` | `sanitizeBody`, `markdownToHtml`, mention parsing |
| `names.ts` | handle generator, username rules |

## Using it from a page, action or route

```ts
const viewer = await requireForumMember('/forum/bookmarks'); // redirect to sign-in, or 403
const deps = forumDeps();
const page = await listThreads(deps, viewer, { categorySlug: 'aletheia', sort: 'latest', page: 1 });
```

Call `requireForumMember()` first in every forum page, server action and route handler. The services trust the `viewer` they are given. Add `export const dynamic = 'force-dynamic'`.

`/forum/**` is a gated area in `lib/auth/return-to.ts` (`AuthArea = 'forum'`), so middleware sends signed-out visitors to sign-in and back.

The header link is driven by `GET /api/forum/access` (`components/forum-nav.tsx`), fetched after hydration so public pages stay static.

Who gets in: admins (`ADMIN_EMAILS`), or a verified email that holds a license that is not revoked and not expired. Others: signed out gets a redirect, signed in without a license gets `forbidden()`.

## Errors

Services throw `ForumError` with `code`: `invalid` (zod or content problem, message is user-safe), `not_found`, `locked`, `forbidden`, `conflict`. Catch it in actions and show `message`.

## Viewer

`{ sub, email, isAdmin }`, returned by `requireForumMember()`. `sub` is the Auth0 user id and is what all tables key on.

## Service API

Bodies: `{ format: 'rich' | 'markdown', body: string }`. For `rich`, `body` is editor HTML; for `markdown`, the Markdown source. Both are sanitized on the server (allowlist: p, br, hr, h2-h4, ul, ol, li, blockquote, pre, code, em, strong, del, a; https and mailto links only; no images). Stored HTML is safe to render with `dangerouslySetInnerHTML`. Resolved `@mentions` come out as `<span class="mention" data-mention="name">@name</span>`, so style `.mention` in CSS. Max 20,000 characters of text.

Categories
- `listCategories(deps)`: `{ id, slug, name, group, sort, threadCount }[]`, ordered `aletheia`, `projects`, `lab`. Also syncs categories from `packages/research-registry` (Aletheia plus one per other project). The `lab` group is empty: TODO, the lab has not decided any categories.

Threads
- `listThreads(deps, viewer, { categorySlug?, sort?: 'latest' | 'top' | 'unanswered', page?, pageSize? })`: `{ items: ThreadSummary[], total, page, pageSize }`. `latest` puts pinned first. Omit `categorySlug` for all discussions.
- `getThread(deps, viewer, threadId)`: `ThreadDetail | null`: opening post, `posts` oldest first, reactions, `viewerLastViewedAt` (for "new since your last visit"), `answered`. Does not count a view.
- `recordView(deps, viewer, threadId)`: call after `getThread` on the thread page. One viewer counts once per hour.
- `createThread(deps, viewer, { categorySlug, title, tags?, body })`: `{ id }`. Title 3 to 140 chars, up to 3 lowercase tags.
- `createReply(deps, viewer, threadId, { body, quotePostId? })`: `{ id }`. `locked` error on locked threads unless admin.
- `markSolution(deps, viewer, threadId, postId | null)`: thread author or admin.
- `toggleReaction(deps, viewer, threadId, targetId, emoji)`: `targetId` is the thread id (opening post) or a post id. Returns whether it is now set. Allowed emoji: `REACTION_EMOJI`.
- `findSimilarThreads(deps, title, { limit?, categorySlug? })`: for the compose screen. `[]` for short or stop-word-only titles. Debounce on the client.

Bookmarks
- `toggleBookmark(deps, viewer, threadId)`: returns whether now bookmarked.
- `listBookmarks(deps, viewer, { page?, pageSize? })`: newest bookmark first, for the Bookmarks page.

Profile and mentions
- `getOwnProfile(deps, viewer)` / `updateOwnProfile(deps, viewer, { displayMode?, username? })`: `{ username, handle, displayMode, usernameConfirmed, displayName }`. The profile is created on first call (username from the email prefix, random handle like `dancing-stark`). Show a "confirm your username" prompt while `usernameConfirmed` is false. Handles are random and cannot be edited. Changing display mode does not rewrite old posts.
- `searchMentionable(deps, prefix, limit?)`: `{ name, mode }[]` for the `@` picker. Only the name a member currently posts under is searchable, so a handle is never linked to a username.

Admin only (throw `forbidden` for others; check `viewer.isAdmin` to decide whether to render the controls)
- `setPinned`, `setLocked`, `deleteThread`, `deletePost`.
- `getViewCounts(deps, viewer, threadIds)`: `Record<id, number>`.
- `findAccountByName(deps, viewer, name)`: the account behind a username or handle.

## Privacy rules built in

- **View counts are admin-only.** `ThreadSummary.views` and `ThreadDetail.views` / `viewers` exist only in an admin viewer's payload. Never add them for members.
- **Identity masking.** `author` is `{ name, mode, isStaff }`. `author.account = { sub, email }` is set only when `viewer.isAdmin`. Authors are snapshotted when they post, so switching between username and handle later does not link the two names. `isStaff` is true for an admin posting under their username.
- `forum_profiles.email` is admin-only. Do not select it anywhere a member can see it.

## Not built (the boards show them, the brief did not ask)

Following/watching and notifications, unread counts per category, thread search beyond similar-title, attachments and images, edit history, hide post, move category, "remove member from forum", draft saving (`Draft saved`). Add tables and services when those are scheduled. The mock's Lab categories (Announcements, Ideas and requests, Introductions) are sample data and are not seeded.
