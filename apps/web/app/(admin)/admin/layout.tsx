import type { Metadata } from 'next';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@astrea/ui';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { requireAdmin } from '@/lib/admin/gate';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <SidebarProvider>
      <AdminSidebar email={user.email ?? ''} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main id="content" className="p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
