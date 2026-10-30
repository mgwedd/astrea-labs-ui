'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, Bookmark, CheckCircle2, Eye, Lock, MoreHorizontal, Pin, Quote, SmilePlus, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  toast,
  cn,
} from '@astrea/ui';
import { createReplyAction, markSolutionAction, moderateAction, toggleBookmarkAction, toggleReactionAction } from '@/app/(site)/forum/actions';
import { initialsOf } from '@/lib/forum/format';
import type { AuthorView, ReactionSummary } from '@/lib/forum/service';
import { AuthorName } from './author-name';
import { ConfirmGate } from './confirm-gate';
import { EMPTY_VALUE, ForumEditor, type EditorValue } from './editor';
import { ForumBody } from './forum-body';
import { KindBadge, StatusBadge } from './report-badges';
import { StatusDialog, StatusTimeline, VoteButton, type ReportVM } from './report-panel';
import { KIND_LABEL, THREAD_KINDS, type ThreadKind } from '@/lib/forum/reports';

export type PostVM = {
  id: string;
  author: AuthorView;
  bodyHtml: string;
  /** Plain-text start of the body, for quoting. */
  excerpt: string;
  when: string;
  whenTitle: string;
  isSolution: boolean;
  /** First reply the viewer has not seen. Gets the "New since your last visit" divider. */
  firstNew: boolean;
  quote: { id: string; author: string; excerpt: string } | null;
  reactions: ReactionSummary[];
};

export type ThreadVM = {
  id: string;
  title: string;
  category: { slug: string; name: string };
  tags: string[];
  pinned: boolean;
  locked: boolean;
  /** Only admins can open an archived thread. */
  archived: boolean;
  answered: boolean;
  bookmarked: boolean;
  isAdmin: boolean;
  /** Admin only. */
  views?: number;
  viewers?: number;
  op: { author: AuthorView; bodyHtml: string; when: string; whenTitle: string; reactions: ReactionSummary[] };
  posts: PostVM[];
  canReply: boolean;
  /** Why the viewer cannot reply, when `canReply` is false. */
  replyBlocked: 'locked' | 'unconfirmed' | null;
  username: string;
  emoji: string[];
  kind: ThreadKind;
  /** Status, votes and history for a bug report or feature request. Null for discussions. */
  report: ReportVM | null;
};

/** Run a server action, toast a failure, refresh the server data on success. */
function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? 'Something went wrong');
      after?.();
      router.refresh();
    });
  return { act, pending, router };
}

function Reactions({ threadId, targetId, reactions, emoji }: { threadId: string; targetId: string; reactions: ReactionSummary[]; emoji: string[] }) {
  const { act, pending } = useAct();
  const toggle = (e: string) => act(() => toggleReactionAction(threadId, targetId, e));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => (
        <Button
          key={r.emoji}
          type="button"
          size="sm"
          variant={r.mine ? 'secondary' : 'outline'}
          className="h-7 gap-1 rounded-full px-2.5 text-xs"
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}${r.mine ? ', you reacted' : ''}`}
          disabled={pending}
          onClick={() => toggle(r.emoji)}
        >
          <span aria-hidden>{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </Button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Add reaction" disabled={pending}>
            <SmilePlus className="size-4" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex w-auto gap-1 p-1" align="start">
          {emoji.map((e) => (
            <Button key={e} type="button" size="icon" variant="ghost" className="size-8 text-base" aria-label={`React with ${e}`} onClick={() => toggle(e)}>
              {e}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ConfirmDelete({ open, onOpenChange, title, description, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PostHeader({ author, when, whenTitle, children }: { author: AuthorView; when: string; whenTitle: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <Avatar className="size-8">
        <AvatarFallback className="text-xs">{initialsOf(author.name)}</AvatarFallback>
      </Avatar>
      <AuthorName author={author} />
      <span className="text-muted-foreground" title={whenTitle}>
        {when}
      </span>
      {children}
    </div>
  );
}

function ReplyCard({
  post,
  thread,
  canMarkSolution,
  onQuote,
}: {
  post: PostVM;
  thread: ThreadVM;
  canMarkSolution: boolean;
  onQuote: (p: PostVM) => void;
}) {
  const { act, pending } = useAct();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      {post.firstNew && (
        <div className="flex items-center gap-3 text-xs font-medium text-primary" role="separator" aria-label="New since your last visit">
          <span className="h-px flex-1 bg-primary/30" />
          New since your last visit
          <span className="h-px flex-1 bg-primary/30" />
        </div>
      )}
      <article id={`post-${post.id}`} className={cn('flex flex-col gap-3 rounded-lg border p-4', post.isSolution && 'border-primary bg-primary/5')}>
        <PostHeader author={post.author} when={post.when} whenTitle={post.whenTitle}>
          {post.isSolution && (
            <Badge className="gap-1">
              <CheckCircle2 className="size-3" aria-hidden />
              Solution
            </Badge>
          )}
        </PostHeader>
        {post.quote && (
          <a href={`#post-${post.quote.id}`} className="block rounded-r-md border-l-2 border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{post.quote.author}</span> wrote: {post.quote.excerpt}
          </a>
        )}
        <ForumBody html={post.bodyHtml} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Reactions threadId={thread.id} targetId={post.id} reactions={post.reactions} emoji={thread.emoji} />
          <div className="flex flex-wrap items-center gap-1">
            {thread.canReply && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onQuote(post)}>
                <Quote data-icon="inline-start" aria-hidden />
                Quote
              </Button>
            )}
            {canMarkSolution && (
              <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => act(() => markSolutionAction(thread.id, post.isSolution ? null : post.id))}>
                <CheckCircle2 data-icon="inline-start" aria-hidden />
                {post.isSolution ? 'Unmark solution' : 'Mark as solution'}
              </Button>
            )}
            {thread.isAdmin && (
              <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Delete reply" onClick={() => setConfirm(true)}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </article>
      <ConfirmDelete
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this reply?"
        description="This removes the reply and its reactions. It cannot be undone."
        onConfirm={() => act(() => moderateAction({ kind: 'deletePost', postId: post.id }))}
      />
    </>
  );
}

