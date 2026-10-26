import type { ReactNode } from 'react';

export type DetailRow = [label: string, value: ReactNode];

/** A two-column label/value list for admin detail pages. Stacks on narrow screens. */
export function Details({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
      {rows.map(([label, value], i) => (
        <div key={i} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-wrap break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
