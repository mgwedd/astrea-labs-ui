import { redirect } from 'next/navigation';
import { desc, ilike, or, sql } from 'drizzle-orm';
import { Button, Input } from '@astrea/ui';
import { LicenseSection } from '@/components/admin/licenses/license-section';
import { LicenseTable } from '@/components/admin/licenses/license-table';
import { Notice } from '@/components/admin/notice';
import { TestLicenses } from '@/components/admin/test-licenses';
import { requireAdmin } from '@/lib/admin/gate';
import { groupLicenses } from '@/lib/admin/review-lists';
import { getDb } from '@/lib/licensing/db/client';
import { licenses } from '@/lib/licensing/db/schema';
import { listTestLicenses } from '@/lib/licensing/test-license';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const LIMIT = 500;

export default async function LicensesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  // The applications table used to live here; keep old ?status= links working.
  if (typeof params.status === 'string') redirect(`/admin/applications?status=${encodeURIComponent(params.status)}`);
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';

  const db = getDb();
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const match = q ? or(ilike(licenses.email, like), sql`${licenses.lid}::text ilike ${like}`) : undefined;
  const [all, tests] = await Promise.all([
    db.select().from(licenses).where(match).orderBy(desc(licenses.issuedAt)).limit(LIMIT),
    listTestLicenses({ db }),
  ]);
  const { issued, expired, revoked } = groupLicenses(all, q);
  const liveTests = tests.filter((t) => !t.revokedAt).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Licenses</h1>
      <Notice value={params.notice} />

      <form method="get" action="/admin/licenses" className="flex max-w-md gap-2">
        <Input name="q" defaultValue={q} placeholder="Search email or license ID" aria-label="Search licenses" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <LicenseSection title="Issued" count={issued.length} defaultOpen={issued.length > 0}>
        <LicenseTable rows={issued} empty="No active licenses." />
      </LicenseSection>
      <LicenseSection title="Expired" count={expired.length} hint={expired.length ? 'Includes replaced licenses' : undefined} defaultOpen={Boolean(q) && expired.length > 0}>
        <LicenseTable rows={expired} empty="No expired licenses." />
      </LicenseSection>
      <LicenseSection title="Revoked" count={revoked.length} defaultOpen={Boolean(q) && revoked.length > 0}>
        <LicenseTable rows={revoked} empty="No revoked licenses." />
      </LicenseSection>
      {all.length === LIMIT && <p className="text-sm text-muted-foreground">Showing the newest {LIMIT} licenses. Search to narrow them.</p>}

      <LicenseSection
        title="Test licenses"
        count={`${liveTests} live`}
        hint="They expire on their own; keys stay hidden until revealed."
        defaultOpen
      >
        <div className="p-5">
          <TestLicenses licenses={tests} />
        </div>
      </LicenseSection>
    </div>
  );
}
