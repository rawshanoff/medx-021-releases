import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type SettingsNavKey = string;

export type SettingsNavItem = {
  key: SettingsNavKey;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export type SettingsNavGroup = {
  label: string;
  items: SettingsNavItem[];
};

export function SettingsSidebar({
  groups,
  activeKey,
  onSelect,
  className,
}: {
  groups: SettingsNavGroup[];
  activeKey: SettingsNavKey;
  onSelect: (key: SettingsNavKey) => void;
  className?: string;
}) {
  return (
    <nav className={cn('flex flex-col gap-5 p-4', className)} aria-label="Settings navigation">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-2">
          <div className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {g.label}
          </div>
          <div className="flex flex-col gap-1">
            {g.items.map((it) => {
              const active = it.key === activeKey;
              return (
                <button
                  key={it.key}
                  type="button"
                  disabled={it.disabled}
                  onClick={() => onSelect(it.key)}
                  className={cn(
                    'relative flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition',
                    'hover:bg-slate-100/70 dark:hover:bg-slate-900/40',
                    it.disabled ? 'cursor-not-allowed opacity-50' : '',
                    active ? 'bg-blue-50/80 dark:bg-blue-50/10' : '',
                  )}
                >
                  {active ? (
                    <span
                      className={cn(
                        'absolute left-1 top-1 bottom-1 w-1 rounded-full',
                        'bg-blue-600 dark:bg-blue-400',
                      )}
                      aria-hidden="true"
                    />
                  ) : null}
                  {it.icon ? (
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 items-center justify-center rounded-full',
                        active
                          ? 'bg-blue-600/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200',
                      )}
                    >
                      {it.icon}
                    </div>
                  ) : null}

                  <div className="min-w-0">
                    <div
                      className={cn(
                        'text-sm font-medium',
                        active ? 'text-blue-700 dark:text-blue-200' : 'text-foreground',
                      )}
                    >
                      {it.label}
                    </div>
                    {it.description ? (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {it.description}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
