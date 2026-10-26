import { permanentRedirect } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The application page moved to /admin/applications/[id]. Keeps old links and emailed notices working. */
export default async function LegacyApplicationPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const notice = typeof query.notice === 'string' ? `?notice=${encodeURIComponent(query.notice)}` : '';
  permanentRedirect(`/admin/applications/${encodeURIComponent(id)}${notice}`);
}
