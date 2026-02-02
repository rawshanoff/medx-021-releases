import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { Banknote, CreditCard, FileText, Lock, TrendingDown, Unlock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { getUser } from '../utils/auth';
import { Modal } from '../components/ui/modal';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/cn';

export default function Finance() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [shift, setShift] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH, CARD, MIXED
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  // For Mixed Payment (Expense doesn't usually use mixed but keep logic just in case or simplify)
  // Expense is usually pure Cash or pure Card from company account.

  useEffect(() => {
    checkActiveShift();
  }, []);

  const checkActiveShift = async () => {
    try {
      const res = await client.get('/finance/shifts/active');
      // Backend now returns null (200 OK) if no shift, instead of 404
      setShift(res.data);
    } catch (e) {
      console.error('Failed to check active shift', e);
      setShift(null);
    }
  };

  const handleOpenShift = async () => {
    setLoading(true);
    try {
      const cashier = getUser()?.username || 'Admin';
      const res = await client.post('/finance/shifts/open', { cashier_id: cashier });
      setShift(res.data);
    } catch (e) {
      showToast(t('finance.shift_open_fail') || 'Не удалось открыть смену', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!confirm(t('common.confirm'))) return;
    setLoading(true);
    try {
      await client.post('/finance/shifts/close');
      setShift(null);
      showToast(t('finance.shift_closed') || 'Смена закрыта', 'success');
    } catch (e) {
      showToast(t('finance.shift_close_fail') || 'Не удалось закрыть смену', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExpense = async () => {
    if (!shift) {
      showToast(t('finance.open_shift_prompt') || 'Сначала откройте смену', 'warning');
      return;
    }
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast(t('finance.enter_amount') || 'Введите сумму', 'warning');
      return;
    }
    if (!description.trim()) {
      showToast(t('finance.expense_desc') || 'Введите описание расхода', 'warning');
      return;
    }
    setTxLoading(true);
    try {
      const payload: any = {
        // Negative amount for expense ideally, but backend might expect positive transactions.
        // Since user asked "This field is for expenses only", I assume we are logging OUTFLOW.
        // I will send it as positive amount but described as Expense.
        // Or maybe I should modify backend to support 'type': 'EXPENSE'.
        // For MVP, I will just prefix description with [EXPENSE] and negative amount if backend allows or just handle presentation.
        patient_id: null, // System expense
        amount: -Math.abs(Math.trunc(parsed)), // Make it negative
        payment_method: paymentMethod,
        description: `[EXPENSE] ${description}`,
        doctor_id: null,
      };

      await client.post('/finance/transactions', payload);
      showToast(t('finance.payment_success'), 'success');
      setAmount('');
      setDescription('');
      setExpenseOpen(false);
    } catch (e) {
      showToast(t('finance.payment_fail'), 'error');
    } finally {
      setTxLoading(false);
    }
  };

  const shiftTotals = useMemo(() => {
    const cash = Number(shift?.total_cash || 0);
    const card = Number(shift?.total_card || 0);
    const transfer = Number(shift?.total_transfer || 0);
    return { cash, card, transfer, total: cash + card + transfer };
  }, [shift]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-medium">{t('finance.title')}</h1>
        {!shift ? (
          <Button
            size="sm"
            className="h-8 text-xs"
            type="button"
            onClick={handleOpenShift}
            disabled={loading}
          >
            <Unlock size={14} /> {t('finance.open_shift')}
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-primary">
              {t('finance.shift_open', { id: shift.id })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-xs"
              type="button"
              onClick={handleCloseShift}
              disabled={loading}
            >
              <Lock size={14} /> {t('finance.close_shift')}
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto">
        {/* Cash Flow */}
        <div className="rounded-md border border-border bg-card p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-medium">
              {t('finance.cash_flow', { defaultValue: 'Касса / Cash Flow' })}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-xs"
              type="button"
              onClick={checkActiveShift}
              disabled={loading}
            >
              {t('common.refresh', { defaultValue: 'Обновить' })}
            </Button>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('finance.cash'), value: shiftTotals.cash },
              { label: t('finance.card'), value: shiftTotals.card },
              { label: t('reception.transfer'), value: shiftTotals.transfer },
              { label: t('reports.total', { defaultValue: 'Итого' }), value: shiftTotals.total },
            ].map((x) => (
              <div key={x.label} className="rounded-md border border-border bg-background p-2">
                <div className="text-[12px] text-muted-foreground dark:text-gray-300">
                  {x.label}
                </div>
                <div className="mt-0.5 text-[14px] font-medium">
                  {Number(x.value || 0).toLocaleString()} {t('common.currency')}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 text-[12px] text-muted-foreground dark:text-gray-300">
            {t('finance.shift_hint', {
              defaultValue:
                'Это сводка по текущей открытой смене. Дневной Cash Flow будет в PRO‑отчётах.',
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <button
            type="button"
            className="rounded-md border border-border bg-card p-2 text-left transition hover:bg-accent/40"
            onClick={() => setExpenseOpen(true)}
          >
            <div className="flex gap-2">
              <div className="rounded-md bg-destructive/10 p-2 text-destructive">
                <TrendingDown size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium">
                  {t('finance.new_transaction', { defaultValue: 'Новый расход' })}
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground dark:text-gray-300">
                  {t('finance.expense_desc', { defaultValue: 'Описание расхода' })}
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="rounded-md border border-border bg-card p-2 text-left transition hover:bg-accent/40"
            onClick={() => navigate('/reports')}
          >
            <div className="flex gap-2">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <FileText size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{t('nav.reports')}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground dark:text-gray-300">
                  {t('finance.reports_desc', { defaultValue: 'X/Z отчёты + PRO отчёты' })}
                </div>
              </div>
            </div>
          </button>

          <div className="rounded-md border border-border bg-card p-2 opacity-60">
            <div className="flex gap-2">
              <div className="rounded-md bg-primary/10 p-2 text-muted-foreground dark:text-gray-300">
                <Lock size={14} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium">
                  {t('finance.day_cash', { defaultValue: 'Касса за день' })}
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground dark:text-gray-300">
                  {t('finance.day_cash_desc', { defaultValue: 'Доступно в PRO отчётах' })}
                </div>
                <Button
                  className="mt-2 h-8 text-xs"
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled
                >
                  <Lock size={14} /> PRO
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={expenseOpen}
        title={t('finance.new_transaction', { defaultValue: 'Новый расход' })}
        description={t('finance.expense_modal_desc', {
          defaultValue:
            'Расход списывается как отрицательная транзакция. Требуется открытая смена.',
        })}
        onClose={() => setExpenseOpen(false)}
        width={860}
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] text-muted-foreground dark:text-gray-300">
              {t('finance.total_amount', { defaultValue: 'Сумма' })}
            </label>
            <Input
              className="h-8 text-xs dark:border-gray-600"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] text-muted-foreground dark:text-gray-300">
              {t('finance.payment_method', { defaultValue: 'Тип оплаты' })}
            </label>
            <div className="flex gap-2">
              {(['CASH', 'CARD'] as const).map((method) => (
                <Button
                  key={method}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 flex-1 justify-center gap-2 text-xs',
                    paymentMethod === method
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : '',
                  )}
                  onClick={() => setPaymentMethod(method)}
                >
                  {method === 'CASH' ? <Banknote size={14} /> : <CreditCard size={14} />}
                  {t(`finance.${method.toLowerCase()}`, { defaultValue: method })}
                </Button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[12px] text-muted-foreground dark:text-gray-300">
              {t('finance.expense_desc', { defaultValue: 'Описание расхода' })}
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('finance.expense_placeholder', {
                defaultValue: 'Например: канцтовары, такси…',
              })}
              className="h-8 text-xs dark:border-gray-600"
            />
          </div>
        </div>

        {!shift ? (
          <div className="mt-2 text-[12px] text-muted-foreground dark:text-gray-300">
            {t('finance.open_shift_prompt', { defaultValue: 'Сначала откройте смену' })}
          </div>
        ) : null}

        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            type="button"
            onClick={() => setExpenseOpen(false)}
          >
            {t('common.cancel', { defaultValue: 'Отмена' })}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            type="button"
            onClick={handleExpense}
            disabled={txLoading || !shift}
          >
            {txLoading
              ? t('finance.processing', { defaultValue: 'Обработка…' })
              : t('finance.charge_btn', { defaultValue: 'Списать' })}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
