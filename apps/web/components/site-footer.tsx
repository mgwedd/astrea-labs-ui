import Link from 'next/link';
import { Separator } from '@astrea/ui';
import { site } from '@/lib/site';
import { LogoMark } from './logo';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="container flex flex-col gap-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <LogoMark className="size-4 text-foreground" />
          <span>
            © {new Date().getFullYear()} {site.legalName}
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {site.nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
          <Separator orientation="vertical" className="h-4" />
          <a href={site.github} target="_blank" rel="noreferrer" className="hover:text-foreground">
            GitHub
          </a>
          <a href="/feed.xml" className="hover:text-foreground">
            RSS
          </a>
        </nav>
      </div>
    </footer>
  );
}
