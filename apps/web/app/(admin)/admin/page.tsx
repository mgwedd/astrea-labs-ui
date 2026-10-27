import Link from 'next/link';
import { CheckCheck, FileText, KeyRound, MailWarning, MessageSquare, MessagesSquare } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Empty } from '@astrea/ui';
import { formatUtc } from '@/lib/admin/format';
import { KIND_SHORT, isReportKind, statusLabel } from '@/lib/forum/reports';
import { getOverview, type QueueItem } from '@/lib/admin/overview';
import { getDb } from '@/lib/licensing/db/client';

const KIND = {
  application: { icon: FileText, label: 'Application', action: 'Review' },
  feedback: { icon: MessageSquare, label: 'Feedback', action: 'Review' },
  license: { icon: KeyRound, label: 'Expiring', action: 'Open' },
  email: { icon: MailWarning, label: 'Not sent', action: 'Open' },
} as const;

function QueueRow({ item }: { item: QueueItem }) {
  const { icon: Icon, label, action } = KIND[item.kind];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-6 py-3 last:border-b-0">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-1 basis-56 flex-col">
        <span className="truncate font-medium">{item.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {item.meta} · {formatUtc(item.at)}
        </span>
      </div>
      <Badge variant={item.flagged ? 'destructive' : 'secondary'}>{item.flagged && item.kind !== 'email' ? 'Flagged' : label}</Badge>
      <Button asChild variant="outline" size="sm">
        <Link href={item.href}>{action}</Link>
      </Button>
    </li>
  );
}

export default async function AdminHome() {
  const o = await getOverview({ db: getDb() });
  const waiting = o.applicationsToReview + o.feedbackToReview + o.emailsFailed + o.licensesExpiringSoon;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link href="/admin/licenses">New test license</Link>
        </Button>
      </div>

      <Card aria-labelledby="needs-you">
        <CardHeader>
          <CardTitle id="needs-you" className="flex items-center gap-2">
            Needs you
            {waiting > 0 && <Badge variant="secondary">{waiting}</Badge>}
          </CardTitle>
          <CardDescription>Flagged first, then oldest first.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {o.queue.length === 0 ? (
            <div className="px-6">
              <Empty icon={CheckCheck} title="Nothing waiting" description="No applications or feedback to review, and no licenses expiring soon." className="min-h-0" />
            </div>
          ) : (
            <ul>
              {o.queue.map((item) => (
                <QueueRow key={`${item.kind}:${item.id}`} item={item} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card aria-labelledby="forum-activity">
        <CardHeader>
          <CardTitle id="forum-activity">Forum activity</CardTitle>
          <CardDescription>
            <Link href="/forum/reports" className="underline-offset-4 hover:underline">
              {o.openReports === 0 ? 'No open bug reports or feature requests' : `${o.openReports} open bug ${o.openReports === 1 ? 'report or feature request' : 'reports and feature requests'}`}
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {o.forumActivity.length === 0 ? (
            <div className="px-6">
              <Empty icon={MessagesSquare} title="No threads yet" className="min-h-0" />
            </div>
          ) : (
            <ul>
              {o.forumActivity.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-6 py-3 last:border-b-0">
                  <Badge variant={t.kind === 'discussion' ? 'outline' : 'secondary'}>{KIND_SHORT[t.kind]}</Badge>
                  <Link href={`/forum/t/${t.id}`} className="flex min-w-0 flex-1 basis-56 flex-col underline-offset-4 hover:underline">
                    <span className="truncate font-medium">{t.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[t.category, isReportKind(t.kind) && t.status ? statusLabel(t.kind, t.status) : null, `${t.replyCount} ${t.replyCount === 1 ? 'reply' : 'replies'}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatUtc(t.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link href="/admin/licenses" className="underline-offset-4 hover:underline">
          {o.activeLicenses} active {o.activeLicenses === 1 ? 'license' : 'licenses'} · {o.liveTestLicenses} test {o.liveTestLicenses === 1 ? 'license' : 'licenses'} live
        </Link>
      </p>
    </div>
  );
}
