import { hasBearer } from '@/lib/licensing/auth';
import { betaDeps, errType, json } from '@/lib/beta-access/server';
import { cleanupDrafts, cleanupEmailLogs } from '@/lib/beta-access/service';

// Daily Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
// Deletes unsigned drafts older than 7 days and their draft PDFs, and email logs older than 90 days.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!hasBearer(request, process.env.CRON_SECRET)) return json({ error: 'Unauthorized' }, 401);
  try {
    const deps = betaDeps(request);
    return json({ ...(await cleanupDrafts(deps)), emailLogs: await cleanupEmailLogs(deps) });
  } catch (err) {
    console.error('beta cleanup failed', errType(err));
    return json({ error: 'failed' }, 500);
  }
}
