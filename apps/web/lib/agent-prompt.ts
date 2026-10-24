import type { Platform, Project } from '@astrea/research-registry';
import { site } from './site';

export const PLATFORM: Record<Platform, string> = { macos: 'macOS', windows: 'Windows', linux: 'Linux', ios: 'iOS', web: 'Web' };

/**
 * A prompt a person can hand to a coding agent to set a project up.
 * Every line comes from the registry; setup steps come from `project.setup`,
 * which is copied from the project's README. Unknowns are marked `TODO:`.
 */
export function agentSetupPrompt(project: Project): string {
  const repo = project.repo;
  const repoUrl = repo && !repo.private ? `https://github.com/${repo.owner}/${repo.name}` : undefined;
  const lines: string[] = [
    `Set up ${project.name} on this machine.`,
    '',
    `About: ${project.summary}`,
    `Project page: ${site.url}/projects/${project.slug}`,
  ];
  if (repoUrl) lines.push(`Source: ${repoUrl}`);
  else if (repo?.private) lines.push('Source: private repository.');
  if (project.platforms?.length) lines.push(`Platforms: ${project.platforms.map((p) => PLATFORM[p]).join(', ')}`);
  lines.push(`Stack: ${project.stack.join(', ')}`);
  if (project.license) lines.push(`License: ${project.license}`);
  if (project.links.docs) lines.push(`Docs: ${project.links.docs}`);
  if (project.links.site) lines.push(`Hosted version: ${project.links.site}`);
  for (const d of project.downloads ?? []) {
    lines.push(`Prebuilt ${PLATFORM[d.platform]} download: ${d.url}${d.note ? ` (${d.note})` : ''}`);
  }
  lines.push('');

  const setup = project.setup;
  if (!repoUrl || !setup) {
    lines.push(
      repoUrl
        ? `TODO: setup steps haven't been added for this project yet. Read the README at ${repoUrl} and follow its setup instructions.`
        : 'TODO: the source isn’t public, so there are no setup steps to give.',
    );
    return lines.join('\n');
  }

  lines.push(`Developer setup, from ${setup.source}:`, '', 'Prerequisites:');
  if (setup.requirements.length) lines.push(...setup.requirements.map((r) => `- ${r}`));
  else lines.push('- TODO: the README doesn’t list prerequisites for these steps.');
  lines.push('', 'Steps:');
  const commands = [`git clone ${repoUrl}.git && cd ${repo!.name}`, ...setup.commands];
  lines.push(...commands.map((c, i) => `${i + 1}. ${c}`));
  lines.push(
    '',
    'Check each step against the README before you run it. If anything differs or fails, stop and tell me instead of guessing.',
  );
  return lines.join('\n');
}
