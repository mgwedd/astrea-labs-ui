import { cn } from '@astrea/ui';

export function PageHeader({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 pb-10 pt-12 md:pt-16', className)}>
      {eyebrow && <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{eyebrow}</div>}
      <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      {children && <div className="max-w-2xl text-pretty text-lg text-muted-foreground">{children}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-4', className)}>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}
