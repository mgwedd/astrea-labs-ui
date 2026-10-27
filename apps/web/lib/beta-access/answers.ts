// Aletheia beta access form: section A answers (schema, options, display).
// Client-safe: no node imports.
import { z } from "zod";
import { REQUIRED_AT_APPLY } from "./content";

export const LIMITS = { short: 200, long: 2000 };

type Option<V extends string = string> = { value: V; label: string };

export const US_STATES: Option[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([value, label]) => ({ value, label }));

export const CREDENTIAL_OPTIONS = [
  { value: "psychologist", label: "Psychologist" },
  { value: "psychiatrist", label: "Psychiatrist" },
  { value: "lcsw", label: "LCSW" },
  { value: "lpc", label: "LPC/LPCC" },
  { value: "lmft", label: "LMFT" },
  { value: "lmhc", label: "LMHC" },
  { value: "psychiatric-np", label: "Psychiatric NP" },
  { value: "other", label: "Other licensed" },
  { value: "pre-licensed", label: "Pre-licensed under supervision" },
] as const;

export const SETTING_OPTIONS = [
  { value: "solo", label: "Solo private practice" },
  { value: "group", label: "Group practice" },
  { value: "agency", label: "Agency / clinic" },
  { value: "hospital", label: "Hospital / health system" },
  { value: "other", label: "Other" },
] as const;

export const FORMAT_OPTIONS = [
  { value: "in-person", label: "In person" },
  { value: "video", label: "Telehealth (video)" },
  { value: "phone", label: "Telehealth (phone)" },
] as const;

export const CATEGORY_OPTIONS = [
  { value: "sud", label: "Substance use disorder treatment (federally assisted)" },
  { value: "minors", label: "Minors" },
  { value: "forensic", label: "Court-ordered or forensic work" },
  { value: "none", label: "None" },
] as const;

export const CHIP_OPTIONS = [
  { value: "apple-silicon", label: "Apple silicon" },
  { value: "intel", label: "Intel" },
] as const;

export const MACOS_OPTIONS = [
  { value: "27-plus", label: "macOS 27 or later" },
  { value: "26", label: "macOS 26" },
  { value: "15", label: "macOS 15" },
  { value: "14", label: "macOS 14" },
  { value: "13-or-older", label: "macOS 13 or older" },
] as const;

export type CredentialValue = (typeof CREDENTIAL_OPTIONS)[number]["value"];
export type SettingValue = (typeof SETTING_OPTIONS)[number]["value"];
export type FormatValue = (typeof FORMAT_OPTIONS)[number]["value"];
export type CategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"];
export type ChipValue = (typeof CHIP_OPTIONS)[number]["value"];
export type MacosValue = (typeof MACOS_OPTIONS)[number]["value"];

const values = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

const stateCodes = US_STATES.map((s) => s.value);

const reqText = (max: number, label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

// Optional text: blank becomes undefined.
const optText = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .max(max, `${label} must be ${max} characters or fewer.`)
      .optional(),
  );

const stateEnum = z.enum(stateCodes as [string, ...string[]], {
  error: "Choose a state.",
});

const mkEnum = <T extends readonly { value: string }[]>(opts: T, msg: string) =>
  z.enum(values(opts), { error: msg });

const baseAnswers = z.object({
  fullName: reqText(LIMITS.short, "Full legal name"),
  email: z
    .string({ error: "Email is required." })
    .trim()
    .toLowerCase()
    .max(254, "Email is too long.")
    .pipe(z.email("Enter a valid email address.")),
  credential: mkEnum(CREDENTIAL_OPTIONS, "Choose a credential."),
  credentialOther: optText(LIMITS.short, "Credential"),
  licenses: z
    .array(
      z.object({
        state: stateEnum,
        number: reqText(LIMITS.short, "License number"),
      }),
    )
    .min(1, "Add at least one license."),
  npi: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const s = v.replace(/\s+/g, "");
      return s === "" ? undefined : s;
    },
    z
      .string()
      .regex(/^\d{10}$/, "NPI must be exactly 10 digits.")
      .optional(),
  ),
  supervisor: z.preprocess(
    (v) => {
      if (v && typeof v === "object") {
        const o = v as { name?: unknown; license?: unknown };
        const blank = (x: unknown) => x === undefined || (typeof x === "string" && x.trim() === "");
        if (blank(o.name) && blank(o.license)) return undefined;
      }
      return v;
    },
    z
      .object({
        name: reqText(LIMITS.short, "Supervisor's name"),
        license: reqText(LIMITS.short, "Supervisor's license number"),
      })
      .optional(),
  ),
  practiceName: reqText(LIMITS.short, "Practice name"),
  setting: mkEnum(SETTING_OPTIONS, "Choose a practice setting."),
  settingOther: optText(LIMITS.short, "Practice setting"),
  clientStates: z.array(stateEnum).min(1, "Choose at least one state."),
  formats: z.array(mkEnum(FORMAT_OPTIONS, "Choose a session format.")).min(1, "Choose at least one session format."),
  categories: z
    .array(mkEnum(CATEGORY_OPTIONS, "Choose an option."))
    .min(1, "Choose at least one option, or None."),
  mac: z.object({
    chip: mkEnum(CHIP_OPTIONS, "Choose your Mac's chip."),
    macos: mkEnum(MACOS_OPTIONS, "Choose your macOS version."),
  }),
  heardFrom: optText(LIMITS.short, "This answer"),
  notes: optText(LIMITS.long, "Notes"),
});

