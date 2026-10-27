// Bug reports and feature requests: kinds, statuses and their labels. No server imports, so client
// components can use it.

export const THREAD_KINDS = ['discussion', 'bug', 'feature'] as const;
export type ThreadKind = (typeof THREAD_KINDS)[number];
export type ReportKind = Exclude<ThreadKind, 'discussion'>;

export const REPORT_STATUSES = ['open', 'acknowledged', 'planned', 'in_progress', 'done', 'declined', 'duplicate'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Statuses that still need work. The rest are closed. */
export const ACTIVE_STATUSES: readonly ReportStatus[] = ['open', 'acknowledged', 'planned', 'in_progress'];
export const isActiveStatus = (s: ReportStatus) => ACTIVE_STATUSES.includes(s);

export const isReportKind = (k: ThreadKind): k is ReportKind => k !== 'discussion';

export const KIND_LABEL: Record<ThreadKind, string> = { discussion: 'Discussion', bug: 'Bug report', feature: 'Feature request' };
export const KIND_SHORT: Record<ThreadKind, string> = { discussion: 'Discussion', bug: 'Bug', feature: 'Feature' };

const SHARED: Record<ReportStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
  declined: 'Declined',
  duplicate: 'Duplicate',
};

/** A status as members read it. Wording differs a little between bugs and features. */
export function statusLabel(kind: ReportKind, status: ReportStatus): string {
  if (status === 'acknowledged') return kind === 'bug' ? 'Confirmed' : 'Under consideration';
  if (status === 'done') return kind === 'bug' ? 'Fixed' : 'Shipped';
  if (status === 'declined' && kind === 'bug') return "Won't fix";
  return SHARED[status];
}
