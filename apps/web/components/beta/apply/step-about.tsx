'use client';

import { Plus, ShieldAlert, Trash2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
  cn,
} from '@astrea/ui';
import {
  CATEGORY_OPTIONS,
  CHIP_OPTIONS,
  CREDENTIAL_OPTIONS,
  FORMAT_OPTIONS,
  LIMITS,
  MACOS_OPTIONS,
  SETTING_OPTIONS,
  US_STATES,
} from '@/lib/beta-access/answers';
import { NO_CLIENT_INFO } from '@/lib/beta-access/content';
import { Field, FieldSet, controlProps, invalidClass } from '../field';
import { InfoTip } from '../info-tip';
import { StateMultiSelect } from './state-multi-select';
import { fieldId, type Draft, type Errors } from './draft';

type Props = {
  draft: Draft;
  errors: Errors;
  update: (patch: Partial<Draft>) => void;
};

function NoClientInfo({ id }: { id?: string }) {
  return (
    <p id={id} className="flex items-start gap-2 text-sm text-foreground">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      {NO_CLIENT_INFO}
    </p>
  );
}

function OptionSelect({
  path,
  value,
  onValueChange,
  options,
  placeholder,
  errors,
  describedBy,
}: {
  path: string;
  value: string;
  onValueChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder: string;
  errors: Errors;
  describedBy?: boolean;
}) {
  const id = fieldId(path);
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger {...controlProps(id, { error: errors[path], description: describedBy })} className={invalidClass}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function CheckboxList({
  path,
  options,
  value,
  onChange,
  errors,
}: {
  path: string;
  options: readonly { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  errors: Errors;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((o, i) => {
        const id = `${fieldId(path)}-${o.value}`;
        return (
          <div key={o.value} className="flex items-start gap-3">
            <Checkbox
              id={id}
              checked={value.includes(o.value)}
              onCheckedChange={(v) => onChange(v === true ? [...value, o.value] : value.filter((x) => x !== o.value))}
              aria-invalid={i === 0 && errors[path] ? true : undefined}
              className="mt-0.5"
            />
            <Label htmlFor={id} className="cursor-pointer font-normal leading-snug">
              {o.label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children, info }: { children: string; info?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{children}</h3>
      {info && <InfoTip label={children}>{info}</InfoTip>}
    </div>
  );
}

export function StepAbout({ draft, errors, update }: Props) {
  const text = (path: keyof Draft, opts?: { description?: boolean }) => ({
    ...controlProps(fieldId(path), { error: errors[path], description: opts?.description }),
    value: draft[path] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update({ [path]: e.target.value }),
    className: invalidClass,
  });

  const setLicense = (index: number, patch: Partial<{ state: string; number: string }>) =>
    update({ licenses: draft.licenses.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
  const addLicense = () =>
    update({
      licenses: [...draft.licenses, { key: Math.max(...draft.licenses.map((l) => l.key)) + 1, state: '', number: '' }],
    });
  const removeLicense = (index: number) => update({ licenses: draft.licenses.filter((_, i) => i !== index) });

  // A11: "None" can't sit alongside the others. Picking it clears them; picking another clears it.
  const setCategories = (next: string[]) => {
    const added = next.find((v) => !draft.categories.includes(v));
    if (added === 'none') return update({ categories: ['none'] });
    update({ categories: added ? next.filter((v) => v !== 'none') : next });
  };

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground">
        We use these answers to verify your license and review your application. We never ask about your clients.
      </p>

      <div className="flex flex-col gap-6">
        <SectionTitle>You</SectionTitle>
        <Field id={fieldId('fullName')} label="Full legal name" description="As it appears on your license." error={errors.fullName}>
          <Input {...text('fullName', { description: true })} autoComplete="name" maxLength={LIMITS.short} />
        </Field>
        <Field
          id={fieldId('email')}
          label="Professional email"
          description="Your key is tied to this address. We’ll send a link to confirm it."
          error={errors.email}
        >
          <Input {...text('email', { description: true })} type="email" autoComplete="email" inputMode="email" maxLength={254} />
        </Field>
        <Field id={fieldId('credential')} label="Credential or role" error={errors.credential}>
          <OptionSelect
            path="credential"
            value={draft.credential}
            onValueChange={(v) => update({ credential: v })}
            options={CREDENTIAL_OPTIONS}
            placeholder="Choose one"
            errors={errors}
          />
        </Field>
        {draft.credential === 'other' && (
          <Field id={fieldId('credentialOther')} label="Your license type" error={errors.credentialOther}>
            <Input {...text('credentialOther')} maxLength={LIMITS.short} />
          </Field>
        )}

        <FieldSet
          id={fieldId('licenses')}
          legend="License number and issuing state"
          description="Add each license you hold. We check them with the state board."
          error={errors.licenses}
        >
          <ul className="flex flex-col gap-3">
            {draft.licenses.map((license, i) => {
              const statePath = `licenses.${i}.state`;
              const numberPath = `licenses.${i}.number`;
              const n = draft.licenses.length > 1 ? ` ${i + 1}` : '';
              return (
                <li key={license.key} className="flex flex-col gap-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={fieldId(statePath)} className="sr-only">
                        License{n} state
                      </Label>
                      <OptionSelect
                        path={statePath}
                        value={license.state}
                        onValueChange={(v) => setLicense(i, { state: v })}
                        options={US_STATES}
                        placeholder="State"
                        errors={errors}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={fieldId(numberPath)} className="sr-only">
                        License{n} number
                      </Label>
                      <Input
                        {...controlProps(fieldId(numberPath), { error: errors[numberPath] })}
                        value={license.number}
                        onChange={(e) => setLicense(i, { number: e.target.value })}
                        placeholder="License number"
                        maxLength={LIMITS.short}
                        className={invalidClass}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLicense(i)}
                      disabled={draft.licenses.length === 1}
                      aria-label={`Remove license${n}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {(errors[statePath] || errors[numberPath]) && (
                    <p className="text-sm font-medium text-destructive">
                      <span id={`${fieldId(statePath)}-error`}>{errors[statePath]}</span>
                      {errors[statePath] && errors[numberPath] && ' '}
                      <span id={`${fieldId(numberPath)}-error`}>{errors[numberPath]}</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={addLicense} className="self-start">
            <Plus data-icon="inline-start" />
            Add another license
          </Button>
        </FieldSet>

        <Field
          id={fieldId('npi')}
          label="NPI number"
          optional
          description="10 digits. Strongly encouraged: a public NPPES lookup is our fastest identity check."
          error={errors.npi}
        >
          <Input {...text('npi', { description: true })} inputMode="numeric" autoComplete="off" maxLength={14} />
        </Field>

        {draft.credential === 'pre-licensed' && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={fieldId('supervisor.name')}
                label="Supervisor’s name"
                description="Pre-licensed clinicians need a licensed supervisor who is accountable for their work."
                error={errors['supervisor.name']}
              >
                <Input
                  {...controlProps(fieldId('supervisor.name'), { error: errors['supervisor.name'], description: true })}
                  value={draft.supervisorName}
                  onChange={(e) => update({ supervisorName: e.target.value })}
                  maxLength={LIMITS.short}
                  className={invalidClass}
                />
              </Field>
              <Field
                id={fieldId('supervisor.license')}
                label="Supervisor’s license number"
                error={errors['supervisor.license']}
              >
                <Input
                  {...controlProps(fieldId('supervisor.license'), { error: errors['supervisor.license'] })}
                  value={draft.supervisorLicense}
                  onChange={(e) => update({ supervisorLicense: e.target.value })}
                  maxLength={LIMITS.short}
                  className={invalidClass}
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-6">
        <SectionTitle>Your practice</SectionTitle>
        <Field id={fieldId('practiceName')} label="Practice name" error={errors.practiceName}>
          <Input {...text('practiceName')} autoComplete="organization" maxLength={LIMITS.short} />
        </Field>
        <Field id={fieldId('setting')} label="Practice setting" error={errors.setting}>
          <OptionSelect
            path="setting"
            value={draft.setting}
            onValueChange={(v) => update({ setting: v })}
            options={SETTING_OPTIONS}
            placeholder="Choose one"
            errors={errors}
          />
        </Field>
        {draft.setting === 'other' && (
          <Field id={fieldId('settingOther')} label="Describe your setting" error={errors.settingOther}>
            <Input {...text('settingOther')} maxLength={LIMITS.short} />
          </Field>
        )}
        <Field
          id={fieldId('clientStates')}
          label="States where you see clients, and where your clients are when you see them"
          description="Include every state a client might be in during a session, telehealth too. Recording-consent law follows where each person is."
          error={errors.clientStates}
        >
          <StateMultiSelect
            id={fieldId('clientStates')}
            value={draft.clientStates}
            onChange={(clientStates) => update({ clientStates })}
            invalid={!!errors.clientStates}
            describedBy={
              [`${fieldId('clientStates')}-description`, errors.clientStates && `${fieldId('clientStates')}-error`]
                .filter(Boolean)
                .join(' ')
            }
          />
        </Field>
        <FieldSet id={fieldId('formats')} legend="Session format" error={errors.formats}>
          <CheckboxList
            path="formats"
            options={FORMAT_OPTIONS}
            value={draft.formats}
            onChange={(formats) => update({ formats })}
            errors={errors}
          />
        </FieldSet>
        <FieldSet
          id={fieldId('categories')}
          legend="Does your practice include any of these?"
          description="These flag your application for a closer look. They aren’t automatic declines."
          error={errors.categories}
        >
          <CheckboxList
            path="categories"
            options={CATEGORY_OPTIONS}
            value={draft.categories}
            onChange={setCategories}
            errors={errors}
          />
        </FieldSet>
      </div>

      <Separator />

      <div className="flex flex-col gap-6">
        <SectionTitle info="Aletheia needs macOS 14 or later. Apple silicon with 16 GB is recommended; Intel Macs work with smaller, slower models.">Your Mac</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={fieldId('mac.chip')} label="Chip" error={errors['mac.chip']}>
            <OptionSelect
              path="mac.chip"
              value={draft.chip}
              onValueChange={(v) => update({ chip: v })}
              options={CHIP_OPTIONS}
              placeholder="Choose one"
              errors={errors}
            />
          </Field>
          <Field id={fieldId('mac.macos')} label="macOS version" error={errors['mac.macos']}>
            <OptionSelect
              path="mac.macos"
              value={draft.macos}
              onValueChange={(v) => update({ macos: v })}
              options={MACOS_OPTIONS}
              placeholder="Choose one"
              errors={errors}
            />
          </Field>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-6">
        <SectionTitle>Anything else</SectionTitle>
        <Field
          id={fieldId('heardFrom')}
          label="How did you hear about Aletheia?"
          optional
          description={NO_CLIENT_INFO}
          error={errors.heardFrom}
        >
          <Input {...text('heardFrom', { description: true })} maxLength={LIMITS.short} />
        </Field>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('notes')} className="leading-snug">
            Anything else we should know?
            <span className="font-normal text-muted-foreground"> (optional)</span>
          </Label>
          <NoClientInfo id={`${fieldId('notes')}-description`} />
          <Textarea {...text('notes', { description: true })} rows={4} maxLength={LIMITS.long} />
          <div className="flex justify-between gap-4 text-xs text-muted-foreground">
            <span id={`${fieldId('notes')}-error`} className={cn('text-sm font-medium text-destructive', !errors.notes && 'sr-only')}>
              {errors.notes}
            </span>
            <span aria-hidden>
              {draft.notes.length}/{LIMITS.long}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
