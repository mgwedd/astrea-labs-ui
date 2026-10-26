import type { Metadata } from 'next';
import { Separator, SidebarInset, SidebarProvider, SidebarTrigger } from '@astrea/ui';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { HeaderBreadcrumbs } from '@/components/admin/shell/header-breadcrumbs';
import { ThemeToggle } from '@/components/theme-toggle';
import { requireAdmin } from '@/lib/admin/gate';
import { getNavCounts } from '@/lib/admin/overview';
import { getDb } from '@/lib/licensing/db/client';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const counts = await getNavCounts({ db: getDb() });

  return (
    <SidebarProvider>
      <AdminSidebar email={user.email ?? ''} counts={counts} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <HeaderBreadcrumbs />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main id="content" className="min-w-0 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
