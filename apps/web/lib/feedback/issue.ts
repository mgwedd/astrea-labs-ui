import type { FeedbackContent } from './validation';

const ZWJ = '‍';

/**
 * Makes user text safe to post under our account: @mentions and team mentions
 * no longer ping (zero-width joiner after "@"), #123 no longer cross-links,
 * and raw HTML is escaped.
 */
export function neutralise(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/@/g, `@${ZWJ}`)
    .replace(/#(?=\d)/g, `#${ZWJ}`)
    .replace(/\r\n?/g, '\n');
}

const section = (heading: string, body: string) => `### ${heading}\n\n${neutralise(body)}\n`;

export function issueTitle(content: FeedbackContent): string {
  return neutralise(content.title).replace(/\s+/g, ' ').trim();
}

/** The issue body. Takes FeedbackContent (no email) so the address cannot leak in. */
export function issueBody(content: FeedbackContent): string {
  const parts =
    content.type === 'bug'
      ? [
          section('What happened', content.happened),
          section('Steps to reproduce', content.steps),
          section('What I expected', content.expected),
          content.environment ? section('Version / OS', content.environment) : '',
        ]
      : [
          section('The problem', content.problem),
          section('Proposed solution', content.solution),
          content.alternatives ? section('Alternatives considered', content.alternatives) : '',
        ];
  return `${parts.filter(Boolean).join('\n')}\n---\nSubmitted via astrealabs.com/feedback\n`;
}

export const issueLabels = (content: FeedbackContent) => [content.type === 'bug' ? 'bug' : 'enhancement', 'from-website'];
