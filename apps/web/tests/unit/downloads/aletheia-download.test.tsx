import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { getProject } from '@astrea/research-registry';

const getLatestRelease = vi.fn();
vi.mock('@/lib/releases', async (orig) => ({
  ...(await orig<typeof import('@/lib/releases')>()),
  getLatestRelease: (...a: unknown[]) => getLatestRelease(...a),
}));

import AletheiaDownloadPage, { metadata, revalidate } from '@/app/(site)/aletheia/download/page';
import DownloadsPage, { revalidate as downloadsRevalidate } from '@/app/(site)/downloads/page';
import { ProjectDetail } from '@/components/project-detail';

const release = {
  tag: 'v1.2.3',
  name: 'Aletheia 1.2.3',
  url: 'https://github.com/mgwedd/aletheia/releases/tag/v1.2.3',
  publishedAt: '2026-10-01T12:00:00Z',
  assets: [
    { name: 'Aletheia-1.2.3.dmg', url: 'https://example.test/Aletheia-1.2.3.dmg', size: 52 * 1024 * 1024, platform: 'macos' },
  ],
};

beforeEach(() => getLatestRelease.mockReset());

describe('/aletheia/download', () => {
  it('shows the latest Aletheia release with asset, size, tag and release notes', async () => {
    getLatestRelease.mockResolvedValue(release);
    render(await AletheiaDownloadPage());
    expect(getLatestRelease).toHaveBeenCalledWith(getProject('aletheia')!.releases);
    expect(screen.getByRole('heading', { level: 1, name: 'Download Aletheia' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Aletheia-1\.2\.3\.dmg/ })).toHaveAttribute('href', release.assets[0].url);
    expect(screen.getByText(/52.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.2\.3/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Release notes/ })).toHaveAttribute('href', release.url);
  });

  it('renders Aletheia only', async () => {
    getLatestRelease.mockResolvedValue(release);
    render(await AletheiaDownloadPage());
    expect(screen.getAllByRole('link', { name: 'Aletheia' })).toHaveLength(1);
    expect(getLatestRelease).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Get the apps')).not.toBeInTheDocument();
  });

  it('links to the beta license page', async () => {
    getLatestRelease.mockResolvedValue(release);
    render(await AletheiaDownloadPage());
    expect(screen.getByText(/needs a free beta license/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apply for a free beta license/ })).toHaveAttribute('href', '/aletheia/beta');
  });

  it('lists requirements', async () => {
    getLatestRelease.mockResolvedValue(release);
    render(await AletheiaDownloadPage());
    const reqs = within(screen.getByRole('region', { name: 'Requirements' }));
    expect(reqs.getByText('macOS 14 or later')).toBeInTheDocument();
    expect(reqs.getByText(/Apple Silicon with 16 GB/)).toBeInTheDocument();
    expect(reqs.getByText(/3 to 8 GB of free disk/)).toBeInTheDocument();
  });

  it('falls back to the registry download links when there is no release', async () => {
    getLatestRelease.mockResolvedValue(null);
    render(await AletheiaDownloadPage());
    const fallback = getProject('aletheia')!.downloads![0];
    expect(screen.getByRole('link', { name: new RegExp(fallback.label) })).toHaveAttribute('href', fallback.url);
    expect(screen.queryByText(/Release notes/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apply for a free beta license/ })).toHaveAttribute('href', '/aletheia/beta');
  });

  it('has metadata and the same revalidate as /downloads', () => {
    expect(metadata.title).toBe('Download Aletheia');
    expect(metadata.description).toMatch(/Aletheia/);
    expect(revalidate).toBe(downloadsRevalidate);
  });
});

describe('/downloads', () => {
  it('still includes the Aletheia card with the license link', async () => {
    getLatestRelease.mockResolvedValue(null);
    render(await DownloadsPage());
    expect(screen.getByRole('link', { name: 'Aletheia' })).toHaveAttribute('href', '/projects/aletheia');
    expect(screen.getByRole('link', { name: /Apply for a free beta license/ })).toHaveAttribute('href', '/aletheia/beta');
  });
});

describe('project page call to action', () => {
  it('leads Aletheia with the beta application, not a download', async () => {
    render(await ProjectDetail({ project: getProject('aletheia')! }));
    expect(screen.getByRole('link', { name: /Apply for the beta/ })).toHaveAttribute('href', '/aletheia/beta/apply');
    expect(screen.getByRole('link', { name: 'How the beta works' })).toHaveAttribute('href', '/aletheia/beta');
    expect(screen.queryByRole('link', { name: /Download/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Latest release' })).toBeNull();
    expect(getLatestRelease).not.toHaveBeenCalled();
  });

  it('keeps other projects on /downloads', async () => {
    getLatestRelease.mockResolvedValue(null);
    const other = (await import('@astrea/research-registry')).projects.find(
      (p) => p.slug !== 'aletheia' && p.downloads?.length,
    )!;
    render(await ProjectDetail({ project: other }));
    expect(screen.getByRole('link', { name: /Download/ })).toHaveAttribute('href', '/downloads');
  });
});