function ReplyComposer({ thread, quote, onClearQuote }: { thread: ThreadVM; quote: PostVM | null; onClearQuote: () => void }) {
  const { act, pending } = useAct();
  const [value, setValue] = useState<EditorValue>(EMPTY_VALUE);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (thread.replyBlocked === 'locked')
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Lock className="size-4" aria-hidden />
        This thread is locked. New replies are turned off.
      </p>
    );
  if (thread.replyBlocked === 'unconfirmed') return <ConfirmGate username={thread.username} />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (value.empty) return setError('Write something first');
    void act(
      async () => {
        const r = await createReplyAction(thread.id, { body: { format: value.format, body: value.body }, quotePostId: quote?.id });
        if (!r.ok) setError(r.error);
        return r;
      },
      () => {
        setValue(EMPTY_VALUE);
        setResetKey((k) => k + 1);
        onClearQuote();
        toast.success('Reply posted');
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <h2 className="text-base font-semibold" id="reply-heading">
        Reply
      </h2>
      {quote && (
        <div className="flex items-start justify-between gap-2 rounded-r-md border-l-2 border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground">
          <span>
            Replying to <span className="font-medium text-foreground">{quote.author.name}</span>: {quote.excerpt}
          </span>
          <Button type="button" size="icon" variant="ghost" className="size-6 shrink-0" onClick={onClearQuote} aria-label="Remove quote">
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>
      )}
      <ForumEditor key={resetKey} aria-label="Reply" onChange={setValue} disabled={pending} placeholder="Write a reply" />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Post reply
        </Button>
      </div>
    </form>
  );
}

