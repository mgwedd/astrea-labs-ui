'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import {
  Button,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from '@astrea/ui';
import { site } from '@/lib/site';
import { GitHubMark, Wordmark } from './logo';
import { ThemeToggle } from './theme-toggle';
import { CommandMenu, type CommandEntry } from './command-menu';

export function SiteHeader({ projects, writing }: { projects: CommandEntry[]; writing: CommandEntry[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
    <a
      href="#content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
    >
      Skip to content
    </a>
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle asChild>
                <Link href="/">
                  <Wordmark />
                </Link>
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1">
              {site.nav.map((item) => (
                <SheetClose key={item.href} asChild>
                  <Button variant={isActive(item.href) ? 'secondary' : 'ghost'} className="justify-start" asChild>
                    <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
                      {item.label}
                    </Link>
                  </Button>
                </SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="mr-2" aria-label="Astrea Labs home">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 transition-colors hover:text-foreground',
                isActive(item.href) ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <CommandMenu projects={projects} writing={writing} />
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild>
                <a href={site.github} target="_blank" rel="noreferrer" aria-label="GitHub">
                  <GitHubMark />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>GitHub</TooltipContent>
          </Tooltip>
          <ThemeToggle />
        </div>
      </div>
    </header>
    </>
  );
}
