export type Domain = 'ai' | 'autonomy' | 'software' | 'security';

export type ProjectStatus = 'beta' | 'active' | 'shipped' | 'research' | 'archived';

export type Platform = 'macos' | 'windows' | 'linux' | 'ios' | 'web';

export interface GitHubRepo {
  owner: string;
  name: string;
  /** Private repos are listed but never linked. */
  private?: boolean;
}

export interface ProjectLinks {
  site?: string;
  docs?: string;
  paper?: string;
  changelog?: string;
}

export interface Download {
  platform: Platform;
  label: string;
  /** Stable URL, e.g. `.../releases/latest`. */
  url: string;
  note?: string;
}

export interface MediaItem {
  /** Image, GIF, video file (`/media/...` or storage URL) or a YouTube/Vimeo link. */
  src: string;
  alt: string;
  caption?: string;
  /** Poster frame for self-hosted video. */
  poster?: string;
  /** Self-hosted video only: muted, looping, GIF-style. */
  loop?: boolean;
}

export interface Project {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  /** Long-form paragraphs for the project page. */
  description: string[];
  /** Primary domain first. */
  domains: Domain[];
  status: ProjectStatus;
  /** Year the project started. */
  year: number;
  stack: string[];
  highlights: string[];
  repo?: GitHubRepo;
  /** Hosted at `<subdomain>.astrealabs.com`. */
  subdomain?: string;
  links: ProjectLinks;
  /** Repo whose GitHub releases feed the downloads page. */
  releases?: GitHubRepo;
  downloads?: Download[];
  /** Short note on Astrea's role, for collaborations. */
  role?: string;
  /** Source-available / proprietary / OSI licence, shown verbatim. */
  license?: string;
  platforms?: Platform[];
  /** Screenshots, demo clips and videos, shown on the project page. First item leads. */
  media?: MediaItem[];
  featured: boolean;
  order: number;
}

export interface DomainInfo {
  id: Domain;
  label: string;
  description: string;
}

export interface Publication {
  slug: string;
  projectSlug?: string;
  title: string;
  date: string;
  venue: string;
  authors: string[];
  abstract: string;
  pdfUrl?: string;
  arxivId?: string;
  bibtex?: string;
}

export interface TechnicalNote {
  title: string;
  projectSlug: string;
  url: string;
  summary: string;
}

export interface Contribution {
  project: string;
  title: string;
  url: string;
  state: 'merged' | 'open';
  date?: string;
}
