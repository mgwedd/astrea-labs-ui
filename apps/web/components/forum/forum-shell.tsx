'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, ChevronRight, Menu, MessageSquare, PenLine, Settings } from 'lucide-react';
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from '@astrea/ui';
import type { CategoryRow } from '@/lib/forum/service';

type Category = Pick<CategoryRow, 'id' | 'slug' | 'name' | 'group' | 'threadCount'>;

function NavLink({ href, active, children, onNavigate }: { href: string; active: boolean; children: React.ReactNode; onNavigate?: boolean }) {
  const link = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        active && 'bg-accent font-medium text-accent-foreground',
      )}
    >
      {children}
    </Link>
  );
  return onNavigate ? <SheetClose asChild>{link}</SheetClose> : link;
}

function CategoryLink({ c, pathname, sheet }: { c: Category; pathname: string; sheet?: boolean }) {
  const href = `/forum/c/${c.slug}`;
  return (
    <NavLink href={href} active={pathname === href} onNavigate={sheet}>
      <span className="min-w-0 flex-1 truncate">{c.name}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{c.threadCount}</span>
    </NavLink>
  );
}

function Group({ label, items, collapsible, pathname, sheet }: { label: string; items: Category[]; collapsible: boolean; pathname: string; sheet?: boolean }) {
  if (items.length === 0) return null;
  const list = (
    <div className="flex flex-col gap-0.5">
      {items.map((c) => (
        <CategoryLink key={c.id} c={c} pathname={pathname} sheet={sheet} />
      ))}
    </div>
  );
  if (!collapsible) {
    return (
      <div className="flex flex-col gap-1">
        <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {list}
      </div>
    );
  }
  // Collapsed by default; open when the page you are on belongs to the group.
  const hasActive = items.some((c) => pathname === `/forum/c/${c.slug}`);
  return (
    <Collapsible defaultOpen={hasActive} className="group/collapsible flex flex-col gap-1">
      <CollapsibleTrigger className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none" aria-hidden />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>{list}</CollapsibleContent>
    </Collapsible>
  );
}

function ForumNav({ categories, sheet }: { categories: Category[]; sheet?: boolean }) {
  const pathname = usePathname();
  const by = (g: Category['group']) => categories.filter((c) => c.group === g);
  return (
    <nav aria-label="Forum" className="flex flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <NavLink href="/forum" active={pathname === '/forum'} onNavigate={sheet}>
          <MessageSquare className="size-4" aria-hidden />
          All threads
        </NavLink>
        <NavLink href="/forum/bookmarks" active={pathname === '/forum/bookmarks'} onNavigate={sheet}>
          <Bookmark className="size-4" aria-hidden />
          Bookmarks
        </NavLink>
      </div>
      <Group label="Aletheia" items={by('aletheia')} collapsible={false} pathname={pathname} sheet={sheet} />
      <Group label="Projects" items={by('projects')} collapsible pathname={pathname} sheet={sheet} />
      <Group label="Lab" items={by('lab')} collapsible pathname={pathname} sheet={sheet} />
      <NavLink href="/forum/settings" active={pathname === '/forum/settings'} onNavigate={sheet}>
        <Settings className="size-4" aria-hidden />
        Profile and identity
      </NavLink>
    </nav>
  );
}

/** Sidebar on desktop; a Sheet behind a Menu button on small screens. */
export function ForumShell({ categories, children }: { categories: Category[]; children: React.ReactNode }) {
  return (
    <div className="container pb-16 pt-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 flex flex-col gap-5">
            <Button asChild>
              <Link href="/forum/new">
                <PenLine data-icon="inline-start" aria-hidden />
                New thread
              </Link>
            </Button>
            <ForumNav categories={categories} />
          </div>
        </aside>
        <div className="flex items-center justify-between gap-2 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Menu data-icon="inline-start" aria-hidden />
                Forum menu
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Forum</SheetTitle>
                <SheetDescription className="sr-only">Browse categories and your bookmarks</SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-5">
                <SheetClose asChild>
                  <Button asChild>
                    <Link href="/forum/new">
                      <PenLine data-icon="inline-start" aria-hidden />
                      New thread
                    </Link>
                  </Button>
                </SheetClose>
                <ForumNav categories={categories} sheet />
              </div>
            </SheetContent>
          </Sheet>
          <Button asChild size="sm">
            <Link href="/forum/new">
              <PenLine data-icon="inline-start" aria-hidden />
              New thread
            </Link>
          </Button>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
