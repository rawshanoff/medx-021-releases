import { History as HistoryIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import type { Doctor } from '../../types/doctors';
import type { Patient } from '../../types/patients';
import { PaymentCells } from './PaymentCells';

export function ResultRow({
  patient,
  doctors,
  addToQueue,
  onViewHistory,
  onRequestMixedPayment,
  onShiftError,
  requestFocus,
  onFocused,
}: {
  patient: Patient;
  doctors: Doctor[];
  addToQueue: (patientId: number, patientName: string, doctorId: number) => Promise<string>;
  onViewHistory: () => void;
  onRequestMixedPayment: (
    total: number,
    onConfirm: (c: number, cd: number, t: number) => void,
  ) => void;
  onShiftError: () => void;
  requestFocus?: boolean;
  onFocused?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <tr className={cn('h-12 border-t border-border', requestFocus ? 'bg-primary/5' : '')}>
      <td className="px-3 py-3 align-top">
        <div className="text-[15px] font-medium leading-[20px]">{patient.full_name}</div>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onViewHistory}
          className="mt-1 h-[28px] justify-start gap-1 px-2 text-[13px] text-primary/90 hover:bg-primary/10 hover:text-primary"
        >
          <HistoryIcon size={14} />
          {t('reception.history')}
        </Button>
      </td>

      <td className="px-3 py-3 align-top text-muted-foreground">{patient.birth_date || '—'}</td>
      <td className="px-3 py-3 align-top">{patient.phone}</td>

      <PaymentCells
        patient={patient}
        doctors={doctors}
        addToQueue={addToQueue}
        onRequestMixedPayment={onRequestMixedPayment}
        onShiftError={onShiftError}
        requestFocus={requestFocus}
        onFocused={onFocused}
      />
    </tr>
  );
}
