import type { GitHubRepo, Platform } from '@astrea/research-registry';

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
  platform?: Platform;
}

export interface Release {
  tag: string;
  name: string;
  url: string;
  publishedAt: string;
  assets: ReleaseAsset[];
}

function platformOf(file: string): Platform | undefined {
  const f = file.toLowerCase();
  if (f.endsWith('.dmg') || f.includes('macos') || f.includes('darwin')) return 'macos';
  if (f.endsWith('.exe') || f.endsWith('.msi') || f.includes('windows') || f.includes('win64')) return 'windows';
  if (f.endsWith('.appimage') || f.endsWith('.deb') || f.includes('linux')) return 'linux';
  return undefined;
}

/** Latest GitHub release, cached for an hour. Returns null on any failure so pages fall back to static links. */
export async function getLatestRelease(repo: GitHubRepo): Promise<Release | null> {
  if (repo.private) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const r = (await res.json()) as {
      tag_name: string;
      name: string | null;
      html_url: string;
      published_at: string;
      assets: { name: string; browser_download_url: string; size: number }[];
    };
    return {
      tag: r.tag_name,
      name: r.name || r.tag_name,
      url: r.html_url,
      publishedAt: r.published_at,
      assets: r.assets
        .map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size, platform: platformOf(a.name) }))
        .filter((a) => a.platform),
    };
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
