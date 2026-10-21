'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { ChevronDown, CheckCircle2, CircleDashed, AlertCircle, Clock } from 'lucide-react';

export type TraceStatus = 'completed' | 'running' | 'pending' | 'error';

export interface TraceItemProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  timestamp?: string;
  status?: TraceStatus;
  defaultExpanded?: boolean;
}

export function Trace({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('relative space-y-3 font-mono text-xs', className)}
      {...props}
    >
      <div className="absolute left-[13px] top-3 bottom-3 w-px bg-border/60" />
      {children}
    </div>
  );
}

export function TraceItem({
  title,
  subtitle,
  timestamp,
  status = 'completed',
  defaultExpanded = false,
  className,
  children,
  ...props
}: TraceItemProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <CircleDashed className="h-4 w-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-muted-foreground/60" />;
    }
  };

  return (
    <div className={cn('relative pl-7', className)} {...props}>
      {/* Node Dot / Status Icon */}
      <div className="absolute left-0 top-0.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background border border-border">
        {getStatusIcon()}
      </div>

      <div
        className={cn(
          'rounded-md border border-border bg-card/60 p-3 transition-colors',
          expanded && 'bg-card'
        )}
      >
        <div
          className={cn(
            'flex cursor-pointer items-center justify-between select-none',
            children ? 'hover:opacity-80' : ''
          )}
          onClick={() => children && setExpanded(!expanded)}
        >
          <div className="flex flex-col space-y-0.5">
            <span className="font-semibold text-foreground">{title}</span>
            {subtitle && (
              <span className="text-[11px] text-muted-foreground">
                {subtitle}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {timestamp && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {timestamp}
              </span>
            )}
            {children && (
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                  expanded && 'rotate-180'
                )}
              />
            )}
          </div>
        </div>

        {expanded && children && (
          <div className="mt-3 pt-3 border-t border-border/60 text-muted-foreground text-xs">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
