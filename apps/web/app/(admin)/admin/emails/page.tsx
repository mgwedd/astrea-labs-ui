import { desc } from 'drizzle-orm';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@astrea/ui';
import { CampaignComposer } from '@/components/admin/campaign-composer';
import { Notice } from '@/components/admin/notice';
import { formatUtc } from '@/lib/admin/format';
import { audienceLabel, audienceOptions } from '@/lib/email/audience';
import { emailCampaigns } from '@/lib/email/db/schema';
import { getDb } from '@/lib/licensing/db/client';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EmailsPage({ searchParams }: Props) {
  const query = await searchParams;
  const past = await getDb().select().from(emailCampaigns).orderBy(desc(emailCampaigns.sentAt)).limit(50);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Emails</h1>
      <Notice value={query.notice} />
      <Card>
        <CardHeader>
          <CardTitle>New campaign</CardTitle>
          <CardDescription>Sent as a Resend Broadcast to contacts who opted in on their account.</CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignComposer audiences={audienceOptions()} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Past sends</CardTitle>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Sent by</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {past.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-64 break-words whitespace-normal">{c.subject}</TableCell>
                    <TableCell>{audienceLabel(c.audience)}</TableCell>
                    <TableCell>{c.sentBy}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatUtc(c.sentAt)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'sent' ? 'secondary' : 'destructive'}>{c.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
