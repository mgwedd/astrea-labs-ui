import { cn } from '@astrea/ui';

/**
 * Renders a stored forum body. The HTML was sanitized on the server (lib/forum/content.ts) before it
 * was saved, so it is safe to inject. Styled with descendant selectors and semantic tokens only.
 */
export const BODY_CLASSES = cn(
        'break-words text-sm leading-relaxed text-foreground',
        '[&_p]:mb-3 [&_p:last-child]:mb-0 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mb-2 [&_h4]:mt-3 [&_h4]:font-semibold',
        '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1',
        '[&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
        '[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_hr]:my-4 [&_hr]:border-border',
        '[&_.mention]:rounded [&_.mention]:bg-accent [&_.mention]:px-1 [&_.mention]:font-medium [&_.mention]:text-accent-foreground',
);

export function ForumBody({ html, className }: { html: string; className?: string }) {
  return <div className={cn(BODY_CLASSES, className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
