import type { ReactNode } from 'react';

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}
