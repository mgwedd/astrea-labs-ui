import { hasBearer } from '@/lib/licensing/auth';
import { licensingDeps } from '@/lib/licensing/server';
import { pruneRequestThrottle, runRenewals } from '@/lib/licensing/service';

// Daily Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!hasBearer(request, process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const deps = licensingDeps();
  await pruneRequestThrottle(deps);
  const result = await runRenewals(deps);
  if (result.failed.length) console.error(`license renewals: ${result.failed.length} failed`);
  return Response.json(result);
}
