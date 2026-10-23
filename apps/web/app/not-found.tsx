import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button, Empty } from '@astrea/ui';
import { SiteShell } from '@/components/site-shell';

export default function NotFound() {
  return (
    <SiteShell>
      <div className="container py-24">
        <h1 className="sr-only">Page not found</h1>
        <Empty
          icon={Compass}
          title="Page not found"
          description="That page doesn’t exist, or it moved."
          action={
            <Button asChild>
              <Link href="/">Back home</Link>
            </Button>
          }
        />
      </div>
    </SiteShell>
  );
}
