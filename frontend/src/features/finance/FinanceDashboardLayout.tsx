import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

export function SummaryCard({
  icon,
  label,
  value,
  currencyLabel,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  currencyLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white p-4',
        'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]',
        'dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {value}
          </div>
          {currencyLabel ? (
            <div className="mt-1 text-xs text-muted-foreground">{currencyLabel}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function FinanceDashboardLayout({
  shiftTitle,
  shiftSubtitle,
  shiftOpen,
  onOpenShift,
  onCloseShift,
  openShiftDisabled,
  closeShiftDisabled,
  kpis,
  transactionsTitle,
  transactionsTable,
  topRight,
}: {
  shiftTitle: string;
  shiftSubtitle?: string;
  shiftOpen: boolean;
  onOpenShift: () => void;
  onCloseShift: () => void;
  openShiftDisabled?: boolean;
  closeShiftDisabled?: boolean;
  kpis: ReactNode;
  transactionsTitle: string;
  transactionsTable: ReactNode;
  topRight?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Shift status bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                shiftOpen ? 'bg-emerald-500' : 'bg-slate-400',
              )}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                {shiftTitle}
              </div>
              {shiftSubtitle ? (
                <div className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                  {shiftSubtitle}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {topRight}
            {shiftOpen ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={closeShiftDisabled}
                className="h-10 px-4 text-[13px] hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                onClick={onCloseShift}
              >
                {t('finance.close_shift', { defaultValue: 'Закрыть смену' })}
              </Button>
            ) : (
              <Button
                size="sm"
                type="button"
                disabled={openShiftDisabled}
                className="h-10 px-4 text-[13px]"
                onClick={onOpenShift}
              >
                {t('finance.open_shift', { defaultValue: 'Открыть смену' })}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{kpis}</div>

      {/* Transactions */}
      <div className="min-h-0 flex-1 rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/60">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {transactionsTitle}
          </div>
          <Badge variant="secondary" className="h-6 rounded-md px-2 text-[11px]">
            {t('finance.shift_badge', { defaultValue: 'Смена' })}
          </Badge>
        </div>
        <div className="min-h-0 max-h-[360px] overflow-auto p-4">{transactionsTable}</div>
      </div>
    </div>
  );
}
