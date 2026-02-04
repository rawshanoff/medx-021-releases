import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './ui/modal';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface MixedPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirm: (cash: number, card: number, transfer: number) => void | Promise<void>;
  initialSplit?: { cash?: number; card?: number; transfer?: number };
  readOnly?: boolean;
  title?: string;
  confirmLabel?: string;
  description?: string;
}

export default function MixedPaymentModal({
  isOpen,
  onClose,
  totalAmount,
  onConfirm,
  initialSplit,
  readOnly = false,
  title,
  confirmLabel,
  description,
}: MixedPaymentModalProps) {
  const { t } = useTranslation();
  const [cash, setCash] = useState(0);
  const [card, setCard] = useState(0);
  const [transfer, setTransfer] = useState(0);
  const cashRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLInputElement | null>(null);
  const transferRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  const currentTotal = cash + card + transfer;
  const remaining = totalAmount - currentTotal;
  const isValid = currentTotal === totalAmount;
  const statusVariant = useMemo<'success' | 'warning' | 'error'>(() => {
    if (remaining === 0) return 'success';
    if (remaining > 0) return 'warning';
    return 'error';
  }, [remaining]);

  const resetAmounts = () => {
    setCash(0);
    setCard(0);
    setTransfer(0);
  };

  const handleClose = () => {
    // Reset on close so the next open starts from zero without using effects.
    resetAmounts();
    onClose();
  };

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(cash, card, transfer);
      handleClose();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialSplit) {
      setCash(Number(initialSplit.cash || 0));
      setCard(Number(initialSplit.card || 0));
      setTransfer(Number(initialSplit.transfer || 0));
    } else {
      resetAmounts();
    }
    // Focus first field when modal opens
    setTimeout(() => {
      if (readOnly) {
        confirmRef.current?.focus();
      } else {
        cashRef.current?.focus();
      }
    }, 0);
  }, [isOpen, initialSplit, readOnly]);

  const handleEnterNav = (
    e: React.KeyboardEvent,
    step: 'cash' | 'card' | 'transfer' | 'confirm',
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (step === 'cash') {
      cardRef.current?.focus();
      return;
    }
    if (step === 'card') {
      transferRef.current?.focus();
      return;
    }
    if (step === 'transfer') {
      if (isValid) {
        confirmRef.current?.focus();
      } else {
        confirmRef.current?.focus();
      }
      return;
    }
    if (step === 'confirm') {
      handleConfirm();
    }
  };

  const handleArrowNav = (
    e: React.KeyboardEvent,
    step: 'cash' | 'card' | 'transfer' | 'confirm',
  ) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    if (step === 'cash') {
      if (dir > 0) {
        cardRef.current?.focus();
      }
      return;
    }
    if (step === 'card') {
      if (dir > 0) {
        transferRef.current?.focus();
      } else {
        cashRef.current?.focus();
      }
      return;
    }
    if (step === 'transfer') {
      if (dir > 0) {
        confirmRef.current?.focus();
      } else {
        cardRef.current?.focus();
      }
      return;
    }
    if (step === 'confirm' && dir < 0) {
      transferRef.current?.focus();
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={title || t('reception.mixed_payment')}
      description={
        description ||
        t('reception.total_amount') + `: ${totalAmount.toLocaleString()} ${t('common.currency')}`
      }
      width={560}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-[13px] font-medium text-foreground">{t('reception.cash')}</label>
          <Input
            ref={cashRef}
            type="number"
            min={0}
            inputMode="numeric"
            value={cash || ''}
            onChange={(e) => setCash(Number(e.target.value) || 0)}
            placeholder="0"
            onKeyDown={(e) => {
              handleArrowNav(e, 'cash');
              handleEnterNav(e, 'cash');
            }}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[13px] font-medium text-foreground">{t('reception.card')}</label>
          <Input
            ref={cardRef}
            type="number"
            min={0}
            inputMode="numeric"
            value={card || ''}
            onChange={(e) => setCard(Number(e.target.value) || 0)}
            placeholder="0"
            onKeyDown={(e) => {
              handleArrowNav(e, 'card');
              handleEnterNav(e, 'card');
            }}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[13px] font-medium text-foreground">
            {t('reception.transfer')}
          </label>
          <Input
            ref={transferRef}
            type="number"
            min={0}
            inputMode="numeric"
            value={transfer || ''}
            onChange={(e) => setTransfer(Number(e.target.value) || 0)}
            placeholder="0"
            onKeyDown={(e) => {
              handleArrowNav(e, 'transfer');
              handleEnterNav(e, 'transfer');
            }}
            disabled={readOnly}
          />
        </div>
      </div>

      <div
        className={
          statusVariant === 'success'
            ? 'mt-3 rounded-md border border-border bg-emerald-500/15 px-3 py-2 text-[13px] font-medium text-emerald-700 dark:text-emerald-300'
            : statusVariant === 'warning'
              ? 'mt-3 rounded-md border border-border bg-amber-500/15 px-3 py-2 text-[13px] font-medium text-amber-800 dark:text-amber-300'
              : 'mt-3 rounded-md border border-border bg-red-500/15 px-3 py-2 text-[13px] font-medium text-red-700 dark:text-red-300'
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
        <Button variant="outline" onClick={handleClose}>
          {t('common.cancel')}
        </Button>
        <Button
          ref={confirmRef}
          onClick={handleConfirm}
          disabled={!isValid}
          onKeyDown={(e) => {
            handleArrowNav(e, 'confirm');
            handleEnterNav(e, 'confirm');
          }}
        >
          {confirmLabel || t('reception.pay', { defaultValue: 'Оплатить' })}
        </Button>
      </div>
    </Modal>
  );
}
