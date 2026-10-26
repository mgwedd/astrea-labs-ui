import Link from 'next/link';
import {
  Badge,
  Button,
  Empty,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@astrea/ui';
import { Notice } from '@/components/admin/notice';
import { formatUtc } from '@/lib/admin/format';
import { FEEDBACK_STATUSES, type FeedbackStatus } from '@/lib/feedback/db/schema';
import { feedbackDbDeps } from '@/lib/feedback/server';
import { listSubmissions } from '@/lib/feedback/service';

const LABELS: Record<FeedbackStatus, string> = {
  pending_review: 'Pending review',
  unconfirmed: 'Unconfirmed',
  creating: 'Creating issue',
  approved: 'Approved',
  rejected: 'Rejected',
};
const ORDER: FeedbackStatus[] = ['pending_review', 'approved', 'rejected', 'creating', 'unconfirmed'];

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status: FeedbackStatus = FEEDBACK_STATUSES.find((s) => s === params.status) ?? 'pending_review';
  const rows = await listSubmissions(feedbackDbDeps(), status);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Feedback</h1>
      <Notice value={params.notice} />
      <nav aria-label="Feedback status" className="flex flex-wrap gap-2">
        {ORDER.map((s) => (
          <Button key={s} asChild size="sm" variant={s === status ? 'secondary' : 'ghost'}>
            <Link href={`/admin/feedback?status=${s}`} aria-current={s === status ? 'page' : undefined}>
              {LABELS[s]}
            </Link>
          </Button>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Empty title={`Nothing ${LABELS[status].toLowerCase()}`} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/feedback/${s.id}`} className="break-words underline-offset-4 hover:underline">
                      {s.title}
                    </Link>
                    {s.flagged && <Badge variant="destructive">Flagged</Badge>}
                  </div>
                </TableCell>
                <TableCell>{s.projectSlug}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {s.type}
                  </Badge>
                </TableCell>
                <TableCell className="break-all">{s.email}</TableCell>
                <TableCell className="whitespace-nowrap">{formatUtc(s.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {rows.length === 200 && <p className="text-sm text-muted-foreground">Showing the newest 200.</p>}
    </div>
  );
}
