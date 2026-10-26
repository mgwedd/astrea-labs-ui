import Link from 'next/link';
import { and, count, eq, gt, isNull, or } from 'drizzle-orm';
import { Card, CardDescription, CardHeader, CardTitle } from '@astrea/ui';
import { feedbackSubmissions } from '@/lib/feedback/db/schema';
import { getDb } from '@/lib/licensing/db/client';
import { betaApplications, licenses } from '@/lib/licensing/db/schema';

export default async function AdminHome() {
  const db = getDb();
  const now = new Date();
  const [[submitted], [active], [pending]] = await Promise.all([
    db.select({ n: count() }).from(betaApplications).where(eq(betaApplications.status, 'submitted')),
    db
      .select({ n: count() })
      .from(licenses)
      .where(and(isNull(licenses.revokedAt), isNull(licenses.replacedBy), or(isNull(licenses.expiresAt), gt(licenses.expiresAt, now)))),
    db.select({ n: count() }).from(feedbackSubmissions).where(eq(feedbackSubmissions.status, 'pending_review')),
  ]);

  const tiles = [
    { href: '/admin/licenses?status=submitted', label: 'Applications to review', value: submitted?.n ?? 0 },
    { href: '/admin/licenses', label: 'Active licenses', value: active?.n ?? 0 },
    { href: '/admin/feedback?status=pending_review', label: 'Feedback to review', value: pending?.n ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <CardDescription>{t.label}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{t.value}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
