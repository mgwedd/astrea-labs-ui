import Link from 'next/link';
import { BookOpen, KeyRound, LogOut, Mail, MessageSquare, Users } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@astrea/ui';

const sections = [
  { href: '/admin/licenses', label: 'Licenses', icon: KeyRound },
  { href: '/admin/users', label: 'Users (per app)', icon: Users },
  { href: '/admin/writing', label: 'Writing', icon: BookOpen },
  { href: '/admin/emails', label: 'Emails', icon: Mail },
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
];

export function AdminSidebar({ email }: { email: string }) {
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 text-sm font-semibold">Admin</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild>
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
