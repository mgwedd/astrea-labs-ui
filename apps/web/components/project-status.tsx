import type { ProjectStatus } from '@astrea/research-registry';
import { Badge } from '@astrea/ui';

const STATUS: Record<ProjectStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  beta: { label: 'Beta', variant: 'default' },
  active: { label: 'Active', variant: 'secondary' },
  shipped: { label: 'Shipped', variant: 'secondary' },
  research: { label: 'Research', variant: 'outline' },
  archived: { label: 'Archived', variant: 'outline' },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export const statusLabel = (status: ProjectStatus) => STATUS[status].label;
