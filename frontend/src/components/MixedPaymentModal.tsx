import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './ui/modal';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface MixedPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirm: (cash: number, card: number, transfer: number) => void;
}

export default function MixedPaymentModal({
  isOpen,
  onClose,
  totalAmount,
  onConfirm,
}: MixedPaymentModalProps) {
  const { t } = useTranslation();
  const [cash, setCash] = useState(0);
  const [card, setCard] = useState(0);
  const [transfer, setTransfer] = useState(0);

  const currentTotal = cash + card + transfer;
  const remaining = totalAmount - currentTotal;
  const isValid = currentTotal === totalAmount;
  const statusVariant = useMemo<'success' | 'warning' | 'error'>(() => {
    if (remaining === 0) return 'success';
    if (remaining > 0) return 'warning';
    return 'error';
  }, [remaining]);

  useEffect(() => {
    // Reset when modal opens
    if (isOpen) {
      setCash(0);
      setCard(0);
      setTransfer(0);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(cash, card, transfer);
      onClose();
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t('reception.mixed_payment')}
      description={
        t('reception.total_amount') + `: ${totalAmount.toLocaleString()} ${t('common.currency')}`
      }
      width={560}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-foreground">{t('reception.cash')}</label>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={cash || ''}
            onChange={(e) => setCash(Number(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-foreground">{t('reception.card')}</label>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={card || ''}
            onChange={(e) => setCard(Number(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-foreground">
            {t('reception.transfer')}
          </label>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={transfer || ''}
            onChange={(e) => setTransfer(Number(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
      </div>

      <div
        className={
          statusVariant === 'success'
            ? 'mt-3 rounded-md border border-border bg-[hsl(var(--success-bg))] px-3 py-2 text-[13px] font-medium text-[hsl(var(--success))]'
            : statusVariant === 'warning'
              ? 'mt-3 rounded-md border border-border bg-[hsl(var(--warning-bg))] px-3 py-2 text-[13px] font-medium text-[hsl(var(--warning))]'
              : 'mt-3 rounded-md border border-border bg-[hsl(var(--destructive-bg))] px-3 py-2 text-[13px] font-medium text-destructive'
        }
      >
        {remaining > 0
          ? `${t('reception.remaining')}: ${remaining.toLocaleString()} ${t('common.currency')}`
          : null}
        {remaining < 0
          ? `${t('reception.excess')}: ${Math.abs(remaining).toLocaleString()} ${t('common.currency')}`
          : null}
        {remaining === 0 ? t('reception.payment_complete') : null}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleConfirm} disabled={!isValid}>
          {t('reception.pay', { defaultValue: 'Оплатить' })}
        </Button>
      </div>
    </Modal>
  );
}
