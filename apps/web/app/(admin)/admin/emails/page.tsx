import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@astrea/ui';
import { CampaignComposer } from '@/components/admin/emails/campaign-composer';
import { Notice } from '@/components/admin/notice';
import { formatUtc } from '@/lib/admin/format';
import { audienceLabel, audienceOptions } from '@/lib/email/audience';
import { emailCampaigns } from '@/lib/email/db/schema';
import { getDb } from '@/lib/licensing/db/client';
import { listFailed, listRecent } from '@/lib/email/outbox';
import { dismissEmail, retryEmail } from './actions';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EmailsPage({ searchParams }: Props) {
  const query = await searchParams;
  const db = getDb();
  const [past, failed, recent] = await Promise.all([
    db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.sentAt)).limit(50),
    listFailed({ db }),
    listRecent({ db }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Emails</h1>
      <Notice value={query.notice} />
      {failed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Not sent
              <Badge variant="destructive">{failed.length}</Badge>
            </CardTitle>
            <CardDescription>
              These emails failed to send. Retry sends the same message. Key link emails are not kept, so send a new one from Licenses with Email a new key
              link, then dismiss the row here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Tries</TableHead>
                  <TableHead>Last try</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failed.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="break-all">{e.to}</TableCell>
                    <TableCell className="max-w-56 break-words whitespace-normal">{e.subject}</TableCell>
                    <TableCell className="max-w-72 break-words whitespace-normal text-muted-foreground">{e.error}</TableCell>
                    <TableCell>{e.attempts}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatUtc(e.lastAttemptAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {e.textBody === null ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/licenses?q=${encodeURIComponent(e.to)}`}>Licenses</Link>
                          </Button>
                        ) : (
                          <form action={retryEmail}>
                            <input type="hidden" name="id" value={e.id} />
                            <Button type="submit" size="sm">
                              Retry
                            </Button>
                          </form>
                        )}
                        <form action={dismissEmail}>
                          <input type="hidden" name="id" value={e.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            Dismiss
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>New campaign</CardTitle>
          <CardDescription>Paste or upload HTML. Sent as a Resend Broadcast to contacts who opted in on their account.</CardDescription>
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
      <Card>
        <CardHeader>
          <CardTitle>Account emails</CardTitle>
          <CardDescription>License links and application and feedback notices, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Last try</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="break-all">{e.to}</TableCell>
                    <TableCell className="max-w-64 break-words whitespace-normal">{e.subject}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatUtc(e.lastAttemptAt)}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === 'failed' ? 'destructive' : e.status === 'sent' ? 'secondary' : 'outline'}>
                        {e.status === 'failed' ? 'not sent' : e.status}
                      </Badge>
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
