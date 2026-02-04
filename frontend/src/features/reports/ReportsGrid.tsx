import type { ReactNode } from 'react';
import { Lock, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { Button } from '../../components/ui/button';

function StatusBadge({
  tone,
  children,
}: {
  tone: 'muted' | 'success' | 'warning';
  children: ReactNode;
}) {
  const cls =
    tone === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
      : tone === 'warning'
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200'
        : 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-200';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        cls,
      )}
    >
      {children}
    </span>
  );
}

export type ActionReportCard = {
  key: string;
  title: string;
  description: string;
  status: { tone: 'muted' | 'success' | 'warning'; label: string };
  footerValue?: string;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
};

export type ProCard = {
  key: string;
  title: string;
  description: string;
};

export function ReportsGrid({
  basicTitle,
  basicSubtitle,
  cards,
  proTitle,
  proSubtitle,
  proCards,
  proLocked,
  onUpgradeClick,
}: {
  basicTitle: string;
  basicSubtitle?: string;
  cards: ActionReportCard[];
  proTitle: string;
  proSubtitle?: string;
  proCards: ProCard[];
  proLocked: boolean;
  onUpgradeClick?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-muted-foreground" />
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {basicTitle}
              </div>
            </div>
            {basicSubtitle ? (
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{basicSubtitle}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.key}
              className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-700/60 dark:bg-slate-900/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {c.title}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {c.description}
                  </div>
                </div>
                <StatusBadge tone={c.status.tone}>{c.status.label}</StatusBadge>
              </div>

              {c.footerValue ? (
                <div className="mt-4 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                  {c.footerValue}
                </div>
              ) : (
                <div className="mt-4" />
              )}

              <div className="mt-auto pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  className="h-10 w-full px-3 text-[13px]"
                  disabled={c.actionDisabled}
                  onClick={c.onAction}
                >
                  {c.actionLabel}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PRO */}
      <div
        className={cn(
          'rounded-2xl border bg-white p-4 dark:bg-slate-800',
          'border-slate-200/80 dark:border-slate-700/60',
          // subtle gradient border
          'relative',
        )}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-transparent [background:linear-gradient(90deg,rgba(59,130,246,0.25),rgba(99,102,241,0.18),rgba(236,72,153,0.18))_border-box] [mask:linear-gradient(#000_0_0)_padding-box,linear-gradient(#000_0_0)] [mask-composite:exclude]" />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-muted-foreground" />
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {proTitle}
              </div>
            </div>
            {proSubtitle ? (
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{proSubtitle}</div>
            ) : null}
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {proCards.map((x) => (
            <div
              key={x.key}
              className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-700/60 dark:bg-slate-900/30"
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {x.title}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{x.description}</div>
            </div>
          ))}

          {proLocked ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm dark:bg-slate-900/55">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Lock size={18} />
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {t('reports.pro_label', { defaultValue: 'PRO' })}
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('reports.upgrade_to_view', { defaultValue: 'Обновите доступ, чтобы увидеть' })}
                </div>
                {onUpgradeClick ? (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      type="button"
                      className="h-10 px-4 text-[13px]"
                      onClick={onUpgradeClick}
                    >
                      {t('reports.upgrade', { defaultValue: 'Обновить' })}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
