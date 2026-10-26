'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Badge,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@astrea/ui';
import { isActive, PRIMARY_NAV, type NavItem } from './nav-items';

export type NavCounts = { applications: number; feedback: number };

function Group({ items, counts, pathname }: { items: NavItem[]; counts: NavCounts; pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(({ href, label, icon: Icon, badge }) => {
            const active = isActive(pathname, href);
            const n = badge ? counts[badge] : 0;
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={active} tooltip={label}>
                  <Link href={href} aria-current={active ? 'page' : undefined}>
                    <Icon />
                    <span>{label}</span>
                    {n > 0 && (
                      <Badge variant="secondary" className="ml-auto" aria-label={`${n} waiting`}>
                        {n}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function SidebarNav({ counts }: { counts: NavCounts }) {
  const pathname = usePathname();
  return <Group items={PRIMARY_NAV} counts={counts} pathname={pathname} />;
}
