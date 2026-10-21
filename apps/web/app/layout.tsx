import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { projects } from '@astrea/research-registry';
import { Toaster, TooltipProvider } from '@astrea/ui';
import '@astrea/ui/globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { site } from '@/lib/site';
import { getPosts } from '@/lib/writing';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.legalName, template: `%s · ${site.name}` },
  description: site.description,
  authors: site.team.map((m) => ({ name: m.name, url: `https://github.com/${m.github}` })),
  openGraph: {
    title: site.legalName,
    description: site.description,
    url: site.url,
    siteName: site.name,
    locale: 'en_US',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  alternates: { types: { 'application/rss+xml': '/feed.xml' } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const projectEntries = projects.map((p) => ({ href: `/projects/${p.slug}`, title: p.name, hint: p.tagline }));
  const writingEntries = getPosts().map((p) => ({ href: `/writing/${p.slug}`, title: p.title }));

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} scroll-smooth`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>
            <div className="relative flex min-h-screen flex-col">
              <SiteHeader projects={projectEntries} writing={writingEntries} />
              <main id="content" className="flex-1">{children}</main>
              <SiteFooter />
            </div>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
