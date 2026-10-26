import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Textarea,
} from '@astrea/ui';
import { approveFeedbackAction, rejectFeedbackAction } from '../../actions';
import { Details, type DetailRow as Row } from '@/components/admin/details';
import { Inbox, inboxHref, parseInboxQuery, STATUS_LABELS } from '@/components/admin/feedback/inbox';
import { ReplyCard } from '@/components/admin/feedback/reply-card';
import { replyNotice } from '@/components/admin/feedback/reply-notice';
import { Notice } from '@/components/admin/notice';
import { SubmitButton } from '@/components/admin/submit-button';
import { formatUtc } from '@/lib/admin/format';
import { feedbackDbDeps } from '@/lib/feedback/server';
import { listReplies } from '@/lib/feedback/replies';
import { getSubmission, listSubmissions, statusCounts } from '@/lib/feedback/service';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedbackDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const deps = feedbackDbDeps();
  const s = await getSubmission(deps, id);
  if (!s) notFound();
  const inbox = parseInboxQuery(query);
  const [rows, counts, replies] = await Promise.all([listSubmissions(deps, inbox.status, inbox), statusCounts(deps), listReplies(deps, id)]);
  const reviewable = s.status === 'pending_review';

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <Inbox rows={rows} counts={counts} query={inbox} selectedId={s.id} className="hidden lg:flex lg:w-96 lg:shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button asChild variant="link" className="self-start px-0 lg:hidden">
          <Link href={inboxHref(inbox)}>Back to feedback</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-words text-2xl font-semibold">{s.title}</h1>
          <Badge variant="outline" className="capitalize">
            {s.type}
          </Badge>
          <Badge variant="secondary">{STATUS_LABELS[s.status]}</Badge>
        </div>
      </div>
      <Notice value={query.notice} />

      {s.flagged && (
        <Alert variant="destructive">
          <AlertTitle>Flagged</AlertTitle>
          <AlertDescription>
            {s.flagReason ? `${s.flagReason} ` : ''}Check it before it goes to a public issue.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Submission</CardTitle>
          <CardDescription>The sender’s email is private and is not in the issue draft.</CardDescription>
        </CardHeader>
        <CardContent>
          <Details
            rows={[
              ['Project', s.projectSlug],
              ['From', s.email],
              ['Received', formatUtc(s.createdAt)],
              ['Confirmed', formatUtc(s.confirmedAt)],
              ...Object.entries(s.fields).map(([k, v]): Row => [k, v || '—']),
              ...(s.reviewedAt ? [['Reviewed', formatUtc(s.reviewedAt)] as Row] : []),
              ...(s.reviewNote ? [['Review note', s.reviewNote] as Row] : []),
              ...(s.issueUrl
                ? [
                    [
                      'Issue',
                      <a key="v" href={s.issueUrl} className="underline underline-offset-4" target="_blank" rel="noreferrer">
                        #{s.issueNumber}
                      </a>,
                    ] as Row,
                  ]
                : []),
            ]}
          />
        </CardContent>
      </Card>

      <ReplyCard
        submissionId={s.id}
        email={s.email}
        canReply={Boolean(s.email.trim() && s.confirmedAt)}
        thread={replies.map((r) => ({ id: r.id, body: r.body, sentBy: r.sentBy, sentAt: r.sentAt.toISOString() }))}
        notice={replyNotice(query.reply)}
      />

      {reviewable && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create GitHub issue</CardTitle>
              <CardDescription>Edit the draft before it is posted.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={approveFeedbackAction}>
                <input type="hidden" name="id" value={s.id} />
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="issue-title">Title</FieldLabel>
                    <Input id="issue-title" name="title" required maxLength={256} defaultValue={s.draft.title} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="issue-body">Body</FieldLabel>
                    <Textarea id="issue-body" name="body" required rows={12} className="font-mono text-xs" defaultValue={s.draft.body} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="issue-labels">Labels</FieldLabel>
                    <Input id="issue-labels" name="labels" defaultValue={s.draft.labels.join(', ')} />
                    <FieldDescription>Comma-separated.</FieldDescription>
                  </Field>
                  <div>
                    <SubmitButton>Create issue</SubmitButton>
                  </div>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reject</CardTitle>
              <CardDescription>Nothing is posted and the sender is not emailed.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={rejectFeedbackAction}>
                <input type="hidden" name="id" value={s.id} />
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="reject-note">Note (optional, internal)</FieldLabel>
                    <Textarea id="reject-note" name="note" maxLength={500} />
                  </Field>
                  <div>
                    <SubmitButton variant="destructive">Reject</SubmitButton>
                  </div>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
