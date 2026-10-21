'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ArrowUpRight, FileText, FolderGit2, Laptop, Moon, Search, Sun } from 'lucide-react';
import {
  Button,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Kbd,
} from '@astrea/ui';
import { site } from '@/lib/site';

export interface CommandEntry {
  href: string;
  title: string;
  hint?: string;
}

export function CommandMenu({
  projects,
  writing,
}: {
  projects: CommandEntry[];
  writing: CommandEntry[];
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isTyping(e))) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const go = (href: string) =>
    run(() => (href.startsWith('http') ? window.open(href, '_blank', 'noopener') : router.push(href)));

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-9 px-0 text-muted-foreground md:w-56 md:justify-between md:px-3"
        aria-label="Search the site"
      >
        <span className="hidden items-center gap-2 md:flex">
          <Search /> Search…
        </span>
        <Search className="md:hidden" />
        <Kbd className="hidden md:inline-flex">⌘K</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a project, post, or page…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Pages">
            {site.nav.map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <ArrowUpRight /> {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem key={p.href} value={`${p.title} ${p.hint ?? ''}`} onSelect={() => go(p.href)}>
                <FolderGit2 /> {p.title}
                {p.hint && <span className="ml-auto truncate text-xs text-muted-foreground">{p.hint}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
          {writing.length > 0 && (
            <CommandGroup heading="Writing">
              {writing.map((w) => (
                <CommandItem key={w.href} onSelect={() => go(w.href)}>
                  <FileText /> {w.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => run(() => setTheme('light'))}>
              <Sun /> Light
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme('dark'))}>
              <Moon /> Dark
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme('system'))}>
              <Laptop /> System
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}
