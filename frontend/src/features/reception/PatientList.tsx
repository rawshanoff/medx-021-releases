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
    onConfirm: (c: number, cd: number, t: number) => void,
  ) => void;
  onShiftError: () => void;
  focusPatientId: number | null;
  clearFocus: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-card">
      <div className="h-full overflow-auto">
        <table className="w-full text-[14px]">
          <thead className="sticky top-0 z-10 bg-secondary text-[13px] text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-medium">
              <th>{t('nav.patients')}</th>
              <th>{t('reception.dob')}</th>
              <th>{t('reception.phone')}</th>
              <th>{t('nav.doctors')}</th>
              <th>{t('reception.payment')}</th>
              <th className="text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr]:border-border">
            {loading ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="[&>td]:px-3 [&>td]:py-3">
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
