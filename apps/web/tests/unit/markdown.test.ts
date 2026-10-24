import { describe, expect, it } from 'vitest';
import { getProject, projects } from '@astrea/research-registry';
import { agentSetupPrompt } from '@/lib/agent-prompt';
import {
  absolutize,
  getMarkdownPage,
  llmsFullTxt,
  llmsTxt,
  markdownPages,
  postMarkdown,
  projectMarkdown,
} from '@/lib/markdown';
import { markdownPath, markdownRewrite, wantsMarkdown } from '@/lib/markdown-route';
import { getPost, getPosts } from '@/lib/writing';

const SITE = 'https://astrealabs.com';

describe('markdown routing', () => {
  it('maps .md URLs to the internal route', () => {
    expect(markdownRewrite('/index.md', null)).toBe('/md');
    expect(markdownRewrite('/projects.md', null)).toBe('/md/projects');
    expect(markdownRewrite('/projects/aletheia.md', null)).toBe('/md/projects/aletheia');
    expect(markdownRewrite('/writing/some-post.md', null)).toBe('/md/writing/some-post');
    expect(markdownRewrite('/research.md', null)).toBe('/md/research');
  });

  it('rewrites HTML URLs only when markdown is requested', () => {
    expect(markdownRewrite('/projects/aletheia', 'text/html')).toBeNull();
    expect(markdownRewrite('/projects/aletheia', 'text/markdown')).toBe('/md/projects/aletheia');
    expect(markdownRewrite('/', 'text/markdown, text/html;q=0.9')).toBe('/md');
    expect(markdownRewrite('/about/', 'text/markdown')).toBe('/md/about');
  });

  it('leaves non-content pages alone', () => {
    expect(markdownRewrite('/admin', 'text/markdown')).toBeNull();
    expect(markdownRewrite('/account.md', null)).toBeNull();
    expect(markdownRewrite('/projects/a/b.md', null)).toBeNull();
  });

  it('detects markdown Accept headers', () => {
    expect(wantsMarkdown('text/markdown')).toBe(true);
    expect(wantsMarkdown('text/html,text/markdown;q=0.5')).toBe(true);
    expect(wantsMarkdown('text/html')).toBe(false);
    expect(wantsMarkdown(null)).toBe(false);
  });

  it('builds markdown paths', () => {
    expect(markdownPath('/')).toBe('/index.md');
    expect(markdownPath('/writing/x')).toBe('/writing/x.md');
  });
});

describe('absolutize', () => {
  it('makes root-relative links absolute and keeps others', () => {
    expect(absolutize('[a](/feedback) [b](https://x.com/y) [c](#top)')).toBe(
      `[a](${SITE}/feedback) [b](https://x.com/y) [c](#top)`,
    );
    expect(absolutize('![pic](/media/a.png)')).toBe(`![pic](${SITE}/media/a.png)`);
    expect(absolutize('[ref]: /about')).toBe(`[ref]: ${SITE}/about`);
    expect(absolutize('[proto](//cdn.example.com/a)')).toBe('[proto](//cdn.example.com/a)');
  });

  it('turns Media JSX into markdown images', () => {
    expect(absolutize('<Media src="/media/demo.mp4" alt="Demo" />')).toBe(`![Demo](${SITE}/media/demo.mp4)`);
  });
});

describe('markdown pages', () => {
  const pages = markdownPages();

  it('covers home, sections, every project and every post', () => {
    const paths = pages.map((p) => p.path);
    expect(paths).toEqual(expect.arrayContaining(['/', '/projects', '/writing', '/research', '/about']));
    for (const p of projects) expect(paths).toContain(`/projects/${p.slug}`);
    for (const p of getPosts()) expect(paths).toContain(`/writing/${p.slug}`);
    expect(new Set(paths).size).toBe(paths.length);
    expect(getMarkdownPage('/nope')).toBeUndefined();
  });

  it('never emits root-relative links', () => {
    for (const page of pages) expect(page.render()).not.toMatch(/\]\(\/(?!\/)/);
  });

  it('renders a project from the registry', () => {
    const p = getProject('aletheia')!;
    const md = projectMarkdown(p);
    expect(md.startsWith(`# ${p.name}\n\n> ${p.tagline}`)).toBe(true);
    for (const para of p.description) expect(md).toContain(para);
    for (const h of p.highlights) expect(md).toContain(`- ${h}`);
    expect(md).toContain('## Agent setup prompt');
  });

  it('renders posts with absolute links', () => {
    const meta = getPosts()[0];
    if (!meta) return;
    const md = postMarkdown(getPost(meta.slug)!);
    expect(md.startsWith(`# ${meta.title}\n\n> ${meta.summary}`)).toBe(true);
    expect(md).toContain(`Published ${meta.date}`);
  });
});

describe('llms.txt', () => {
  it('links every page’s markdown version', () => {
    const txt = llmsTxt();
    expect(txt.startsWith('# Astrea Labs\n\n> ')).toBe(true);
    expect(txt).toContain(`(${SITE}/index.md)`);
    for (const page of markdownPages()) {
      expect(txt).toContain(`(${SITE}${page.path === '/' ? '/index' : page.path}.md)`);
    }
    expect(txt).toContain(`${SITE}/llms-full.txt`);
  });

  it('llms-full.txt contains every page', () => {
    const full = llmsFullTxt();
    for (const page of markdownPages()) expect(full).toContain(page.render().trim());
  });
});

describe('agent setup prompt', () => {
  it('uses README setup data verbatim for projects that have it', () => {
    for (const p of projects.filter((p) => p.setup && !p.repo?.private)) {
      const prompt = agentSetupPrompt(p);
      expect(prompt).toContain(`git clone https://github.com/${p.repo!.owner}/${p.repo!.name}.git`);
      for (const c of p.setup!.commands) expect(prompt).toContain(c);
      for (const r of p.setup!.requirements) expect(prompt).toContain(r);
      expect(prompt).toContain(p.setup!.source);
    }
  });

  it('marks unknowns with TODO instead of guessing', () => {
    const priv = projects.find((p) => p.repo?.private);
    if (priv) {
      const prompt = agentSetupPrompt(priv);
      expect(prompt).toContain('TODO:');
      expect(prompt).not.toContain('git clone');
    }
    const noSetup = { ...getProject('aletheia')!, setup: undefined };
    expect(agentSetupPrompt(noSetup)).toMatch(/TODO: setup steps haven't been added/);
    const noReqs = { ...getProject('aletheia')!, setup: { ...getProject('aletheia')!.setup!, requirements: [] } };
    expect(agentSetupPrompt(noReqs)).toContain('TODO: the README doesn’t list prerequisites');
  });

  it('only setup-documents projects with a public repo', () => {
    for (const p of projects.filter((p) => p.setup)) expect(p.repo && !p.repo.private).toBeTruthy();
  });
});
