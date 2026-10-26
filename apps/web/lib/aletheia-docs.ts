import 'server-only';
import { hashDocument } from './licensing/token';

// The Aletheia app repo owns TERMS.md and PRIVACY.md. The site fetches them,
// renders them and records which version and bytes a person accepted. Nothing
// here falls back to a stored version or text: a failed fetch or a file
// without a version line throws.

const RAW_BASE = 'https://raw.githubusercontent.com/mgwedd/aletheia/main';
const REVALIDATE_SECONDS = 3600;

export const ALETHEIA_DOC_FILES = { terms: 'TERMS.md', privacy: 'PRIVACY.md' } as const;
export type AletheiaDocId = keyof typeof ALETHEIA_DOC_FILES;

export type AletheiaDoc = {
  /** The date in the `_Last updated: YYYY-MM-DD_` line; also the app's terms version. */
  version: string;
  /** Lowercase hex SHA-256 of the exact bytes fetched. */
  sha256: string;
  markdown: string;
};

export type LegalDocs = { version: string; terms: AletheiaDoc; privacy: AletheiaDoc };

const VERSION_LINE = /^_Last updated: (\d{4}-\d{2}-\d{2})_\r?$/m;

/** The version in a document's `_Last updated: YYYY-MM-DD_` line. Throws when there is none. */
export function parseVersion(markdown: string): string {
  const match = VERSION_LINE.exec(markdown);
  const version = match?.[1];
  if (!version || Number.isNaN(Date.parse(version))) throw new Error('Aletheia document has no valid "_Last updated: YYYY-MM-DD_" line');
  return version;
}

/** Builds a document from the exact response bytes. */
export function docFromBytes(bytes: Uint8Array): AletheiaDoc {
  const markdown = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { version: parseVersion(markdown), sha256: hashDocument(bytes), markdown };
}

export async function fetchAletheiaDoc(id: AletheiaDocId): Promise<AletheiaDoc> {
  const file = ALETHEIA_DOC_FILES[id];
  const res = await fetch(`${RAW_BASE}/${file}`, { next: { revalidate: REVALIDATE_SECONDS, tags: ['aletheia-docs', `aletheia-${id}`] } });
  if (!res.ok) throw new Error(`Fetching Aletheia ${file} failed: HTTP ${res.status}`);
  return docFromBytes(new Uint8Array(await res.arrayBuffer()));
}

/** Both documents. They must carry the same version, as the app uses one version for both. */
export async function getLegalDocs(): Promise<LegalDocs> {
  const [terms, privacy] = await Promise.all([fetchAletheiaDoc('terms'), fetchAletheiaDoc('privacy')]);
  if (terms.version !== privacy.version) {
    throw new Error(`Aletheia terms (${terms.version}) and privacy (${privacy.version}) versions differ`);
  }
  return { version: terms.version, terms, privacy };
}

const SITE_PAGES: Record<string, string> = { 'TERMS.md': '/aletheia/terms', 'PRIVACY.md': '/aletheia/privacy' };
const REPO_BLOB = 'https://github.com/mgwedd/aletheia/blob/main';
const SAFE_ABSOLUTE = /^(https?:|mailto:)/i;

/**
 * Where a link in the fetched markdown should point on this site. TERMS.md and
 * PRIVACY.md become the site pages, other relative paths become files in the
 * Aletheia repo, and anything that is not http(s), mailto or a fragment is dropped.
 */
export function rewriteLink(href: string | undefined): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('#')) return href;
  if (SAFE_ABSOLUTE.test(href)) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return undefined;
  const [pathAndQuery = '', fragment] = href.split('#');
  const path = (pathAndQuery.split('?')[0] ?? '').replace(/^\.?\/+/, '');
  if (!path) return undefined;
  const hash = fragment ? `#${fragment}` : '';
  const page = SITE_PAGES[path];
  if (page) return `${page}${hash}`;
  // Resolve ./ and ../ segments so a path can't climb out of the repo.
  const parts: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return `${REPO_BLOB}/${parts.map(encodeURI).join('/')}${hash}`;
}
