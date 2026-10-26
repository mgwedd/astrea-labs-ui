import { BookOpen, Inbox, KeyRound, LayoutDashboard, Mail, MessageSquare, Users, type LucideIcon } from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: 'applications' | 'feedback' };

export const PRIMARY_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/applications', label: 'Applications', icon: Inbox, badge: 'applications' },
  { href: '/admin/licenses', label: 'Licenses', icon: KeyRound },
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare, badge: 'feedback' },
  { href: '/admin/emails', label: 'Emails', icon: Mail },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/writing', label: 'Writing', icon: BookOpen },
];

/** Overview matches only itself; every other item also matches its sub-routes. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

const TITLES: Record<string, string> = {
  applications: 'Applications',
  licenses: 'Licenses',
  feedback: 'Feedback',
  emails: 'Emails',
  users: 'Users',
  writing: 'Writing',
  documents: 'Documents',
};

/** Breadcrumb trail for an /admin pathname. Dynamic segments (ids) show as "Detail". */
export function breadcrumbs(pathname: string): { href: string; label: string }[] {
  const parts = pathname.split('/').filter(Boolean).slice(1);
  const trail = [{ href: '/admin', label: 'Overview' }];
  parts.forEach((part, i) => {
    trail.push({ href: `/admin/${parts.slice(0, i + 1).join('/')}`, label: TITLES[part] ?? 'Detail' });
  });
  return trail;
}
