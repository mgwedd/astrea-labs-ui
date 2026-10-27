// Renders a signed-level agreement as a PDF and stamps it at signing. Server-only.
// Layout wording comes from the definition's `document` spec.
//
// Determinism: the same input gives byte-identical output, so the unsigned
// hash is reproducible and "resume signing" can rebuild the same draft.
// - Info dict dates come from the input (createdAt / signedAt), never the clock;
//   producer and creator are fixed strings (pdf-lib's own metadata is disabled).
// - Fonts are embedded under fixed names, so pdf-lib's random-suffix naming
//   isn't used. (Its PRNG is seeded per document anyway, for resource keys.)
// - pdf-lib writes no trailer /ID unless the loaded file had one; ours never do.
// - Object order is creation order, which depends only on the input.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as fontkitNs from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ConsentRecord, SignatureBlock } from '@/lib/licensing/db/schema';
import { allBlocks, type AgreementDefinition, type Block, type SignedDocumentSpec } from '../define';
import { sha256Hex } from '../evidence';

export type AuditEvent = {
  type: 'document_created' | 'email_confirmed' | 'document_viewed' | 'consent_esign' | 'signed';
  at: string;
};
export type AuditTrail = {
  docType: string;
  docVersion: string;
  documentId: string;
  applicationId: string;
  signerName: string;
  signerEmail: string;
  unsignedSha256: string;
  events: AuditEvent[];
  signerIp: string | null;
  signerUa: string | null;
};

// The ESM build only has a default export; the typings only have named ones.
const fontkit = ((fontkitNs as unknown as { default?: typeof fontkitNs }).default ?? fontkitNs) as typeof fontkitNs;

const PRODUCER = 'Astrea Labs LLC signing (pdf-lib 1.17)';
const CREATOR = 'Astrea Labs LLC signing';

/** One row of the signer's details, e.g. an application answer. */
export type Detail = { id: string; label: string; value: string };

function specOf(def: AgreementDefinition): { spec: SignedDocumentSpec; consent: Block } {
  if (def.level !== 'signed' || !def.document || !def.signingConsent) throw new Error(`${def.id} is not a signed agreement`);
  return { spec: def.document, consent: def.signingConsent };
}

// US Letter, 0.75in margins.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const TOP = PAGE_H - MARGIN;
const BOTTOM = MARGIN + 18; // room for the footer
const CONTENT_W = PAGE_W - 2 * MARGIN;
const ID_COL = 30; // block id column
const BOX = 9; // checkbox size
const BOX_GAP = 15; // checkbox column, after the id column

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.38, 0.38, 0.38);
const RULE = rgb(0.72, 0.72, 0.72);

// ---------------------------------------------------------------------------
// Fonts

let fontCache: { regular: Uint8Array; bold: Uint8Array } | undefined;

/**
 * Finds node_modules/dejavu-fonts-ttf/ttf. process.cwd() is apps/web under
 * `next dev`, vitest and on Vercel (the function runs from the app's directory
 * inside the traced bundle); next.config.ts traces the TTFs into the routes that render.
 * The pnpm store paths are a fallback in case the symlink isn't preserved.
 */
function fontDir(): string {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'node_modules/dejavu-fonts-ttf/ttf'),
    path.join(cwd, 'apps/web/node_modules/dejavu-fonts-ttf/ttf'),
  ];
  for (const store of [path.join(cwd, 'node_modules/.pnpm'), path.join(cwd, '../../node_modules/.pnpm')]) {
    if (!existsSync(store)) continue;
    for (const entry of readdirSync(store)) {
      if (entry.startsWith('dejavu-fonts-ttf@')) {
        candidates.push(path.join(store, entry, 'node_modules/dejavu-fonts-ttf/ttf'));
      }
    }
  }
  const found = candidates.find((d) => existsSync(path.join(d, 'DejaVuSans.ttf')));
  if (!found) throw new Error('DejaVu fonts not found (dejavu-fonts-ttf/ttf)');
  return found;
}

function fontBytes() {
  if (!fontCache) {
    const dir = fontDir();
    fontCache = {
      regular: new Uint8Array(readFileSync(path.join(dir, 'DejaVuSans.ttf'))),
      bold: new Uint8Array(readFileSync(path.join(dir, 'DejaVuSans-Bold.ttf'))),
    };
  }
  return fontCache;
}

type Fonts = { regular: PDFFont; bold: PDFFont };

