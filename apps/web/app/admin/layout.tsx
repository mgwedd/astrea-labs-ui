import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@astrea/ui';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { isAdminUser } from '@/lib/admin/allowlist';
import { auth0 } from '@/lib/auth0';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth0.getSession();
  if (!session) redirect('/auth/login?returnTo=/admin');

  const { user } = session;
  if (!isAdminUser(user)) {
    return (
      <div className="container flex min-h-[60vh] flex-col items-start justify-center gap-4 py-16">
        <h1 className="text-2xl font-semibold">403: not authorized</h1>
        <p className="text-muted-foreground">
          {user.email ?? 'This account'} is not on the admin list, or its email is not verified.
        </p>
        <a href="/auth/logout" className="text-sm underline underline-offset-4">
          Sign out
        </a>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AdminSidebar email={user.email ?? ''} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
