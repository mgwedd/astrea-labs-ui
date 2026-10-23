'use client';

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from '@astrea/ui';
import { FEEDBACK_PROJECTS } from '@/lib/feedback/projects';
import { hasLinkOrImage } from '@/lib/feedback/flags';
import type { Prefill } from '@/lib/feedback/prefill';
import { FeedbackSchema, LIMITS, type FeedbackType } from '@/lib/feedback/validation';

type Values = Record<string, string>;
type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; email: string } | { kind: 'error'; message: string };

const FIELDS: Record<FeedbackType, { name: string; label: string; max: number; required: boolean; hint?: string; rows?: number; single?: boolean }[]> = {
  bug: [
    { name: 'happened', label: 'What happened', max: LIMITS.long, required: true },
    { name: 'steps', label: 'Steps to reproduce', max: LIMITS.long, required: true, hint: 'Numbered steps help.' },
    { name: 'expected', label: 'What you expected', max: LIMITS.medium, required: true, rows: 3 },
    { name: 'environment', label: 'Version / OS (optional)', max: LIMITS.short, required: false, single: true },
  ],
  feature: [
    { name: 'problem', label: 'The problem it solves', max: LIMITS.long, required: true },
    { name: 'solution', label: 'Your proposed solution', max: LIMITS.long, required: true },
    { name: 'alternatives', label: 'Alternatives you considered (optional)', max: LIMITS.medium, required: false, rows: 3 },
  ],
};

export function FeedbackForm({ prefill = {} }: { prefill?: Prefill }) {
  const [project, setProject] = useState(prefill.project ?? '');
  const [type, setType] = useState<FeedbackType>(prefill.type ?? 'feature');
  const [values, setValues] = useState<Values>(prefill.environment ? { environment: prefill.environment } : {});
  const [errors, setErrors] = useState<Values>({});
  const [ack, setAck] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));
  const showMediaNote = hasLinkOrImage(Object.values(values));
  const selected = FEEDBACK_PROJECTS.find((p) => p.slug === project);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload: Record<string, unknown> = { project, type, title: values.title ?? '', email: values.email ?? '', ack };
    for (const f of FIELDS[type]) payload[f.name] = values[f.name] ?? '';

    const parsed = FeedbackSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Values = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? 'form')] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setState({ kind: 'sending' });
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) return setState({ kind: 'sent', email: parsed.data.email });
      const body = (await res.json().catch(() => ({}))) as { error?: string; fields?: Values };
      if (body.fields) setErrors(body.fields);
      setState({ kind: 'error', message: body.error ?? 'Something went wrong. Please try again.' });
    } catch {
      setState({ kind: 'error', message: 'Could not reach the server. Check your connection and try again.' });
    }
  }

  if (state.kind === 'sent') {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg border p-6">
        <p className="font-medium">Check your inbox to confirm.</p>
        <p className="text-sm text-muted-foreground">
          If <span className="font-medium text-foreground">{state.email}</span> can receive mail, there is a confirmation link
          waiting. Open it and press the button to confirm. We review every report before anything is posted publicly. The link works once and expires in 24 hours.
        </p>
      </div>
    );
  }

  const error = (name: string) =>
    errors[name] ? (
      <p id={`${name}-error`} role="alert" className="text-sm text-destructive">
        {errors[name]}
      </p>
    ) : null;
  const aria = (name: string) => ({ 'aria-invalid': errors[name] ? true : undefined, 'aria-describedby': errors[name] ? `${name}-error` : undefined });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="note">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <p>
          <span className="font-medium">Don&apos;t include patient or client information or anything confidential.</span>{' '}
          Issues are public.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="project">Project</Label>
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger id="project" {...aria('project')}>
            <SelectValue placeholder="Choose a project" />
          </SelectTrigger>
          <SelectContent>
            {FEEDBACK_PROJECTS.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error('project')}
      </div>

      <div className="flex flex-col gap-2">
        <Label id="type-label">Type</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={type}
          onValueChange={(v) => v && setType(v as FeedbackType)}
          aria-labelledby="type-label"
          className="justify-start"
        >
          <ToggleGroupItem value="feature">Feature request</ToggleGroupItem>
          <ToggleGroupItem value="bug">Bug report</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" maxLength={LIMITS.title} value={values.title ?? ''} onChange={(e) => set('title', e.target.value)} {...aria('title')} />
        {error('title')}
      </div>

      {FIELDS[type].map((f) => (
        <div key={f.name} className="flex flex-col gap-2">
          <Label htmlFor={f.name}>{f.label}</Label>
          {f.single ? (
            <Input
              id={f.name}
              maxLength={f.max}
              value={values[f.name] ?? ''}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={selected?.hint ? `e.g. ${selected.hint}` : 'App or site version, OS'}
              {...aria(f.name)}
            />
          ) : (
            <Textarea
              id={f.name}
              rows={f.rows ?? 5}
              maxLength={f.max}
              value={values[f.name] ?? ''}
              onChange={(e) => set(f.name, e.target.value)}
              {...aria(f.name)}
            />
          )}
          {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
          {error(f.name)}
        </div>
      ))}

      {type === 'bug' && project === 'aletheia' && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Please don&apos;t attach logs, recordings or screenshots. For Aletheia, attach nothing; paste the redacted Doctor
          report text if asked.
        </p>
      )}
      {showMediaNote && (
        <p role="note" className="rounded-md border p-3 text-sm">
          Images and files aren&apos;t accepted, and links won&apos;t be followed. Describe what you saw in words. We&apos;ll look
          at this before anything is posted.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Your email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          maxLength={LIMITS.email}
          value={values.email ?? ''}
          onChange={(e) => set('email', e.target.value)}
          placeholder="you@example.com"
          {...aria('email')}
        />
        <p className="text-xs text-muted-foreground">
          Only used to confirm this submission and to reply to you. It is never posted publicly.
        </p>
        {error('email')}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <Checkbox id="ack" checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" {...aria('ack')} />
          <Label htmlFor="ack" className="font-normal leading-snug">
            Don&apos;t include any client or patient information.
          </Label>
        </div>
        {error('ack')}
      </div>

      {state.kind === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={state.kind === 'sending'} className="self-start">
        {state.kind === 'sending' ? 'Sending…' : 'Send and confirm by email'}
      </Button>
    </form>
  );
}