async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const { regular, bold } = fontBytes();
  return {
    // Fixed subset tags (PDF 9.6.4 style) instead of pdf-lib's random suffix.
    regular: await doc.embedFont(regular, { subset: true, customName: 'ASTRLA+DejaVuSans' }),
    bold: await doc.embedFont(bold, { subset: true, customName: 'ASTRLB+DejaVuSans-Bold' }),
  };
}

// ---------------------------------------------------------------------------
// Text layout

type Run = { text: string; bold: boolean };

/** Drops control characters (except newline) that have no place in a PDF text run. */
function clean(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u2028\u2029]/g, '');
}

/** `**bold**` markers in block text. Not applied to applicant input. */
function markup(text: string): Run[] {
  return text.split('**').map((t, i) => ({ text: t, bold: i % 2 === 1 }));
}

const plain = (text: string): Run[] => [{ text, bold: false }];
const strong = (text: string): Run[] => [{ text, bold: true }];

function utcIso(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? at : d.toISOString();
}

class Writer {
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = 0;

  constructor(
    private doc: PDFDocument,
    private fonts: Fonts,
  ) {}

  font(bold: boolean) {
    return bold ? this.fonts.bold : this.fonts.regular;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.y = TOP;
  }

  /** Starts a new page unless `h` points of space remain. */
  ensure(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }

  gap(h: number) {
    this.y -= h;
  }

  /** Word-wraps runs into lines of at most `width` points. Long words break by character. */
  wrap(runs: Run[], size: number, width: number): Run[][] {
    const lines: Run[][] = [];
    let line: Run[] = [];
    let lineW = 0;
    let space: Run | null = null;
    const w = (t: string, bold: boolean) => this.font(bold).widthOfTextAtSize(t, size);
    const push = (t: string, bold: boolean) => {
      const last = line[line.length - 1];
      if (last && last.bold === bold) last.text += t;
      else line.push({ text: t, bold });
      lineW += w(t, bold);
    };
    const breakLine = () => {
      lines.push(line);
      line = [];
      lineW = 0;
      space = null;
    };
    for (const run of runs) {
      for (const tok of clean(run.text).match(/\n|[^\S\n]+|\S+/g) ?? []) {
        if (tok === '\n') {
          breakLine();
        } else if (/^\s+$/.test(tok)) {
          if (line.length) space = { text: ' ', bold: run.bold };
        } else {
          const spaceW: number = space ? w(' ', space.bold) : 0;
          const tokW = w(tok, run.bold);
          if (lineW + spaceW + tokW <= width) {
            if (space) push(' ', space.bold);
            push(tok, run.bold);
          } else if (tokW <= width) {
            breakLine();
            push(tok, run.bold);
          } else {
            if (line.length) breakLine();
            for (const ch of Array.from(tok)) {
              if (lineW + w(ch, run.bold) > width && line.length) breakLine();
              push(ch, run.bold);
            }
          }
          space = null;
        }
      }
    }
    if (line.length || lines.length === 0) lines.push(line);
    return lines;
  }

  /** Draws wrapped text at the cursor, breaking pages between lines. Returns the first baseline drawn. */
  text(
    runs: Run[],
    opts: { size?: number; x?: number; width?: number; color?: ReturnType<typeof rgb>; leading?: number } = {},
  ): { page: PDFPage; y: number } {
    const size = opts.size ?? 9.5;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? MARGIN + CONTENT_W - x;
    const leading = opts.leading ?? size * 1.38;
    let first: { page: PDFPage; y: number } | null = null;
    for (const line of this.wrap(runs, size, width)) {
      this.ensure(leading);
      const baseline = this.y - size;
      first ??= { page: this.page, y: baseline };
      let cx = x;
      for (const seg of line) {
        const font = this.font(seg.bold);
        this.page.drawText(seg.text, { x: cx, y: baseline, size, font, color: opts.color ?? INK });
        cx += font.widthOfTextAtSize(seg.text, size);
      }
      this.y -= leading;
    }
    return first!;
  }

  rule() {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT_W, y: this.y },
      thickness: 0.6,
      color: RULE,
    });
  }

  /** `keep`: points that must fit below the heading, so it isn't stranded at a page foot. */
  heading(title: string, keep = 60) {
    this.ensure(keep);
    this.gap(10);
    this.text(strong(title), { size: 12.5 });
    this.gap(1);
    this.rule();
    this.gap(8);
  }

  /** Label in a left column, value wrapped beside it. */
  row(label: string, value: Run[], labelW = 150, size = 9.5, valueSize = size) {
    this.ensure(size * 1.38);
    const top = this.y;
    const valueTop = this.text(value, { size: valueSize, x: MARGIN + labelW, leading: size * 1.38 });
    const end = this.y;
    valueTop.page.drawText(label, {
      x: MARGIN,
      y: valueTop.y,
      size,
      font: this.fonts.bold,
      color: INK,
    });
    this.y = Math.min(end, top - size * 1.38);
    this.gap(3);
  }
}

