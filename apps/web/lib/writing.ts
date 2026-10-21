import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const DIR = path.join(process.cwd(), 'content/writing');

export interface PostMeta {
  slug: string;
  title: string;
  summary: string;
  date: string;
  tags: string[];
  project?: string;
  readingMinutes: number;
}

export interface Post extends PostMeta {
  body: string;
}

function read(file: string): Post {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
  const { data, content } = matter(raw);
  return {
    slug: file.replace(/\.mdx$/, ''),
    title: String(data.title),
    summary: String(data.summary ?? ''),
    date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date),
    tags: (data.tags as string[] | undefined) ?? [],
    project: data.project as string | undefined,
    readingMinutes: Math.max(1, Math.round(content.split(/\s+/).length / 230)),
    body: content,
  };
}

export function getPosts(): PostMeta[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => {
      const { body: _body, ...meta } = read(f);
      return meta;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | undefined {
  const file = `${slug}.mdx`;
  if (!fs.existsSync(path.join(DIR, file))) return undefined;
  return read(file);
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
