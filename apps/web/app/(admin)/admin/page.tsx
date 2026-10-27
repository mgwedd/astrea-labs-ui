import Link from 'next/link';
import { CheckCheck, FileText, KeyRound, MailWarning, MessageSquare } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Empty } from '@astrea/ui';
import { formatUtc } from '@/lib/admin/format';
import { EXPIRY_WINDOW_DAYS, getOverview, type QueueItem } from '@/lib/admin/overview';
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

  const stats = [
    {
      href: '/admin/applications',
      label: 'Applications to review',
      value: o.applicationsToReview,
    },
    {
      href: '/admin/feedback',
      label: 'Feedback to review',
      value: o.feedbackToReview,
      hint: o.feedbackFlagged > 0 ? `${o.feedbackFlagged} flagged` : undefined,
    },
    {
      href: '/admin/licenses',
      label: 'Active licenses',
      value: o.activeLicenses,
      hint: o.licensesExpiringSoon > 0 ? `${o.licensesExpiringSoon} expire within ${EXPIRY_WINDOW_DAYS} days` : undefined,
    },
    {
      href: '/admin/licenses',
      label: 'Test licenses live',
      value: o.liveTestLicenses,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/licenses">New test license</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/emails">New campaign</Link>
          </Button>
        </div>
      </div>

      <section aria-label="At a glance" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
                {s.hint && <CardDescription>{s.hint}</CardDescription>}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card aria-labelledby="needs-you">
          <CardHeader>
            <CardTitle id="needs-you" className="flex items-center gap-2">
              Needs you
              {o.queue.length > 0 && <Badge variant="secondary">{o.applicationsToReview + o.feedbackToReview + o.emailsFailed}</Badge>}
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

        <Card aria-labelledby="last-campaign">
          <CardHeader>
            <CardTitle id="last-campaign">Last campaign</CardTitle>
          </CardHeader>
          <CardContent>
            {o.lastCampaign ? (
              <div className="flex flex-col gap-1">
                <span className="font-medium">{o.lastCampaign.subject}</span>
                <span className="text-xs text-muted-foreground">
                  {o.lastCampaign.audience} · {formatUtc(o.lastCampaign.sentAt)}
                </span>
                <div>
                  <Badge variant={o.lastCampaign.status === 'failed' || o.lastCampaign.status === 'partial' ? 'destructive' : 'secondary'}>{o.lastCampaign.status}</Badge>
                </div>
              </div>
            ) : (
              <Empty title="No campaigns sent" className="min-h-0" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
