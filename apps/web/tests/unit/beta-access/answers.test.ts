// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applicationInputSchema,
  answersSchema,
  describeAnswers,
  macRequirementWarnings,
  US_STATES,
} from "@/lib/beta-access/answers";
import { REQUIRED_AT_APPLY } from "@/lib/beta-access/content";

const valid = {
  fullName: "  Jane Doe ",
  email: "  Jane@Example.COM ",
  credential: "lcsw",
  licenses: [{ state: "WA", number: " 12345 " }],
  practiceName: "Doe Therapy",
  setting: "solo",
  clientStates: ["WA", "OR"],
  formats: ["in-person", "video"],
  categories: ["minors"],
  mac: { chip: "apple-silicon", macos: "26" },
};

const paths = (r: ReturnType<typeof answersSchema.safeParse>) =>
  r.success ? [] : r.error.issues.map((i) => i.path.join("."));

describe("answersSchema", () => {
  it("accepts and normalises valid input", () => {
    const r = answersSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fullName).toBe("Jane Doe");
      expect(r.data.email).toBe("jane@example.com");
      expect(r.data.licenses[0].number).toBe("12345");
    }
  });

  it("has 51 states", () => {
    expect(US_STATES).toHaveLength(51);
  });

  it("NPI: strips spaces, needs exactly 10 digits, optional", () => {
    const ok = answersSchema.safeParse({ ...valid, npi: "123 456 7890" });
    expect(ok.success && ok.data.npi).toBe("1234567890");
    expect(answersSchema.safeParse({ ...valid, npi: "" }).success).toBe(true);
    expect(paths(answersSchema.safeParse({ ...valid, npi: "12345" }))).toContain("npi");
    expect(paths(answersSchema.safeParse({ ...valid, npi: "12345678ab" }))).toContain("npi");
  });

  it("requires supervisor when pre-licensed", () => {
    const bad = answersSchema.safeParse({ ...valid, credential: "pre-licensed" });
    expect(paths(bad)).toContain("supervisor");
    const ok = answersSchema.safeParse({
      ...valid,
      credential: "pre-licensed",
      supervisor: { name: "Dr. Sup", license: "999" },
    });
    expect(ok.success).toBe(true);
  });

  it("requires credentialOther for other", () => {
    expect(paths(answersSchema.safeParse({ ...valid, credential: "other" }))).toContain("credentialOther");
    expect(
      answersSchema.safeParse({ ...valid, credential: "other", credentialOther: "School psychologist" }).success,
    ).toBe(true);
  });

  it("requires settingOther for other setting", () => {
    expect(paths(answersSchema.safeParse({ ...valid, setting: "other" }))).toContain("settingOther");
    expect(answersSchema.safeParse({ ...valid, setting: "other", settingOther: "School" }).success).toBe(true);
  });

  it("none is exclusive in categories", () => {
    expect(paths(answersSchema.safeParse({ ...valid, categories: ["none", "minors"] }))).toContain("categories");
    expect(answersSchema.safeParse({ ...valid, categories: ["none"] }).success).toBe(true);
  });

  it("rejects duplicate states and empty lists", () => {
    expect(paths(answersSchema.safeParse({ ...valid, clientStates: ["WA", "WA"] }))).toContain("clientStates");
    expect(answersSchema.safeParse({ ...valid, clientStates: [] }).success).toBe(false);
    expect(answersSchema.safeParse({ ...valid, licenses: [] }).success).toBe(false);
  });

  it("enforces length limits and bad emails", () => {
    expect(answersSchema.safeParse({ ...valid, fullName: "x".repeat(201) }).success).toBe(false);
    expect(answersSchema.safeParse({ ...valid, notes: "x".repeat(2001) }).success).toBe(false);
    expect(answersSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });
});

describe("applicationInputSchema", () => {
  const now = "2026-10-23T12:00:00.000Z";
  const consents = Object.fromEntries(REQUIRED_AT_APPLY.map((id) => [id, now]));

  it("accepts all required", () => {
    expect(applicationInputSchema.safeParse({ legalVersion: "2026-10-24", answers: valid, consents }).success).toBe(true);
    expect(applicationInputSchema.safeParse({ legalVersion: "2026-10-24", answers: valid, consents: { ...consents, C11: now } }).success).toBe(false);
  });

  it("rejects a missing required consent", () => {
    const { C5: _omit, ...rest } = consents;
    expect(applicationInputSchema.safeParse({ legalVersion: "2026-10-24", answers: valid, consents: rest }).success).toBe(false);
  });

  it("rejects C12 and unknown ids", () => {
    expect(applicationInputSchema.safeParse({ legalVersion: "2026-10-24", answers: valid, consents: { ...consents, C12: now } }).success).toBe(false);
    expect(applicationInputSchema.safeParse({ legalVersion: "2026-10-24", answers: valid, consents: { ...consents, X1: now } }).success).toBe(false);
  });

  it("rejects non-ISO times", () => {
    expect(applicationInputSchema.safeParse({ legalVersion: "2026-10-24", answers: valid, consents: { ...consents, C1: "yesterday" } }).success).toBe(false);
  });
});

describe("describeAnswers", () => {
  it("returns A1..A14 with labels and option labels", () => {
    const a = answersSchema.parse({ ...valid, npi: "1234567890" });
    const rows = describeAnswers(a);
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 14 }, (_, i) => `A${i + 1}`));
    expect(rows[3].label).toBe("License number and issuing state(s)");
    expect(rows[2].value).toBe("LCSW");
    expect(rows[8].value).toBe("Washington, Oregon");
    expect(rows[9].value).toBe("In person, Telehealth (video)");
    expect(rows[11].value).toBe("Apple silicon, macOS 26");
  });
});

describe("macRequirementWarnings", () => {
  it("is empty for a Mac that meets the requirements", () => {
    expect(macRequirementWarnings("apple-silicon", "14")).toEqual([]);
    expect(macRequirementWarnings("apple-silicon", "27-plus")).toEqual([]);
    expect(macRequirementWarnings("", "")).toEqual([]);
  });

  it("warns that macOS 13 or older can't install the app", () => {
    const [w] = macRequirementWarnings("apple-silicon", "13-or-older");
    expect(w).toMatch(/won't install/);
    expect(w).toMatch(/macOS 14/);
  });

  it("warns that Intel Macs are slower", () => {
    const [w] = macRequirementWarnings("intel", "15");
    expect(w).toMatch(/Intel/);
    expect(w).toMatch(/slower/);
  });

  it("gives both warnings for an Intel Mac on macOS 13", () => {
    expect(macRequirementWarnings("intel", "13-or-older")).toHaveLength(2);
  });
});
