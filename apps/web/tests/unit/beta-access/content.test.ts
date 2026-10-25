// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  attestations,
  B0,
  DISCLOSURES,
  documentBlocks,
  HANDLING,
  HANDLING_INTRO,
  OPTIONAL_AT_APPLY,
  REQUIRED_AT_APPLY,
  SIGNING_CONSENT_ID,
  blockById,
} from "@/lib/beta-access/content";

const V = "2026-10-24";
const DOCUMENT_BLOCKS = documentBlocks(V);
const ATTESTATIONS = attestations(V);

describe("beta-access content", () => {
  it("has every required id", () => {
    const ids = new Set(DOCUMENT_BLOCKS.map((b) => b.id));
    for (const id of [...REQUIRED_AT_APPLY, ...OPTIONAL_AT_APPLY, SIGNING_CONSENT_ID]) {
      expect(ids.has(id), id).toBe(true);
    }
    expect(HANDLING_INTRO.id).toBe("H0");
    expect(HANDLING.map((b) => b.id)).toEqual(["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"]);
    expect(DISCLOSURES.map((b) => b.id)).toEqual(["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"]);
    expect(ATTESTATIONS).toHaveLength(12);
    expect(B0.id).toBe("B0");
    expect(new Set(ids).size).toBe(DOCUMENT_BLOCKS.length);
  });

  it("C1 names the terms version it is given, and links to the site pages", () => {
    const c1 = blockById("C1", V).text;
    expect(c1).toContain(`**Terms of Service** (version ${V}, astrealabs.com/aletheia/terms)`);
    expect(c1).toContain(`**Privacy Policy** (version ${V}, astrealabs.com/aletheia/privacy)`);
    expect(blockById("C1", "2027-02-03").text).toContain("(version 2027-02-03,");
    expect(blockById("C1", "2027-02-03").text).not.toContain(V);
    expect(c1).not.toContain("<v>");
    expect(c1).not.toContain("`");
  });

  it("keeps bold markers", () => {
    expect(blockById("B4", V).text).toContain("**your normal Mac backups won't include it.**");
  });

  it("marks C11 optional only", () => {
    expect(blockById("C11", V).optional).toBe(true);
    expect(blockById("C11", V).text).toBe("Email me when new versions ship.");
    expect(ATTESTATIONS.filter((b) => b.optional).map((b) => b.id)).toEqual(["C11"]);
  });

  it("has no newlines or quote prefixes in block text", () => {
    for (const b of DOCUMENT_BLOCKS) {
      expect(b.text, b.id).not.toMatch(/\n/);
      expect(b.text, b.id).not.toContain("> ");
      expect(b.text, b.id).toBe(b.text.trim());
    }
  });

  it("derives the apply-time lists from the definition, unchanged", () => {
    expect(REQUIRED_AT_APPLY).toEqual(["B0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"]);
    expect(OPTIONAL_AT_APPLY).toEqual(["C11"]);
    expect(SIGNING_CONSENT_ID).toBe("C12");
  });

  it("blockById throws on unknown ids", () => {
    expect(() => blockById("Z9", V)).toThrow();
  });
});
