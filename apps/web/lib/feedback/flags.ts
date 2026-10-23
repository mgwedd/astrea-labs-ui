/**
 * Images and links are not accepted. We never strip them: a submission that
 * contains one is stored as-is and flagged so it is seen at triage.
 */
const URL_RE = /\b(?:https?:\/\/|ftp:\/\/|www\.)\S+/i;
const IMAGE_RE = /!\[/;

export function findFlags(values: string[]): string[] {
  const reasons: string[] = [];
  if (values.some((v) => IMAGE_RE.test(v))) reasons.push('markdown image syntax');
  if (values.some((v) => URL_RE.test(v))) reasons.push('contains a URL');
  return reasons;
}

/** For the client: show the "no images" note while any text field contains one. */
export const hasLinkOrImage = (values: string[]) => findFlags(values).length > 0;
