import { answersSchema } from '@/lib/beta-access/answers';

// What the form holds while the applicant types. Selects start empty, so the
// enum fields are plain strings here; answersSchema decides what's valid.
export type Draft = {
  fullName: string;
  email: string;
  credential: string;
  credentialOther: string;
  licenses: { key: number; state: string; number: string }[];
  npi: string;
  supervisorName: string;
  supervisorLicense: string;
  practiceName: string;
  setting: string;
  settingOther: string;
  clientStates: string[];
  formats: string[];
  categories: string[];
  chip: string;
  macos: string;
  heardFrom: string;
  notes: string;
};

export const emptyDraft: Draft = {
  fullName: '',
  email: '',
  credential: '',
  credentialOther: '',
  licenses: [{ key: 0, state: '', number: '' }],
  npi: '',
  supervisorName: '',
  supervisorLicense: '',
  practiceName: '',
  setting: '',
  settingOther: '',
  clientStates: [],
  formats: [],
  categories: [],
  chip: '',
  macos: '',
  heardFrom: '',
  notes: '',
};

/** The raw answers object, before answersSchema parses it. */
export function toAnswersInput(d: Draft) {
  return {
    fullName: d.fullName,
    email: d.email,
    credential: d.credential,
    credentialOther: d.credential === 'other' ? d.credentialOther : undefined,
    licenses: d.licenses.map(({ state, number }) => ({ state, number })),
    npi: d.npi,
    supervisor: d.credential === 'pre-licensed' ? { name: d.supervisorName, license: d.supervisorLicense } : undefined,
    practiceName: d.practiceName,
    setting: d.setting,
    settingOther: d.setting === 'other' ? d.settingOther : undefined,
    clientStates: d.clientStates,
    formats: d.formats,
    categories: d.categories,
    mac: { chip: d.chip, macos: d.macos },
    heardFrom: d.heardFrom,
    notes: d.notes,
  };
}

export type Errors = Record<string, string>;

/** Errors keyed by dotted path ('licenses.0.number', 'mac.chip'). */
export function validateAnswers(d: Draft): Errors {
  const errors: Errors = {};
  const result = answersSchema.safeParse(toAnswersInput(d));
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'form';
      errors[key] ??= issue.message;
    }
  }
  // The schema's cross-field checks only run once the base fields parse, so
  // repeat the conditional ones here to show every error on the first try.
  if (d.credential === 'pre-licensed') {
    if (!d.supervisorName.trim()) errors['supervisor.name'] ??= "Supervisor's name is required.";
    if (!d.supervisorLicense.trim()) errors['supervisor.license'] ??= "Supervisor's license number is required.";
    delete errors.supervisor;
  }
  if (d.credential === 'other' && !d.credentialOther.trim()) errors.credentialOther ??= 'Tell us your credential.';
  if (d.setting === 'other' && !d.settingOther.trim()) errors.settingOther ??= 'Tell us your practice setting.';
  return errors;
}

/** DOM id for the control that owns an error path. */
export function fieldId(path: string) {
  return `f-${path.replace(/\./g, '-')}`;
}

const STORAGE_KEY = 'aletheia-beta-apply-v1';

// The answers, the step and the consent tick times are kept, for this tab only,
// so a reload doesn't undo the attestations. Ticks only carry over while the
// document version they were given against is still current.
export type Saved = { draft: Draft; step: number; consents: Record<string, string> };

export function loadDraft(legalVersion: string): Saved | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { draft?: Partial<Draft>; step?: number; consents?: unknown; legalVersion?: string };
    if (!parsed.draft) return null;
    const draft = { ...emptyDraft, ...parsed.draft };
    if (!Array.isArray(draft.licenses) || draft.licenses.length === 0) draft.licenses = emptyDraft.licenses;
    const consents: Record<string, string> = {};
    if (parsed.legalVersion === legalVersion && parsed.consents && typeof parsed.consents === 'object') {
      for (const [id, at] of Object.entries(parsed.consents)) if (typeof at === 'string') consents[id] = at;
    }
    return { draft, step: Math.min(Math.max(Number(parsed.step) || 0, 0), 3), consents };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft, step: number, consents: Record<string, string>, legalVersion: string) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ draft, step, consents, legalVersion }));
  } catch {
    // Storage blocked or full: the form still works, it just won't survive a refresh.
  }
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
