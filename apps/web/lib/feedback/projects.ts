import { projects as registry } from '@astrea/research-registry';

export type Repo = { owner: string; name: string };

/**
 * Project slug (from @astrea/research-registry) -> GitHub repo that receives its
 * feedback issues. The picker offers only projects present here with a real repo.
 * Each repo below matches `repo` in the registry and was checked public with
 * issues enabled. null = no public repo; not offered.
 * elenchos is left out on purpose: its registry repo is private.
 */
const REPOS: Record<string, Repo | null> = {
  aletheia: { owner: 'mgwedd', name: 'aletheia' },
  groundwork: { owner: 'KingMoonk', name: 'TRAINER' },
  sda: { owner: 'mgwedd', name: 'astrea-sda-api' },
  eido: { owner: 'mgwedd', name: 'eido' },
  elenchos: null, // private repo: GitHub issues are not a public channel for it
};

export type FeedbackProject = { slug: string; name: string; repo: Repo; hint?: string };

const HINTS: Record<string, string> = { aletheia: 'macOS version and app version' };

export const FEEDBACK_PROJECTS: FeedbackProject[] = registry.flatMap((p) => {
  const repo = REPOS[p.slug];
  if (!repo) return [];
  return [{ slug: p.slug, name: p.name, repo, hint: HINTS[p.slug] }];
});

export const getFeedbackProject = (slug: string) => FEEDBACK_PROJECTS.find((p) => p.slug === slug);
