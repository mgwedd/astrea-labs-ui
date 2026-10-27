import { Bug, Lightbulb } from 'lucide-react';
import { Badge } from '@astrea/ui';
import { KIND_SHORT, isActiveStatus, isReportKind, statusLabel, type ReportStatus, type ThreadKind } from '@/lib/forum/reports';

/** "Bug" or "Feature" with its icon. Nothing for discussions. */
export function KindBadge({ kind }: { kind: ThreadKind }) {
  if (!isReportKind(kind)) return null;
  const Icon = kind === 'bug' ? Bug : Lightbulb;
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="size-3" aria-hidden />
      {KIND_SHORT[kind]}
    </Badge>
  );
}

/** The report's status. Done reads as primary, other closed states as muted. */
export function StatusBadge({ kind, status }: { kind: ThreadKind; status: ReportStatus | null }) {
  if (!isReportKind(kind) || !status) return null;
  const variant = status === 'done' ? 'default' : isActiveStatus(status) ? 'secondary' : 'outline';
  return (
    <Badge variant={variant} className={variant === 'outline' ? 'text-muted-foreground' : undefined}>
      {statusLabel(kind, status)}
    </Badge>
  );
}