export function ThreadView({ thread }: { thread: ThreadVM }) {
  const { act, pending, router } = useAct();
  const [bookmarked, setBookmarked] = useState(thread.bookmarked);
  const [quote, setQuote] = useState<PostVM | null>(null);
  const [confirmThread, setConfirmThread] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const canMarkSolution = thread.isAdmin || thread.op.author.mine;

  const quoteIt = (p: PostVM) => {
    setQuote(p);
    document.getElementById('reply-heading')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href="/forum" className="hover:text-foreground hover:underline">
            Forum
          </Link>
          <span aria-hidden> / </span>
          <Link href={`/forum/c/${thread.category.slug}`} className="hover:text-foreground hover:underline">
            {thread.category.name}
          </Link>
        </nav>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{thread.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={thread.kind} />
          {thread.report && <StatusBadge kind={thread.report.kind} status={thread.report.status} />}
          {thread.pinned && (
            <Badge variant="outline" className="gap-1">
              <Pin className="size-3" aria-hidden />
              Pinned
            </Badge>
          )}
          {thread.locked && (
            <Badge variant="outline" className="gap-1">
              <Lock className="size-3" aria-hidden />
              Locked
            </Badge>
          )}
          {thread.archived && (
            <Badge variant="secondary" className="gap-1">
              <Archive className="size-3" aria-hidden />
              Archived
            </Badge>
          )}
          {thread.answered && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3" aria-hidden />
              Answered
            </Badge>
          )}
          {thread.tags.map((t) => (
            <Badge key={t} variant="outline" className="font-normal">
              {t}
            </Badge>
          ))}
          {thread.views !== undefined && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Admins only">
              <Eye className="size-3.5" aria-hidden />
              {thread.views} {thread.views === 1 ? 'view' : 'views'}
              {thread.viewers !== undefined && `, ${thread.viewers} ${thread.viewers === 1 ? 'viewer' : 'viewers'}`}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {thread.report && <VoteButton key={`${thread.report.voteCount}:${thread.report.voted}`} threadId={thread.id} report={thread.report} />}
            <Button
              type="button"
              size="sm"
              variant={bookmarked ? 'secondary' : 'outline'}
              aria-pressed={bookmarked}
              disabled={pending}
              onClick={() => {
                const next = !bookmarked;
                setBookmarked(next);
                act(
                  async () => {
                    const r = await toggleBookmarkAction(thread.id);
                    if (!r.ok) setBookmarked(!next);
                    else setBookmarked(r.data);
                    return r;
                  },
                );
              }}
            >
              <Bookmark data-icon="inline-start" aria-hidden className={cn(bookmarked && 'fill-current')} />
              {bookmarked ? 'Bookmarked' : 'Bookmark'}
            </Button>
            {thread.isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="size-9" aria-label="Moderate thread">
                    <MoreHorizontal className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {thread.report && <DropdownMenuItem onSelect={() => setStatusOpen(true)}>Change status…</DropdownMenuItem>}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Change type</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={thread.kind}
                        onValueChange={(v) => v !== thread.kind && act(() => moderateAction({ kind: 'threadKind', threadId: thread.id, value: v as ThreadKind }))}
                      >
                        {THREAD_KINDS.map((k) => (
                          <DropdownMenuRadioItem key={k} value={k}>
                            {KIND_LABEL[k]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => act(() => moderateAction({ kind: 'pin', threadId: thread.id, value: !thread.pinned }))}>
                    {thread.pinned ? 'Unpin' : 'Pin to top'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => act(() => moderateAction({ kind: 'lock', threadId: thread.id, value: !thread.locked }))}>
                    {thread.locked ? 'Unlock' : 'Lock replies'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => act(() => moderateAction({ kind: 'archive', threadId: thread.id, value: !thread.archived }))}>
                    {thread.archived ? 'Unarchive' : 'Archive'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmThread(true)}>
                    Delete thread
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <article className="flex flex-col gap-3 border-b pb-6">
        <PostHeader author={thread.op.author} when={thread.op.when} whenTitle={thread.op.whenTitle} />
        <ForumBody html={thread.op.bodyHtml} />
        <Reactions threadId={thread.id} targetId={thread.id} reactions={thread.op.reactions} emoji={thread.emoji} />
      </article>

      {thread.report && <StatusTimeline report={thread.report} />}

      <section aria-label="Replies" className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">
          {thread.posts.length} {thread.posts.length === 1 ? 'reply' : 'replies'}
        </h2>
        {thread.posts.map((p) => (
          <ReplyCard key={p.id} post={p} thread={thread} canMarkSolution={canMarkSolution} onQuote={quoteIt} />
        ))}
      </section>

      <ReplyComposer thread={thread} quote={quote} onClearQuote={() => setQuote(null)} />

      {thread.isAdmin && thread.report && <StatusDialog key={thread.report.status} threadId={thread.id} report={thread.report} open={statusOpen} onOpenChange={setStatusOpen} />}

      <ConfirmDelete
        open={confirmThread}
        onOpenChange={setConfirmThread}
        title="Delete this thread?"
        description="This removes the thread, every reply, reactions and bookmarks. It cannot be undone."
        onConfirm={() =>
          act(
            () => moderateAction({ kind: 'deleteThread', threadId: thread.id }),
            () => router.push('/forum'),
          )
        }
      />
    </div>
  );
}
