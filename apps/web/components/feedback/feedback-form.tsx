'use client';

import { useState } from 'react';
import { Info, TriangleAlert } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  Field,
  FieldDescription,
  FieldError,
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
      <Alert role="status">
        <AlertTitle>Check your inbox to confirm.</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          If <span className="font-medium text-foreground">{state.email}</span> can receive mail, there is a confirmation link
          waiting. Open it and press the button to confirm. We review every report before anything is posted publicly. The link works once and expires in 24 hours.
        </AlertDescription>
      </Alert>
    );
  }

  const error = (name: string) =>
    errors[name] ? (
      <FieldError id={`${name}-error`}>{errors[name]}</FieldError>
    ) : null;
  const aria = (name: string) => ({ 'aria-invalid': errors[name] ? true : undefined, 'aria-describedby': errors[name] ? `${name}-error` : undefined });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-6">
        <Alert role="note">
          <TriangleAlert aria-hidden />
          <AlertTitle className="leading-snug">Don&apos;t include patient or client information or anything confidential.</AlertTitle>
          <AlertDescription>Issues are public.</AlertDescription>
        </Alert>

        <Field data-invalid={errors.project ? true : undefined}>
          <FieldLabel htmlFor="project">Project</FieldLabel>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger id="project" {...aria('project')}>
              <SelectValue placeholder="Choose a project" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {FEEDBACK_PROJECTS.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {error('project')}
        </Field>

        <Field>
          <FieldLabel id="type-label">Type</FieldLabel>
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
        </Field>

        <Field data-invalid={errors.title ? true : undefined}>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <Input id="title" maxLength={LIMITS.title} value={values.title ?? ''} onChange={(e) => set('title', e.target.value)} {...aria('title')} />
          {error('title')}
        </Field>

        {FIELDS[type].map((f) => (
          <Field key={f.name} data-invalid={errors[f.name] ? true : undefined}>
            <FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
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
            {f.hint && <FieldDescription>{f.hint}</FieldDescription>}
            {error(f.name)}
          </Field>
        ))}

        {type === 'bug' && project === 'aletheia' && (
          <Alert role="note">
            <Info aria-hidden />
            <AlertDescription>
              Please don&apos;t attach logs, recordings or screenshots. For Aletheia, attach nothing; paste the redacted Doctor
              report text if asked.
            </AlertDescription>
          </Alert>
        )}
        {showMediaNote && (
          <Alert role="note">
            <Info aria-hidden />
            <AlertDescription>
              Images and files aren&apos;t accepted, and links won&apos;t be followed. Describe what you saw in words. We&apos;ll
              look at this before anything is posted.
            </AlertDescription>
          </Alert>
        )}

        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="email">Your email</FieldLabel>
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
          <FieldDescription>Only used to confirm this submission and to reply to you. It is never posted publicly.</FieldDescription>
          {error('email')}
        </Field>

        <Field data-invalid={errors.ack ? true : undefined}>
          <Field orientation="horizontal" className="items-start">
            <Checkbox id="ack" checked={ack} onCheckedChange={(v) => setAck(v === true)} {...aria('ack')} />
            <FieldLabel htmlFor="ack" className="font-normal">
              Don&apos;t include any client or patient information.
            </FieldLabel>
          </Field>
          {error('ack')}
        </Field>

        {state.kind === 'error' && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={state.kind === 'sending'} className="self-start">
          {state.kind === 'sending' && <Spinner data-icon="inline-start" aria-hidden />}
          {state.kind === 'sending' ? 'Sending…' : 'Send and confirm by email'}
        </Button>
      </FieldGroup>
    </form>
  );
}
