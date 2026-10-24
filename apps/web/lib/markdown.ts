import {
  contributions,
  DOMAINS,
  getDomain,
  getProject,
  projects,
  PUBLICATIONS,
  technicalNotes,
  type Project,
  type ProjectStatus,
} from '@astrea/research-registry';
import { agentSetupPrompt, PLATFORM } from './agent-prompt';
import { markdownUrl } from './markdown-route';
import { site } from './site';
import { getPost, getPosts, type Post } from './writing';

const STATUS: Record<ProjectStatus, string> = {
  beta: 'Public beta',
  active: 'Active',
  shipped: 'Shipped',
  research: 'Research',
  archived: 'Archived',
};

const url = (path: string) => `${site.url}${path === '/' ? '' : path}`;

/**
 * Makes root-relative links absolute and turns `<Media src alt />` JSX into
 * markdown images, so the output reads the same anywhere.
 */
export function absolutize(md: string): string {
  return md
    .replace(/<Media\b([^>]*?)\/>/g, (_m, attrs: string) => {
      const src = /src=["']([^"']+)["']/.exec(attrs)?.[1];
      const alt = /alt=["']([^"']*)["']/.exec(attrs)?.[1] ?? '';
      return src ? `![${alt}](${src})` : '';
    })
    .replace(/(\]\()\/(?!\/)/g, `$1${site.url}/`)
    .replace(/^(\[[^\]]+\]:\s*)\/(?!\/)/gm, `$1${site.url}/`);
}

const sortedProjects = () => [...projects].sort((a, b) => a.order - b.order);

const projectLine = (p: Project) => `- [${p.name}](${url(`/projects/${p.slug}`)}): ${p.tagline} (${STATUS[p.status]})`;

const doc = (title: string, ...sections: (string | false | undefined)[]) =>
  `${[`# ${title}`, ...sections.filter(Boolean)].join('\n\n')}\n`;

export function homeMarkdown(): string {
  const posts = getPosts();
  const merged = contributions.filter((c) => c.state === 'merged');
  return doc(
    site.name,
    `> ${site.description}`,
    `${site.about.intro}`,
    `## Projects\n\n${sortedProjects().map(projectLine).join('\n')}`,
    posts.length > 0 &&
      `## Writing\n\n${posts.map((p) => `- [${p.title}](${url(`/writing/${p.slug}`)}) (${p.date}): ${p.summary}`).join('\n')}`,
    merged.length > 0 &&
      `## Merged upstream contributions\n\n${merged.map((c) => `- [${c.project}: ${c.title}](${c.url})`).join('\n')}`,
    `## Areas\n\n${DOMAINS.map((d) => `- **${d.label}**: ${d.description}`).join('\n')}`,
  );
}

export function projectsMarkdown(): string {
  return doc('Projects', `${sortedProjects().map(projectLine).join('\n')}`);
}

export function projectMarkdown(project: Project): string {
  const repo = project.repo;
  const facts = [
    `- Status: ${STATUS[project.status]}`,
    `- Areas: ${project.domains.map((d) => getDomain(d).label).join(', ')}`,
    `- Started: ${project.year}`,
    project.platforms && `- Platforms: ${project.platforms.map((p) => PLATFORM[p]).join(', ')}`,
    project.license && `- License: ${project.license}`,
    `- Stack: ${project.stack.join(', ')}`,
    repo && (repo.private ? '- Source: private' : `- Source: https://github.com/${repo.owner}/${repo.name}`),
    project.links.site && `- Site: ${project.links.site}`,
    project.links.docs && `- Docs: ${project.links.docs}`,
    project.links.changelog && `- Changelog: ${project.links.changelog}`,
    project.subdomain && `- Home: https://${project.subdomain}.astrealabs.com`,
  ].filter(Boolean);
  const notes = technicalNotes.filter((n) => n.projectSlug === project.slug);
  return doc(
    project.name,
    `> ${project.tagline}`,
    facts.join('\n'),
    project.role,
    `## Overview\n\n${project.description.join('\n\n')}`,
    `## Highlights\n\n${project.highlights.map((h) => `- ${h}`).join('\n')}`,
    !!project.downloads?.length &&
      `## Downloads\n\n${project.downloads.map((d) => `- [${d.label}](${d.url})${d.note ? `: ${d.note}` : ''}`).join('\n')}`,
    notes.length > 0 && `## Design notes\n\n${notes.map((n) => `- [${n.title}](${n.url}): ${n.summary}`).join('\n')}`,
    `## Agent setup prompt\n\n\`\`\`text\n${agentSetupPrompt(project)}\n\`\`\``,
  );
}

export function writingMarkdown(): string {
  const posts = getPosts();
  return doc(
    'Writing',
    posts.length === 0
      ? 'Nothing published yet.'
      : posts
          .map((p) => `- [${p.title}](${url(`/writing/${p.slug}`)}) (${p.date}): ${p.summary}`)
          .join('\n'),
  );
}

