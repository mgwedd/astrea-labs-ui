import { createSign } from 'node:crypto';
import type { Repo } from './projects';

// Authenticates as a GitHub App. Env: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PEM;
// literal "\n" sequences are accepted). Tokens are minted per repo with only
// issues:write + metadata:read and cached until ~5 minutes before expiry.

const API = 'https://api.github.com';
const REFRESH_MARGIN_MS = 5 * 60_000;
const cache = new Map<string, { token: string; expiresAt: number }>();

export const clearTokenCache = () => cache.clear();

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

function appJwt(appId: string, pem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }))}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(pem);
  return `${unsigned}.${b64url(sig)}`;
}

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'astrealabs-feedback',
});

/** Installation token for one repo, or undefined when the App is not configured. */
export async function getGitHubToken(owner: string, repo: string): Promise<string | undefined> {
  const appId = process.env.GITHUB_APP_ID;
  const pem = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!appId || !pem) return undefined;

  const key = `${owner}/${repo}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt - REFRESH_MARGIN_MS > Date.now()) return hit.token;

  const jwt = appJwt(appId, pem);
  const inst = await fetch(`${API}/repos/${owner}/${repo}/installation`, { headers: headers(jwt) });
  if (!inst.ok) throw new Error(`GitHub App installation lookup failed: ${inst.status}`);
  const { id } = (await inst.json()) as { id: number };

  const res = await fetch(`${API}/app/installations/${id}/access_tokens`, {
    method: 'POST',
    headers: { ...headers(jwt), 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions: { issues: 'write', metadata: 'read' }, repositories: [repo] }),
  });
  if (!res.ok) throw new Error(`GitHub App token request failed: ${res.status}`);
  const data = (await res.json()) as { token: string; expires_at: string };
  cache.set(key, { token: data.token, expiresAt: Date.parse(data.expires_at) });
  return data.token;
}

export type CreatedIssue = { number: number; url: string };
export type IssueDraft = { title: string; body: string; labels: string[] };

async function post(token: string, repo: Repo, payload: Record<string, unknown>) {
  return fetch(`${API}/repos/${repo.owner}/${repo.name}/issues`, {
    method: 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * POST /repos/{owner}/{repo}/issues. Missing labels are created by GitHub only
 * if the token may; on a 422 we retry once without labels.
 * With the App unconfigured outside production, logs the would-be issue instead.
 */
export async function createIssue(repo: Repo, issue: IssueDraft): Promise<CreatedIssue> {
  const token = await getGitHubToken(repo.owner, repo.name);
  if (!token) {
    if (process.env.NODE_ENV === 'production') throw new Error('GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are not set');
    console.log(
      `\n--- feedback issue (dev, not created) ---\nRepo: ${repo.owner}/${repo.name}\nLabels: ${issue.labels.join(', ')}\nTitle: ${issue.title}\n\n${issue.body}\n---\n`,
    );
    return { number: 0, url: `https://github.com/${repo.owner}/${repo.name}/issues (dev: not created)` };
  }

  let res = await post(token, repo, issue);
  if (res.status === 422 && issue.labels.length > 0) res = await post(token, repo, { title: issue.title, body: issue.body });
  if (!res.ok) throw new Error(`GitHub issue create failed: ${res.status}`);
  const data = (await res.json()) as { number: number; html_url: string };
  return { number: data.number, url: data.html_url };
}
