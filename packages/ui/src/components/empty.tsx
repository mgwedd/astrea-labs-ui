import * as React from "react"
import { cn } from "../lib/utils"

export function Empty({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center animate-in fade-in-50",
        className
      )}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/80 border border-border text-muted-foreground mb-4">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="font-mono text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