export function postMarkdown(post: Post): string {
  const project = post.project ? getProject(post.project) : undefined;
  const meta = [
    `Published ${post.date}`,
    post.tags.length > 0 && `Tags: ${post.tags.join(', ')}`,
    project && `Project: [${project.name}](${url(`/projects/${project.slug}`)})`,
  ].filter(Boolean);
  return doc(post.title, `> ${post.summary}`, meta.join(' · '), absolutize(post.body.trim()));
}

export function researchMarkdown(): string {
  const sorted = [...contributions].sort((a, b) =>
    a.state === b.state ? (b.date ?? '').localeCompare(a.date ?? '') : a.state === 'merged' ? -1 : 1,
  );
  const papers =
    PUBLICATIONS.length === 0
      ? 'No papers yet.'
      : PUBLICATIONS.map(
          (p) =>
            `### ${p.title}\n\n${p.authors.join(', ')} · ${p.venue} · ${p.date}\n\n${p.abstract}${
              p.pdfUrl ? `\n\n[PDF](${p.pdfUrl})` : ''
            }${p.arxivId ? `\n\n[arXiv](https://arxiv.org/abs/${p.arxivId})` : ''}`,
        ).join('\n\n');
  return doc(
    'Research',
    `## Papers\n\n${papers}`,
    `## Design notes\n\n${technicalNotes
      .map((n) => `- [${n.title}](${n.url}) (${getProject(n.projectSlug)?.name ?? n.projectSlug}): ${n.summary}`)
      .join('\n')}`,
    `## Upstream contributions\n\n${sorted
      .map((c) => `- [${c.project}: ${c.title}](${c.url}) (${c.state}${c.date ? `, ${c.date}` : ''})`)
      .join('\n')}`,
  );
}

export function aboutMarkdown(): string {
  return doc(
    site.about.title,
    site.about.intro,
    site.about.body,
    `## People\n\n${site.team.map((m) => `- ${m.name} (https://github.com/${m.github})`).join('\n')}`,
    `## Areas\n\n${DOMAINS.map((d) => `- **${d.label}**: ${d.description}`).join('\n')}`,
  );
}

export interface MarkdownPage {
  /** Public HTML path, e.g. `/writing/foo`. */
  path: string;
  title: string;
  description: string;
  section: 'Pages' | 'Projects' | 'Writing';
  render: () => string;
}

/** Every page that has a markdown version. The `.md` routes, llms.txt and llms-full.txt all read this list. */
export function markdownPages(): MarkdownPage[] {
  return [
    { path: '/', title: 'Home', description: site.description, section: 'Pages', render: homeMarkdown },
    { path: '/projects', title: 'Projects', description: 'Every project, with status.', section: 'Pages', render: projectsMarkdown },
    { path: '/writing', title: 'Writing', description: 'Posts from the lab.', section: 'Pages', render: writingMarkdown },
    {
      path: '/research',
      title: 'Research',
      description: 'Papers, design notes and upstream contributions.',
      section: 'Pages',
      render: researchMarkdown,
    },
    { path: '/about', title: 'About', description: 'Who runs the lab.', section: 'Pages', render: aboutMarkdown },
    ...sortedProjects().map((p) => ({
      path: `/projects/${p.slug}`,
      title: p.name,
      description: p.tagline,
      section: 'Projects' as const,
      render: () => projectMarkdown(p),
    })),
    ...getPosts().map((p) => ({
      path: `/writing/${p.slug}`,
      title: p.title,
      description: p.summary,
      section: 'Writing' as const,
      render: () => postMarkdown(getPost(p.slug)!),
    })),
  ];
}

export const getMarkdownPage = (path: string) => markdownPages().find((p) => p.path === path);

export function llmsTxt(): string {
  const pages = markdownPages();
  const list = (section: MarkdownPage['section']) =>
    pages
      .filter((p) => p.section === section)
      .map((p) => `- [${p.title}](${markdownUrl(p.path)}): ${p.description}`)
      .join('\n');
  return doc(
    site.name,
    `> ${site.description}`,
    'Every page below has a markdown version: add `.md` to its URL (the home page is `/index.md`) or request it with `Accept: text/markdown`.',
    `## Pages\n\n${list('Pages')}`,
    `## Projects\n\n${list('Projects')}`,
    pages.some((p) => p.section === 'Writing') && `## Writing\n\n${list('Writing')}`,
    `## Optional\n\n- [Full content](${site.url}/llms-full.txt): every page above in one file\n- [RSS feed](${site.url}/feed.xml): posts`,
  );
}

export function llmsFullTxt(): string {
  return markdownPages()
    .map((p) => `<!-- Source: ${url(p.path)} -->\n\n${p.render().trim()}`)
    .join('\n\n---\n\n')
    .concat('\n');
}
