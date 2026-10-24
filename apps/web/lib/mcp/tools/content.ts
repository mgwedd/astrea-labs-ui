import { getProject, projects } from '@astrea/research-registry';
import * as z from 'zod/v4';
import { getMarkdownPage, markdownPages, projectMarkdown } from '@/lib/markdown';
import { site } from '@/lib/site';
import { getPosts } from '@/lib/writing';
import type { McpTool } from './types';

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const markdown = (text: string) => ({ content: [{ type: 'text' as const, text }] });
const notFound = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/** `https://astrealabs.com/writing/x.md`, `/writing/x.md` and `writing/x` all become `/writing/x`. */
export function normalizePagePath(input: string): string {
  let path = input.trim();
  if (path.startsWith(site.url)) path = path.slice(site.url.length);
  path = path.split(/[?#]/)[0] ?? '';
  if (!path.startsWith('/')) path = `/${path}`;
  if (path === '/index.md') return '/';
  if (path.endsWith('.md')) path = path.slice(0, -3);
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

export const listProjects: McpTool = {
  name: 'list_projects',
  register: (server) =>
    server.registerTool(
      'list_projects',
      {
        title: 'List projects',
        description: 'Every Astrea Labs project with its slug, tagline and status. Use a slug with get_project.',
        annotations: readOnly,
      },
      async () =>
        json(
          [...projects]
            .sort((a, b) => a.order - b.order)
            .map((p) => ({ slug: p.slug, name: p.name, tagline: p.tagline, status: p.status, url: `${site.url}/projects/${p.slug}` })),
        ),
    ),
};

export const getProjectTool: McpTool = {
  name: 'get_project',
  register: (server) =>
    server.registerTool(
      'get_project',
      {
        title: 'Get a project',
        description: 'One project as markdown: status, stack, links, overview and a setup prompt you can follow to set it up.',
        inputSchema: z.object({ slug: z.string().describe('Project slug from list_projects, e.g. "sda".') }),
        annotations: readOnly,
      },
      async ({ slug }) => {
        const project = getProject(slug);
        return project
          ? markdown(projectMarkdown(project))
          : notFound(`No project "${slug}". Known slugs: ${projects.map((p) => p.slug).join(', ')}.`);
      },
    ),
};

export const listPosts: McpTool = {
  name: 'list_posts',
  register: (server) =>
    server.registerTool(
      'list_posts',
      {
        title: 'List posts',
        description: 'Posts from the lab, newest first. Read one with get_page and its path.',
        annotations: readOnly,
      },
      async () =>
        json(
          getPosts().map((p) => ({
            slug: p.slug,
            title: p.title,
            date: p.date,
            summary: p.summary,
            tags: p.tags,
            path: `/writing/${p.slug}`,
          })),
        ),
    ),
};

export const getPage: McpTool = {
  name: 'get_page',
  register: (server) =>
    server.registerTool(
      'get_page',
      {
        title: 'Get a page as markdown',
        description: `Any page of ${site.url} that has a markdown version, by path ("/", "/research", "/writing/<slug>", "/projects/<slug>").`,
        inputSchema: z.object({ path: z.string().describe('Page path or URL, e.g. "/about".') }),
        annotations: readOnly,
      },
      async ({ path }) => {
        const page = getMarkdownPage(normalizePagePath(path));
        return page
          ? markdown(page.render())
          : notFound(
              `No markdown page at "${path}". Pages: ${markdownPages()
                .map((p) => p.path)
                .join(', ')}. Full list: ${site.url}/llms.txt`,
            );
      },
    ),
};

export const contentTools = [listProjects, getProjectTool, listPosts, getPage];