function drawBox(page: PDFPage, x: number, y: number, size: number) {
  page.drawRectangle({ x, y, width: size, height: size, borderWidth: 0.8, borderColor: INK });
}

function drawTick(page: PDFPage, x: number, y: number, size: number) {
  const p = (fx: number, fy: number) => ({ x: x + size * fx, y: y + size * fy });
  const opts = { thickness: Math.max(1, size / 7), color: INK };
  page.drawLine({ start: p(0.18, 0.52), end: p(0.42, 0.22), ...opts });
  page.drawLine({ start: p(0.42, 0.22), end: p(0.86, 0.84), ...opts });
}

function footer(w: Writer, fonts: Fonts, label: (i: number, n: number) => string) {
  const n = w.pages.length;
  w.pages.forEach((page, i) => {
    page.drawText(label(i + 1, n), { x: MARGIN, y: MARGIN - 6, size: 7.5, font: fonts.regular, color: MUTED });
  });
}

function setInfo(doc: PDFDocument, def: AgreementDefinition, applicationId: string, createdAt: Date, modifiedAt: Date) {
  const { spec } = specOf(def);
  doc.setTitle(`${spec.title} ${applicationId}`);
  doc.setAuthor('Astrea Labs LLC');
  doc.setSubject(`${spec.type} ${def.version}`);
  doc.setProducer(PRODUCER);
  doc.setCreator(CREATOR);
  doc.setLanguage('en-US');
  doc.setCreationDate(createdAt);
  doc.setModificationDate(modifiedAt);
}

const SAVE = { useObjectStreams: false } as const;

// ---------------------------------------------------------------------------
// Unsigned document

/** Checkboxes and the signing consent get a box; terms don't. */
const isCheckbox = (def: AgreementDefinition, b: Block) =>
  b.id === def.signingConsent?.id || def.checkboxes.some((c) => c.id === b.id);

function blockStatus(def: AgreementDefinition, b: Block, ticked: ConsentRecord | undefined): string {
  if (ticked) return `Ticked ${utcIso(ticked.tickedAt)} (UTC)`;
  if (b.id === def.signingConsent?.id) return 'Ticked at signing, in this signature block';
  if (b.optional) return 'Not ticked (optional)';
  if (isCheckbox(def, b)) return 'Not ticked';
  return `Shown to the applicant; acknowledged by ticking ${specOf(def).spec.termsAckId}`;
}

/** One term or checkbox: id, optional checkbox, text, then version / hash / status. */
function drawBlock(w: Writer, def: AgreementDefinition, b: Block, ticked: ConsentRecord | undefined) {
  const box = isCheckbox(def, b);
  const textX = MARGIN + ID_COL + (box ? BOX_GAP : 0);
  const size = 9.5;
  const runs: Run[] = [];
  const titled = b.title && !specOf(def).spec.sections[b.id[0]!]?.titleLine;
  if (titled) runs.push({ text: `${b.title} `, bold: true });
  runs.push(...markup(b.text));

  w.ensure(size * 1.38 * 2);
  // titleLine blocks: title line, then body; the id sits on the title line.
  const heading = b.title && !titled ? w.text(strong(b.title), { size, x: textX }) : null;
  const first = w.text(runs, { size, x: textX });
  const idAt = heading ?? first;
  idAt.page.drawText(b.id, { x: MARGIN, y: idAt.y, size, font: w.font(true), color: INK });
  let consent: SignatureBlock['consent'] | null = null;
  if (box) {
    const bx = MARGIN + ID_COL;
    const by = first.y - 1;
    drawBox(first.page, bx, by, BOX);
    if (ticked) drawTick(first.page, bx, by, BOX);
    consent = { x: bx, y: by, size: BOX };
  }
  w.gap(1);
  w.text(plain(`Version ${def.version} · SHA-256 ${sha256Hex(b.text)}`), { size: 7, x: textX, color: MUTED });
  w.text(plain(blockStatus(def, b, ticked)), { size: 7, x: textX, color: MUTED });
  w.gap(6);
  return { page: first.page, consent };
}

