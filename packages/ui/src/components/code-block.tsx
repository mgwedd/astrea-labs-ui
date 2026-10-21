'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { Copy, Check } from 'lucide-react';
import { Button } from './button';

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language = 'typescript',
  filename,
  showLineNumbers = true,
  className,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const lines = code.trim().split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-border bg-secondary/40 font-mono text-xs overflow-hidden shadow-sm',
        className
      )}
      {...props}
    >
      {(filename || language) && (
        <div className="flex items-center justify-between border-b border-border/60 bg-secondary/60 px-4 py-2 text-muted-foreground">
          <div className="flex items-center space-x-2">
            {filename ? (
              <span className="font-semibold text-foreground">{filename}</span>
            ) : (
              <span className="uppercase text-[10px] tracking-wider">{language}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            aria-label="Copy code to clipboard"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}

      <div className="relative overflow-x-auto p-4">
        <pre className="flex leading-relaxed">
          {showLineNumbers && (
            <div className="select-none pr-4 text-right text-muted-foreground/40 font-mono border-r border-border/40 mr-4">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}
          <code className="text-foreground flex-1 font-mono">{code}</code>
        </pre>
      </div>
    </div>
  );
}
