import type { KeyboardEvent } from 'react';
import { Skeleton } from '../../components/ui/skeleton';
import type { Doctor } from '../../types/doctors';
import type { Patient } from '../../types/patients';
import { useTranslation } from 'react-i18next';
import { ResultRow } from './ResultRow';

export function PatientList({
  patients,
  loading,
  hasSearch,
  doctors,
  addToQueue,
  onViewHistory,
  onRequestMixedPayment,
  onShiftError,
  focusPatientId,
  clearFocus,
}: {
  patients: Patient[];
  loading: boolean;
  hasSearch: boolean;
  doctors: Doctor[];
  addToQueue: (patientId: number, patientName: string, doctorId: number) => Promise<string>;
  onViewHistory: (patient: Patient) => void | Promise<void>;
  onRequestMixedPayment: (
    total: number,
    onConfirm: (c: number, cd: number, t: number) => void | Promise<void>,
    onCancel: () => void,
  ) => void;
  onShiftError: () => void;
  focusPatientId: number | null;
  clearFocus: () => void;
}) {
  const { t } = useTranslation();

  const handleArrowTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    const container = e.currentTarget;
    const active = document.activeElement as HTMLElement | null;
    if (!active || !container.contains(active)) return;

    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => {
      if (el.hasAttribute('disabled')) return false;
      if (el.getAttribute('aria-disabled') === 'true') return false;
      if (el.tabIndex < 0) return false;
      return true;
    });

    const idx = focusable.indexOf(active);
    if (idx < 0) return;
    const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
    const next = focusable[nextIdx];
    if (!next) return;
    e.preventDefault();
    next.focus();
  };

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-slate-200 bg-card dark:border-slate-800">
      <div className="h-full overflow-auto" onKeyDown={handleArrowTab}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-background/80 text-xs text-muted-foreground backdrop-blur-sm dark:border-slate-800">
            <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-wide">
              <th>{t('nav.patients')}</th>
              <th>{t('reception.dob')}</th>
              <th>{t('reception.phone')}</th>
              <th>{t('nav.doctors')}</th>
              <th>{t('reception.payment')}</th>
              <th className="text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {loading ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="[&>td]:px-3 [&>td]:py-2.5">
                    <td colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))}
              </>
            ) : null}

            {!loading && patients.length === 0 && hasSearch ? (
              <tr>
                <td colSpan={6} className="p-5 text-center text-muted-foreground">
                  {t('reception.no_results')}
                </td>
              </tr>
            ) : null}

            {!loading && patients.length === 0 && !hasSearch ? (
              <tr>
                <td colSpan={6} className="p-5 text-center text-muted-foreground">
                  {t('reception.search_placeholder')}
                </td>
              </tr>
            ) : null}

            {patients.map((p) => (
              <ResultRow
                key={p.id}
                patient={p}
                doctors={doctors}
                addToQueue={addToQueue}
                onViewHistory={() => onViewHistory(p)}
                onRequestMixedPayment={onRequestMixedPayment}
                onShiftError={onShiftError}
                requestFocus={focusPatientId === p.id}
                onFocused={clearFocus}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
