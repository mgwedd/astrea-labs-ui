import { Inbox, parseInboxQuery } from '@/components/admin/feedback/inbox';
import { Notice } from '@/components/admin/notice';
import { feedbackDbDeps } from '@/lib/feedback/server';
import { listSubmissions, statusCounts } from '@/lib/feedback/service';

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseInboxQuery(params);
  const deps = feedbackDbDeps();
  const [rows, counts] = await Promise.all([listSubmissions(deps, query.status, query), statusCounts(deps)]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="text-sm text-muted-foreground">Turn confirmed reports into GitHub issues, message the reporter, or reject them quietly.</p>
      </div>
      <Notice value={params.notice} />
      <Inbox rows={rows} counts={counts} query={query} />
    </div>
  );
}
