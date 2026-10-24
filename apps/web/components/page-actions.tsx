'use client';

import { Check, ChevronDown, Copy, FileText, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from '@astrea/ui';
import { markdownPath, markdownUrl } from '@/lib/markdown-route';

/** Writes text that is still loading. Safari only allows async clipboard writes through a ClipboardItem promise. */
async function copyLater(text: Promise<string>) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
    const blob = text.then((t) => new Blob([t], { type: 'text/plain' }));
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
  } else {
    await navigator.clipboard.writeText(await text);
  }
}

/** "Copy page" plus a menu to view the markdown or hand the page to a chat assistant. */
export function PageActions({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const mdPath = markdownPath(path);
  const ask = encodeURIComponent(`Read ${markdownUrl(path)} so I can ask you questions about it.`);

  const copy = async () => {
    try {
      await copyLater(
        fetch(mdPath).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.text();
        }),
      );
      setCopied(true);
      toast.success('Page copied as markdown');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Couldn’t copy the page');
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={copy}>
        {copied ? <Check /> : <Copy />} Copy page
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="size-8" aria-label="More page actions">
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <a href={mdPath} target="_blank" rel="noreferrer">
                <FileText /> View as markdown
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`https://chatgpt.com/?q=${ask}`} target="_blank" rel="noreferrer">
                <MessageSquare /> Open in ChatGPT
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`https://claude.ai/new?q=${ask}`} target="_blank" rel="noreferrer">
                <MessageSquare /> Open in Claude
              </a>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