export async function buildUnsignedPdf(
  def: AgreementDefinition,
  input: {
    applicationId: string;
    /** The signer's details, shown first. */
    details: Detail[];
    consents: ConsentRecord[];
    createdAt: Date;
  },
): Promise<{ bytes: Uint8Array; signatureBlock: SignatureBlock }> {
  const { spec, consent } = specOf(def);
  const doc = await PDFDocument.create({ updateMetadata: false });
  setInfo(doc, def, input.applicationId, input.createdAt, input.createdAt);
  const fonts = await embedFonts(doc);
  const w = new Writer(doc, fonts);
  const ticked = new Map(input.consents.map((c) => [c.id, c]));

  w.newPage();
  w.text(strong(spec.title), { size: 18 });
  w.text(plain('Astrea Labs LLC'), { size: 10, color: MUTED });
  w.gap(10);
  w.row('Document type', plain(spec.type));
  w.row('Document version', plain(def.version));
  w.row('Application ID', plain(input.applicationId));
  w.row('Document created (UTC)', plain(input.createdAt.toISOString()));
  w.gap(6);
  w.text(plain(spec.intro), { size: 8, color: MUTED });

  w.heading(spec.detailsHeading);
  for (const a of input.details) {
    w.ensure(30);
    const top = w.text(strong(a.label), { size: 8.5, x: MARGIN + ID_COL });
    top.page.drawText(a.id, { x: MARGIN, y: top.y, size: 8.5, font: fonts.bold, color: INK });
    w.text(a.value ? plain(a.value) : plain('Not given'), {
      size: 10,
      x: MARGIN + ID_COL,
      color: a.value ? INK : MUTED,
    });
    w.gap(5);
  }

  let section = '';
  let signatureBlock: SignatureBlock | null = null;
  for (const b of allBlocks(def)) {
    if (b.id === consent.id) {
      signatureBlock = drawSignatureSection(w, def, b, ticked.get(b.id));
      continue;
    }
    const s = b.id[0]!;
    if (s !== section) {
      section = s;
      w.heading(spec.sections[s]?.heading ?? s);
    }
    drawBlock(w, def, b, ticked.get(b.id));
  }
  if (!signatureBlock) throw new Error(`${consent.id} missing from the document`);

  footer(w, fonts, (i, n) => `${spec.title} · ${input.applicationId} · Page ${i} of ${n}`);
  return { bytes: await doc.save(SAVE), signatureBlock };
}

// Signature section geometry. Name box is full width so long names fit.
const NAME_BOX_H = 32;
const DATE_BOX_W = 190;
const DATE_BOX_H = 24;
const BOX_PAD = 8;

function drawSignatureSection(
  w: Writer,
  def: AgreementDefinition,
  block: Block,
  ticked: ConsentRecord | undefined,
): SignatureBlock {
  const { spec } = specOf(def);
  w.ensure(270); // the whole section stays on one page
  w.heading(spec.signatureHeading);
  const { page, consent } = drawBlock(w, def, block, ticked);
  if (!consent) throw new Error(`${block.id} must render as a checkbox`);
  w.gap(4);

  w.text(strong(spec.signatureLabel), { size: 8.5 });
  w.gap(2);
  const nameBottom = w.y - NAME_BOX_H;
  page.drawRectangle({ x: MARGIN, y: nameBottom, width: CONTENT_W, height: NAME_BOX_H, borderWidth: 0.8, borderColor: INK });
  w.y = nameBottom - 10;

  w.text(strong('Date signed (UTC)'), { size: 8.5 });
  w.gap(2);
  const dateBottom = w.y - DATE_BOX_H;
  page.drawRectangle({ x: MARGIN, y: dateBottom, width: DATE_BOX_W, height: DATE_BOX_H, borderWidth: 0.8, borderColor: INK });
  w.y = dateBottom - 10;
  if (w.page !== page) throw new Error('Signature section split across pages');

  w.text(
    plain(
      `Signed electronically. At signing, the typed name, the UTC date and the ${block.id} tick are stamped here, and a ` +
        'signing certificate with the audit trail is appended as the last page.',
    ),
    { size: 8, color: MUTED },
  );

  const r2 = (n: number) => Math.round(n * 100) / 100; // tidy JSON; well under a pixel
  return {
    page: w.pages.indexOf(page), // 0-based page index
    name: { x: r2(MARGIN + BOX_PAD), y: r2(nameBottom + 11) },
    date: { x: r2(MARGIN + BOX_PAD), y: r2(dateBottom + 8) },
    consent: { x: r2(consent.x), y: r2(consent.y), size: consent.size },
  };
}

// ---------------------------------------------------------------------------
// Signing

