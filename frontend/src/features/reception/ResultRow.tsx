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
    onConfirm: (c: number, cd: number, t: number) => void | Promise<void>,
    onCancel: () => void,
  ) => void;
  onShiftError: () => void;
  requestFocus?: boolean;
  onFocused?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <tr
      className={cn(
        'bg-transparent transition-colors hover:bg-muted/40 focus-within:bg-blue-50/40',
        'focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:ring-inset',
        requestFocus ? 'bg-muted/50' : '',
      )}
    >
      <td className="px-3 py-2.5 align-top">
        <div className="font-medium leading-[18px]">{patient.full_name}</div>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onViewHistory}
          className="mt-1 h-7 justify-start gap-1 px-2 text-xs text-primary/90 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          <HistoryIcon size={14} />
          {t('reception.history')}
        </Button>
      </td>

      <td className="px-3 py-2.5 align-top text-muted-foreground">{patient.birth_date || '—'}</td>
      <td className="px-3 py-2.5 align-top">{patient.phone}</td>

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
