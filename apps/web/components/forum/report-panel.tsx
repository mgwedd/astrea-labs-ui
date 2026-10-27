'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronUp, CircleDot } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
  toast,
  cn,
} from '@astrea/ui';
import { moderateAction, toggleVoteAction } from '@/app/(site)/forum/actions';
import { REPORT_STATUSES, statusLabel, type ReportKind, type ReportStatus } from '@/lib/forum/reports';
import { StatusBadge } from './report-badges';

export type StatusEventVM = { id: string; from: ReportStatus | null; to: ReportStatus; actorName: string; note: string | null; when: string; whenTitle: string };

export type ReportVM = {
  kind: ReportKind;
  status: ReportStatus;
  voteCount: number;
  voted: boolean;
  /** The viewer opened this report, so they cannot vote on it. */
  mine: boolean;
  duplicateOf: { id: string; title: string } | null;
  events: StatusEventVM[];
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** "Me too" on a bug, an upvote on a feature. Optimistic, rolled back on failure. */
export function VoteButton({ threadId, report }: { threadId: string; report: ReportVM }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState({ voted: report.voted, count: report.voteCount });
  const label = report.kind === 'bug' ? 'Me too' : 'Upvote';
  const closedDup = report.status === 'duplicate' && !state.voted;
  const disabled = pending || report.mine || closedDup;
  const title = report.mine ? 'You opened this, so it already counts you' : closedDup ? 'Vote on the original report' : undefined;
  return (
    <Button
      type="button"
      size="sm"
      variant={state.voted ? 'secondary' : 'outline'}
      aria-pressed={state.voted}
      disabled={disabled}
      title={title}
      onClick={() => {
        const prev = state;
        setState({ voted: !prev.voted, count: prev.count + (prev.voted ? -1 : 1) });
        start(async () => {
          const r = await toggleVoteAction(threadId);
          if (!r.ok) {
            setState(prev);
            toast.error(r.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      <ChevronUp data-icon="inline-start" aria-hidden />
      {label}
      <span className="tabular-nums">{state.count}</span>
      <span className="sr-only">
        {state.count === 1 ? 'vote' : 'votes'}
        {title && `. ${title}`}
      </span>
    </Button>
  );
}

/** Admin only: move the report to a new status, with an optional note for the timeline. */
export function StatusDialog({ threadId, report, open, onOpenChange }: { threadId: string; report: ReportVM; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [note, setNote] = useState('');
  const [dup, setDup] = useState(report.duplicateOf ? `/forum/t/${report.duplicateOf.id}` : '');
  const [error, setError] = useState<string | null>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const duplicateOfId = status === 'duplicate' ? dup.match(UUID)?.[0] : undefined;
    if (status === 'duplicate' && !duplicateOfId) return setError('Paste the link to the original report');
    start(async () => {
      const r = await moderateAction({ kind: 'status', threadId, change: { status, note: note.trim() || undefined, duplicateOfId } });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(`Marked ${statusLabel(report.kind, status).toLowerCase()}`);
      setNote('');
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>Members see the new status and your note on the thread.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="report-status">Status</FieldLabel>
              <Select value={status} onValueChange={(v) => setStatus(v as ReportStatus)}>
                <SelectTrigger id="report-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {REPORT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(report.kind, s)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {status === 'duplicate' && (
              <Field>
                <FieldLabel htmlFor="report-dup">Original report</FieldLabel>
                <Input id="report-dup" value={dup} onChange={(e) => setDup(e.target.value)} placeholder="/forum/t/…" autoComplete="off" />
                <FieldDescription>Paste its link. New votes on this report are turned off.</FieldDescription>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="report-note">Note (optional)</FieldLabel>
              <Textarea id="report-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
            </Field>
          </FieldGroup>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Status changes, oldest first, with the staff member and note. */
export function StatusTimeline({ report }: { report: ReportVM }) {
  if (report.events.length === 0 && !report.duplicateOf) return null;
  return (
    <section aria-label="Status history" className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <h2 className="text-sm font-semibold">Status</h2>
      {report.duplicateOf && (
        <p className="flex flex-wrap items-center gap-1 text-sm">
          Duplicate of
          <Link href={`/forum/t/${report.duplicateOf.id}`} className="inline-flex items-center gap-1 font-medium hover:underline">
            {report.duplicateOf.title}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </p>
      )}
      {report.events.length > 0 && (
        <ol className="flex flex-col gap-3">
          {report.events.map((e, i) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <CircleDot className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground', i === report.events.length - 1 && 'text-primary')} aria-hidden />
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge kind={report.kind} status={e.to} />
                  <span className="text-muted-foreground">
                    by <span className="break-words font-medium text-foreground">{e.actorName}</span>
                  </span>
                  <span className="text-muted-foreground" title={e.whenTitle}>
                    {e.when}
                  </span>
                </div>
                {e.note && <p className="whitespace-pre-line break-words text-muted-foreground">{e.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
