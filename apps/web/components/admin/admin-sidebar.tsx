import { LogOut } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@astrea/ui';
import { SidebarNav, type NavCounts } from './shell/sidebar-nav';

export function AdminSidebar({ email, counts }: { email: string; counts: NavCounts }) {
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <p className="text-sm font-semibold">Astrea Labs</p>
        <p className="text-xs text-muted-foreground">Admin</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav counts={counts} />
      </SidebarContent>
      <SidebarFooter>
        <p className="truncate px-2 text-xs text-muted-foreground">{email}</p>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              {/* Plain anchor: /auth/logout is a route handler, not a page. */}
              <a href="/auth/logout">
                <LogOut />
                <span>Sign out</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