const eventLabels = (consentId: string): Record<AuditEvent['type'], string> => ({
  document_created: 'Document created',
  email_confirmed: 'Email confirmed',
  document_viewed: 'Document viewed',
  consent_esign: `Consent to sign electronically (${consentId})`,
  signed: 'Signed',
});

/** Draws the typed name into the box, shrinking (then wrapping) it to fit the box width. */
function stampName(page: PDFPage, fonts: Fonts, name: string, at: { x: number; y: number }) {
  const font = fonts.bold;
  const width = PAGE_W - MARGIN - at.x - BOX_PAD;
  const text = clean(name).replace(/\n/g, ' ');
  let size = 13;
  while (size > 6 && font.widthOfTextAtSize(text, size) > width) size -= 0.5;
  if (font.widthOfTextAtSize(text, size) <= width) {
    page.drawText(text, { x: at.x, y: at.y, size, font, color: INK });
    return;
  }
  // Too long even at 6pt: wrap inside the box, last line on the usual baseline.
  const lines: string[] = [];
  let line = '';
  for (const ch of Array.from(text)) {
    if (font.widthOfTextAtSize(line + ch, 6) > width) {
      lines.push(line);
      line = '';
    }
    line += ch;
  }
  lines.push(line);
  lines.forEach((l, i) => {
    page.drawText(l, { x: at.x, y: at.y + (lines.length - 1 - i) * 7, size: 6, font, color: INK });
  });
}

export async function stampAndCertify(
  def: AgreementDefinition,
  unsigned: Uint8Array,
  input: { signatureBlock: SignatureBlock; signerName: string; signedAt: Date; audit: AuditTrail },
): Promise<Uint8Array> {
  const { spec, consent } = specOf(def);
  const { signatureBlock: sb, signerName, signedAt, audit } = input;
  const doc = await PDFDocument.load(unsigned, { updateMetadata: false });
  const fonts = await embedFonts(doc);
  const documentPages = doc.getPageCount();
  doc.setModificationDate(signedAt);

  const page = doc.getPage(sb.page);
  stampName(page, fonts, signerName, sb.name);
  page.drawText(`${signedAt.toISOString().slice(0, 10)} (UTC)`, {
    x: sb.date.x,
    y: sb.date.y,
    size: 11,
    font: fonts.regular,
    color: INK,
  });
  drawTick(page, sb.consent.x, sb.consent.y, sb.consent.size);

  const w = new Writer(doc, fonts);
  w.newPage();
  w.text(strong('Signing certificate'), { size: 18 });
  w.text(plain('Astrea Labs LLC'), { size: 10, color: MUTED });
  w.gap(6);
  w.text(
    plain(
      `Appended at signing to the ${documentPages}-page document before it. ` +
        'It records who signed, when, and the audit trail of the signing.',
    ),
    { size: 9 },
  );

  w.heading('Document');
  w.row('Document type', plain(audit.docType));
  w.row('Document version', plain(audit.docVersion));
  w.row('Document ID', plain(audit.documentId));
  w.row('Application ID', plain(audit.applicationId));
  w.row('Unsigned SHA-256', plain(audit.unsignedSha256), 150, 9.5, 8.5);
  w.text(
    plain(
      `SHA-256 of the document exactly as rendered and shown to the signer, before the name, date and ${consent.id} tick ` +
        'were stamped and this page was appended.',
    ),
    { size: 7.5, x: MARGIN + 150, color: MUTED },
  );

  w.heading('Signer');
  w.row(spec.signerNameLabel, plain(audit.signerName));
  w.row(spec.signerEmailLabel, plain(audit.signerEmail));
  w.row('Typed signature', plain(signerName));
  w.row('Signed at (UTC)', plain(signedAt.toISOString()));
  w.row('IP address', plain(audit.signerIp ?? 'Not recorded'));
  w.row('User agent', plain(audit.signerUa ?? 'Not recorded'));

  w.heading('Audit trail (UTC)');
  const labels = eventLabels(consent.id);
  for (const e of audit.events) w.row(labels[e.type] ?? e.type, plain(utcIso(e.at)), 220);

  w.heading('Final file hash and seal', 100);
  w.text(
    plain(
      "This file's own SHA-256 can't be printed inside it: writing the hash here would change the file, and so " +
        `the hash. It is recorded in the Astrea Labs LLC evidence record for document ${audit.documentId} and sealed ` +
        'there with a digital signature over that hash. To check a copy, compute its SHA-256 and compare it with ' +
        'the recorded value.',
    ),
    { size: 9 },
  );

  footer(w, fonts, (i, n) => `Signing certificate · ${audit.documentId} · Certificate page ${i} of ${n}`);
  return doc.save(SAVE);
}
