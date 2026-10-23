// Prefill from links like /feedback?project=aletheia&type=bug&environment=...
// (the app's "Report a Bug…" menu item). Unknown values are dropped.
import { FEEDBACK_PROJECTS } from './projects';
import { LIMITS, type FeedbackType } from './validation';

export type Prefill = { project?: string; type?: FeedbackType; environment?: string };
type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function prefillFrom(params: Params): Prefill {
  const out: Prefill = {};
  const project = first(params.project);
  if (project && FEEDBACK_PROJECTS.some((p) => p.slug === project)) out.project = project;
  const type = first(params.type);
  if (type === 'bug' || type === 'feature') out.type = type;
  const env = first(params.environment)?.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, LIMITS.short);
  if (env) out.environment = env;
  return out;
}
