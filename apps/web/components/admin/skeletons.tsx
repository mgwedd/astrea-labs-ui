import { Card, CardContent, CardHeader, Skeleton } from '@astrea/ui';

// Route-level loading states for /admin. Shapes roughly follow each page's layout to limit shift when data arrives.

function Loading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function Title() {
  return <Skeleton className="h-8 w-48" />;
}

function Rows({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="hidden h-5 w-24 sm:block" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

function BlockCard({ lines = 4 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function OverviewSkeleton() {
  return (
    <Loading label="Loading overview">
      <Title />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Rows count={5} />
          </CardContent>
        </Card>
        <BlockCard lines={3} />
      </div>
    </Loading>
  );
}

export function TableSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label}>
      <Title />
      <Skeleton className="h-9 w-full max-w-sm" />
      <Rows count={8} />
    </Loading>
  );
}

export function MasterDetailSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label}>
      <Title />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <BlockCard lines={4} />
          <BlockCard lines={6} />
        </div>
      </div>
    </Loading>
  );
}

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="hidden flex-col gap-3 lg:flex lg:w-96 lg:shrink-0">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Title />
          <BlockCard lines={5} />
          <div className="grid gap-6 xl:grid-cols-2">
            <BlockCard lines={4} />
            <BlockCard lines={4} />
          </div>
        </div>
      </div>
    </Loading>
  );
}

export function CardsSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label}>
      <Title />
      <BlockCard lines={5} />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Rows count={4} />
        </CardContent>
      </Card>
    </Loading>
  );
}
