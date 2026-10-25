'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Progress, cn } from '@astrea/ui';
import { answersSchema, applicationInputSchema } from '@/lib/beta-access/answers';
import { REQUIRED_AT_APPLY } from '@/lib/beta-access/content';
import { InfoTip } from '../info-tip';
import { StepAbout } from './step-about';
import { StepAttestations } from './step-attestations';
import { StepHandling } from './step-handling';
import { StepReview } from './step-review';
import {
  clearDraft,
  emptyDraft,
  loadDraft,
  saveDraft,
  toAnswersInput,
  validateAnswers,
  type Draft,
  type Errors,
} from './draft';

const STEPS = ['About you', 'How Aletheia handles patient information', 'Attestations', 'Review and submit'];
const RAIL = ['About you', 'Patient info', 'Attestations', 'Review'];
const STEP_CONSENTS = [[], ['B0'], REQUIRED_AT_APPLY.filter((id) => id !== 'B0'), []] as const;

type Submit = { kind: 'idle' } | { kind: 'sending' } | { kind: 'error'; message: string } | { kind: 'sent'; email: string };

export function ApplyForm({ legalVersion }: { legalVersion: string }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(0);
  // Block id -> ISO time it was ticked. Unticking removes the entry.
  const [consents, setConsents] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  const [submit, setSubmit] = useState<Submit>({ kind: 'idle' });
  const [restored, setRestored] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useRef(false);
  const stepChanged = useRef(false);
  const consentsChanged = useRef(false);

  useEffect(() => {
    const saved = loadDraft();
    if (saved) {
      setDraft(saved.draft);
      setStep(saved.step);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored && submit.kind !== 'sent') saveDraft(draft, step);
  }, [draft, step, restored, submit.kind]);

  const consentErrors = useCallback(
    (s: number, c: Record<string, string>): Errors => {
      const out: Errors = {};
      for (const id of STEP_CONSENTS[s] ?? []) if (!(id in c)) out[id] = 'Tick this box to continue.';
      return out;
    },
    [],
  );

  const errorsFor = useCallback(
    (s: number, d: Draft, c: Record<string, string>) => (s === 0 ? validateAnswers(d) : consentErrors(s, c)),
    [consentErrors],
  );

  // After a failed "Continue", keep errors live so they clear as they're fixed.
  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (attempted[step]) setErrors(errorsFor(step, next, consents));
  };

  const setConsent = (id: string, ticked: boolean) => {
    setConsents((prev) => {
      const next = { ...prev };
      if (ticked) next[id] = new Date().toISOString();
      else delete next[id];
      return next;
    });
    consentsChanged.current = true;
  };

  useEffect(() => {
    if (!consentsChanged.current) return;
    consentsChanged.current = false;
    if (attempted[step]) setErrors(errorsFor(step, draft, consents));
  }, [consents, attempted, step, draft, errorsFor]);

  useEffect(() => {
    if (focusFirstError.current) {
      focusFirstError.current = false;
      const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [errors]);

  useEffect(() => {
    if (!stepChanged.current) return;
    stepChanged.current = false;
    headingRef.current?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  const goTo = (s: number) => {
    stepChanged.current = true;
    setErrors({});
    setStep(s);
  };

  const next = () => {
    const found = errorsFor(step, draft, consents);
    if (Object.keys(found).length > 0) {
      setAttempted({ ...attempted, [step]: true });
      focusFirstError.current = true;
      setErrors(found);
      return;
    }
    goTo(step + 1);
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < STEPS.length - 1) return next();

    const parsed = applicationInputSchema.safeParse({ legalVersion, answers: toAnswersInput(draft), consents });
    if (!parsed.success) {
      // Something earlier is no longer valid (it shouldn't happen): send them back to it.
      const firstBad = validateAnswers(draft);
      goTo(Object.keys(firstBad).length > 0 ? 0 : !('B0' in consents) ? 1 : 2);
      return;
    }

    setSubmit({ kind: 'sending' });
    try {
      const res = await fetch('/api/beta/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        clearDraft();
        setSubmit({ kind: 'sent', email: parsed.data.answers.email });
        window.scrollTo({ top: 0 });
        return;
      }
      setSubmit({
        kind: 'error',
        message:
          res.status === 400
            ? 'Some answers weren’t accepted, or the Terms and Privacy Policy were updated. Reload the page, check each step, and try again.'
            : res.status === 403
              ? 'Our bot check blocked this request. Reload the page and try again.'
              : res.status === 429
                ? 'Too many attempts. Please wait a few minutes and try again.'
                : 'We couldn’t send your application just now. Nothing was sent; please try again.',
      });
    } catch {
      setSubmit({ kind: 'error', message: 'Couldn’t reach the server. Check your connection and try again.' });
    }
  }

  if (submit.kind === 'sent') {
    return (
      <Card role="status">
        <CardHeader>
          <MailCheck className="mb-2 size-6 text-muted-foreground" aria-hidden />
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a link to <span className="font-medium text-foreground">{submit.email}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Open it to review and sign the document made from your answers. The link works once and{' '}
            <span className="font-medium text-foreground">expires in 7 days</span>.
          </p>
        </CardContent>
        <CardFooter className="gap-2">
          <Button variant="outline" asChild>
            <Link href="/aletheia/beta#resume">Resume signing</Link>
          </Button>
          <InfoTip label="a missing email">
            Nothing after a few minutes? Check your spam folder. If the email is lost or the link expired, Resume
            signing sends a new one.
          </InfoTip>
        </CardFooter>
      </Card>
    );
  }

  const isLast = step === STEPS.length - 1;
  const errorCount = Object.keys(errors).length;
  const answers = isLast ? answersSchema.safeParse(toAnswersInput(draft)).data : undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex scroll-mt-24 flex-col gap-6">
      <nav aria-label="Application steps" className="flex flex-col gap-3">
        <Progress
          value={((step + 1) / STEPS.length) * 100}
          aria-label={`Step ${step + 1} of ${STEPS.length}`}
          className="h-1"
        />
        <ol className="grid grid-cols-4 gap-2 text-xs">
          {RAIL.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={cn('truncate', i === step ? 'font-medium text-foreground' : 'text-muted-foreground')}
            >
              <span className="sr-only">Step {i + 1}: </span>
              {label}
            </li>
          ))}
        </ol>
      </nav>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-xl leading-snug">
            <h2 ref={headingRef} tabIndex={-1} className="outline-none">
              {STEPS[step]}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {step === 0 && <StepAbout draft={draft} errors={errors} update={update} />}
          {step === 1 && <StepHandling consents={consents} setConsent={setConsent} errors={errors} />}
          {step === 2 && <StepAttestations legalVersion={legalVersion} consents={consents} setConsent={setConsent} errors={errors} />}
          {step === 3 && answers && <StepReview answers={answers} consents={consents} goTo={goTo} />}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4 border-t p-4 sm:p-6">
          {errorCount > 0 && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errorCount === 1 ? 'One answer needs' : `${errorCount} answers need`} attention before you continue.
              {errors.form && ` ${errors.form}`}
            </p>
          )}
          {submit.kind === 'error' && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {submit.message}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => goTo(step - 1)}>
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={submit.kind === 'sending'}>
              {isLast ? (submit.kind === 'sending' ? 'Submitting…' : 'Submit and confirm email') : 'Continue'}
              {!isLast && <ArrowRight data-icon="inline-end" />}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}