export const answersSchema = baseAnswers.superRefine((a, ctx) => {
  if (a.credential === "pre-licensed" && !a.supervisor) {
    ctx.addIssue({
      code: "custom",
      path: ["supervisor"],
      message: "Supervisor's name and license number are required if you are pre-licensed.",
    });
  }
  if (a.credential === "other" && !a.credentialOther) {
    ctx.addIssue({
      code: "custom",
      path: ["credentialOther"],
      message: "Tell us your credential.",
    });
  }
  if (a.setting === "other" && !a.settingOther) {
    ctx.addIssue({
      code: "custom",
      path: ["settingOther"],
      message: "Tell us your practice setting.",
    });
  }
  if (a.categories.includes("none") && a.categories.length > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["categories"],
      message: "\"None\" can't be combined with other options.",
    });
  }
  if (new Set(a.clientStates).size !== a.clientStates.length) {
    ctx.addIssue({
      code: "custom",
      path: ["clientStates"],
      message: "Each state can be listed only once.",
    });
  }
  if (new Set(a.formats).size !== a.formats.length) {
    ctx.addIssue({ code: "custom", path: ["formats"], message: "Each format can be listed only once." });
  }
  if (new Set(a.categories).size !== a.categories.length) {
    ctx.addIssue({ code: "custom", path: ["categories"], message: "Each option can be listed only once." });
  }
});

export type Answers = z.infer<typeof answersSchema>;

const allowedConsentIds = new Set(REQUIRED_AT_APPLY);

export const applicationInputSchema = z.object({
  /** The Terms/Privacy version C1 named when it was shown. */
  legalVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  answers: answersSchema,
  consents: z
    .record(z.string(), z.iso.datetime({ error: "Consent time must be an ISO datetime." }))
    .superRefine((c, ctx) => {
      for (const id of REQUIRED_AT_APPLY) {
        if (!(id in c)) {
          ctx.addIssue({ code: "custom", path: [id], message: `Consent ${id} is required.` });
        }
      }
      for (const id of Object.keys(c)) {
        if (!allowedConsentIds.has(id)) {
          ctx.addIssue({ code: "custom", path: [id], message: `Unexpected consent ${id}.` });
        }
      }
    }),
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;

const labelOf = (opts: readonly { value: string; label: string }[], v: string) =>
  opts.find((o) => o.value === v)?.label ?? v;

export function describeAnswers(a: Answers): { id: string; label: string; value: string }[] {
  const credential =
    a.credential === "other" && a.credentialOther
      ? `${labelOf(CREDENTIAL_OPTIONS, a.credential)}: ${a.credentialOther}`
      : labelOf(CREDENTIAL_OPTIONS, a.credential);
  const setting =
    a.setting === "other" && a.settingOther
      ? `${labelOf(SETTING_OPTIONS, a.setting)}: ${a.settingOther}`
      : labelOf(SETTING_OPTIONS, a.setting);
  const stateLabel = (code: string) => labelOf(US_STATES, code);
  return [
    { id: "A1", label: "Full legal name", value: a.fullName },
    { id: "A2", label: "Professional email", value: a.email },
    { id: "A3", label: "Credential / role", value: credential },
    {
      id: "A4",
      label: "License number and issuing state(s)",
      value: a.licenses.map((l) => `${stateLabel(l.state)} ${l.number}`).join(", "),
    },
    { id: "A5", label: "NPI number", value: a.npi ?? "" },
    {
      id: "A6",
      label: "Supervisor's name and license number (if pre-licensed)",
      value: a.supervisor ? `${a.supervisor.name}, ${a.supervisor.license}` : "",
    },
    { id: "A7", label: "Practice name", value: a.practiceName },
    { id: "A8", label: "Practice setting", value: setting },
    {
      id: "A9",
      label: "States where you see clients, and where your clients are when you see them",
      value: a.clientStates.map(stateLabel).join(", "),
    },
    {
      id: "A10",
      label: "Session format",
      value: a.formats.map((f) => labelOf(FORMAT_OPTIONS, f)).join(", "),
    },
    {
      id: "A11",
      label: "Does your practice include any of these?",
      value: a.categories.map((c) => labelOf(CATEGORY_OPTIONS, c)).join(", "),
    },
    {
      id: "A12",
      label: "Mac: chip and macOS version",
      value: `${labelOf(CHIP_OPTIONS, a.mac.chip)}, ${labelOf(MACOS_OPTIONS, a.mac.macos)}`,
    },
    { id: "A13", label: "How did you hear about Aletheia?", value: a.heardFrom ?? "" },
    { id: "A14", label: "Anything else we should know?", value: a.notes ?? "" },
  ];
}
