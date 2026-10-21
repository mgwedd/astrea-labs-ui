import { describe, expect, it } from 'vitest';
import {
  contributions,
  DOMAINS,
  featuredProjects,
  getProject,
  getProjectBySubdomain,
  PROJECT_SUBDOMAINS,
  projects,
  technicalNotes,
} from '@astrea/research-registry';

describe('research registry', () => {
  it('has unique project slugs and subdomains', () => {
    const slugs = projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(PROJECT_SUBDOMAINS).size).toBe(PROJECT_SUBDOMAINS.length);
  });

  it('only uses known domains, primary first', () => {
    const ids = DOMAINS.map((d) => d.id);
    for (const p of projects) {
      expect(p.domains.length).toBeGreaterThan(0);
      for (const d of p.domains) expect(ids).toContain(d);
    }
  });

  it('never links private repos', () => {
    for (const p of projects.filter((p) => p.repo?.private)) {
      expect(p.releases).toBeUndefined();
      expect(p.downloads).toBeUndefined();
    }
  });

  it('looks projects up by slug and subdomain', () => {
    expect(getProject('aletheia')?.name).toBe('Aletheia');
    expect(getProjectBySubdomain('sda')?.slug).toBe('sda');
    expect(getProject('nope')).toBeUndefined();
  });

  it('orders featured projects', () => {
    const orders = featuredProjects().map((p) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('points notes and contributions at real projects and GitHub', () => {
    for (const n of technicalNotes) expect(getProject(n.projectSlug)).toBeDefined();
    for (const c of contributions) expect(c.url).toMatch(/^https:\/\/github\.com\/.+\/pull\/\d+$/);
  });
});
