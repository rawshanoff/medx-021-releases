import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import {
  Banknote,
  CreditCard,
  ArrowLeftRight,
  FileText,
  Lock,
  TrendingDown,
  RefreshCw,
  Receipt,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { getUser } from '../utils/auth';
import { Modal } from '../components/ui/modal';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/cn';
import { loggers } from '../utils/logger';
import { FinanceDashboardLayout, SummaryCard } from '../features/finance/FinanceDashboardLayout';

export default function Finance() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [shift, setShift] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH, CARD, TRANSFER, MIXED
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [cashCounted, setCashCounted] = useState('');

  // For Mixed Payment (Expense doesn't usually use mixed but keep logic just in case or simplify)
  // Expense is usually pure Cash or pure Card from company account.

  useEffect(() => {
    checkActiveShift();
  }, []);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!shift) return;

    const interval = setInterval(() => {
      checkActiveShift();
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [shift]);

  const checkActiveShift = async () => {
    try {
      const res = await client.get('/finance/shifts/active');
      // Backend now returns null (200 OK) if no shift, instead of 404
      setShift(res.data);
      if (res.data) {
        await fetchRecentTransactions();
      }
    } catch (e) {
      loggers.finance.error('Failed to check active shift', e);
      setShift(null);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const res = await client.get('/finance/recent-transactions?limit=20');
      setRecentTransactions(res.data || []);
    } catch (e) {
      showToast(
        t('finance.failed_load_transactions', { defaultValue: 'Не удалось загрузить транзакции' }),
        'error',
      );
      loggers.finance.error('Failed to fetch recent transactions', e);
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

  const handleCloseShift = () => {
    setCashCounted('');
    setCloseShiftOpen(true);
  };

  const confirmCloseShift = async () => {
    setLoading(true);
    try {
      await client.post('/finance/shifts/close');
      setShift(null);
      setRecentTransactions([]);
      showToast(t('finance.shift_closed') || 'Смена закрыта', 'success');
      setCloseShiftOpen(false);
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
        patient_id: null, // System expense
        amount: -Math.abs(Math.trunc(parsed)), // Make it negative
        payment_method: paymentMethod,
        description: `[EXPENSE] ${description}`,
        doctor_id: null,
        idempotency_key:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
      };

      await client.post('/finance/transactions', payload);
      showToast(t('finance.payment_success'), 'success');
      setAmount('');
      setDescription('');
      setExpenseOpen(false);
      await fetchRecentTransactions(); // Refresh transaction list
      await fetchRecentTransactions(); // Refresh transaction list
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

  const formatMoney = (n: number) => Number(n || 0).toLocaleString();

  return (
    <div className="flex h-full flex-col gap-4">
      <FinanceDashboardLayout
        shiftOpen={Boolean(shift)}
        shiftTitle={
          shift
            ? t('finance.shift_open_title', {
                id: shift.id,
                defaultValue: `Смена #${shift.id} (Открыта)`,
              })
            : t('finance.shift_closed', { defaultValue: 'Смена закрыта' })
        }
        shiftSubtitle={shift?.start_time ? new Date(shift.start_time).toLocaleString() : undefined}
        onOpenShift={handleOpenShift}
        onCloseShift={handleCloseShift}
        openShiftDisabled={loading}
        closeShiftDisabled={loading}
        topRight={
          <>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={checkActiveShift}
              disabled={loading}
              className="h-10 w-10 rounded-md"
              title={t('common.refresh', { defaultValue: 'Обновить' })}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpenseOpen(true)}
              disabled={!shift}
              className="h-10 px-4 text-[13px]"
            >
              <TrendingDown size={16} />
              <span>{t('finance.new_transaction', { defaultValue: 'Новый расход' })}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/reports')}
              className="h-10 px-4 text-[13px]"
            >
              <FileText size={16} />
              <span>{t('nav.reports', { defaultValue: 'Отчёты' })}</span>
            </Button>
          </>
        }
        kpis={
          <>
            <SummaryCard
              icon={<Banknote size={18} />}
              label={t('finance.cash', { defaultValue: 'Наличные' })}
              value={formatMoney(shiftTotals.cash)}
              currencyLabel={t('common.currency', { defaultValue: "so'm" })}
            />
            <SummaryCard
              icon={<CreditCard size={18} />}
              label={t('finance.card', { defaultValue: 'Карта' })}
              value={formatMoney(shiftTotals.card)}
              currencyLabel={t('common.currency', { defaultValue: "so'm" })}
            />
            <SummaryCard
              icon={<FileText size={18} />}
              label={t('finance.transfer', { defaultValue: 'Перевод' })}
              value={formatMoney(shiftTotals.transfer)}
              currencyLabel={t('common.currency', { defaultValue: "so'm" })}
            />
            <SummaryCard
              icon={<Lock size={18} />}
              label={t('reports.total', { defaultValue: 'Итого' })}
              value={formatMoney(shiftTotals.total)}
              currencyLabel={t('common.currency', { defaultValue: "so'm" })}
              className="ring-1 ring-blue-500/10"
            />
          </>
        }
        transactionsTitle={t('finance.recent_transactions', { defaultValue: 'Транзакции' })}
        transactionsTable={
          recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/80 bg-slate-50 p-10 text-center dark:border-slate-700/60 dark:bg-slate-900/30">
              <Receipt size={42} className="mb-3 opacity-60" />
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {t('finance.no_transactions', { defaultValue: 'No transactions yet' })}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('finance.no_transactions_hint', {
                  defaultValue: 'Операции появятся после оплат.',
                })}
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-slate-900/30">
                  <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left">
                    <th className="w-[120px]">{t('finance.time', { defaultValue: 'Время' })}</th>
                    <th>{t('finance.patient', { defaultValue: 'Пациент' })}</th>
                    <th>{t('finance.service', { defaultValue: 'Услуга' })}</th>
                    <th className="w-[160px] text-right">
                      {t('finance.amount', { defaultValue: 'Сумма' })}
                    </th>
                    <th className="w-[120px] text-right">
                      {t('finance.method', { defaultValue: 'Метод' })}
                    </th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-t [&>tr]:border-slate-200/80 dark:[&>tr]:border-slate-800">
                  {recentTransactions.map((tx: any) => {
                    const method = String(tx.payment_method || '').toUpperCase();
                    const methodLabel =
                      method === 'CARD'
                        ? t('finance.method_card', { defaultValue: 'Карта' })
                        : method === 'TRANSFER'
                          ? t('finance.method_transfer', { defaultValue: 'Перевод' })
                          : method === 'MIXED'
                            ? t('finance.method_mixed', { defaultValue: 'Смешанная' })
                            : t('finance.method_cash', { defaultValue: 'Наличные' });
                    const badgeTone =
                      method === 'CARD'
                        ? 'bg-blue-600/10 text-blue-700 dark:text-blue-200 border-blue-600/20'
                        : method === 'TRANSFER'
                          ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/20'
                          : method === 'MIXED'
                            ? 'bg-violet-500/10 text-violet-800 dark:text-violet-200 border-violet-500/20'
                            : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/20';

                    const patient = tx.patient_name || (tx.patient_id ? `#${tx.patient_id}` : '—');
                    const service =
                      String(tx.description || '').replace(/^\[EXPENSE\]\s*/i, '') ||
                      t('common.not_available', { defaultValue: '—' });
                    const amountAbs = Math.abs(Number(tx.amount || 0));

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                        <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                          {tx.created_at
                            ? new Date(tx.created_at).toLocaleTimeString()
                            : t('common.not_available', { defaultValue: '—' })}
                        </td>
                        <td className="px-3 py-3">
                          <div className="truncate font-semibold text-slate-900 dark:text-slate-50">
                            {patient}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="truncate text-slate-700 dark:text-slate-200">
                            {service}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div
                            className={cn(
                              'font-mono font-semibold tabular-nums',
                              Number(tx.amount || 0) < 0
                                ? 'text-destructive'
                                : 'text-slate-900 dark:text-slate-50',
                            )}
                          >
                            {Number(tx.amount || 0) < 0 ? '-' : ''}
                            {amountAbs.toLocaleString()}{' '}
                            {t('common.currency', { defaultValue: "so'm" })}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                              badgeTone,
                            )}
                          >
                            {methodLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      />

      <Modal
        open={expenseOpen}
        title={t('finance.new_transaction', { defaultValue: 'Новый расход' })}
        description={t('finance.expense_modal_desc', {
          defaultValue:
            'Расход списывается как отрицательная транзакция. Требуется открытая смена.',
        })}
        onClose={() => setExpenseOpen(false)}
        width={500}
      >
        <div className="space-y-6">
          {/* Сумма - вертикальная компоновка */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('finance.total_amount', { defaultValue: 'Сумма' })}
            </label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-12 text-base"
            />
          </div>

          {/* Метод оплаты */}
          <div>
            <label className="block text-sm font-medium mb-3">
              {t('finance.payment_method', { defaultValue: 'Тип оплаты' })}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['CASH', 'CARD', 'TRANSFER'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    'p-4 border-2 rounded-lg transition-all hover:border-blue-500/60 focus-visible:outline-none flex flex-col items-center gap-2',
                    paymentMethod === method
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-gray-300',
                  )}
                >
                  {method === 'CASH' ? (
                    <Banknote size={20} />
                  ) : method === 'CARD' ? (
                    <CreditCard size={20} />
                  ) : (
                    <ArrowLeftRight size={20} />
                  )}
                  <span className="text-sm font-medium">
                    {t(`finance.${method.toLowerCase()}`, { defaultValue: method })}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('finance.expense_desc', { defaultValue: 'Описание расхода' })}
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('finance.expense_placeholder', {
                defaultValue: 'Например: канцтовары, такси…',
              })}
              className="h-12 text-base"
            />
          </div>

          {/* Предпросмотр */}
          {amount && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-1">
                {t('finance.preview', { defaultValue: 'Предпросмотр:' })}
              </div>
              <div className="font-medium text-red-600">
                -{Number(amount).toFixed(2)} {t('common.currency')} •{' '}
                {paymentMethod === 'CASH'
                  ? t('finance.method_cash_case', { defaultValue: 'наличными' })
                  : paymentMethod === 'CARD'
                    ? t('finance.method_card_case', { defaultValue: 'картой' })
                    : t('finance.method_transfer_case', { defaultValue: 'переводом' })}
              </div>
              <div className="text-sm text-muted-foreground">
                {description || t('finance.no_description', { defaultValue: 'Без описания' })}
              </div>
            </div>
          )}

          {!shift && (
            <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200">
              {t('finance.open_shift_prompt', { defaultValue: 'Сначала откройте смену' })}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={() => setExpenseOpen(false)} className="flex-1 h-12">
            {t('common.cancel', { defaultValue: 'Отмена' })}
          </Button>
          <Button
            onClick={handleExpense}
            disabled={txLoading || !shift || !amount.trim() || Number(amount) <= 0}
            className="flex-1 h-12"
          >
            {txLoading
              ? t('finance.processing', { defaultValue: 'Обработка…' })
              : t('finance.charge_btn', { defaultValue: 'Списать' })}
          </Button>
        </div>
      </Modal>

      {/* Close Shift Confirmation Modal */}
      <Modal
        open={closeShiftOpen}
        onClose={() => setCloseShiftOpen(false)}
        title={t('finance.close_shift_confirm', { defaultValue: 'Закрыть смену?' })}
        description={t('finance.close_shift_desc', {
          defaultValue: 'Проверьте финальный отчет перед закрытием смены',
        })}
        width={500}
      >
        <div className="space-y-4">
          <div className="bg-background rounded-lg p-4 border">
            <h4 className="font-semibold mb-3">
              {t('finance.final_report', { defaultValue: 'Финальный отчет смены' })}
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>{t('finance.cash')}:</span>
                <span className="font-mono font-semibold tabular-nums">
                  {shiftTotals.cash.toLocaleString()} {t('common.currency')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('finance.card')}:</span>
                <span className="font-mono font-semibold tabular-nums">
                  {shiftTotals.card.toLocaleString()} {t('common.currency')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('finance.transfer', { defaultValue: 'Перевод' })}:</span>
                <span className="font-mono font-semibold tabular-nums">
                  {shiftTotals.transfer.toLocaleString()} {t('common.currency')}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>{t('reports.total')}:</span>
                <span className="font-mono tabular-nums">
                  {shiftTotals.total.toLocaleString()} {t('common.currency')}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-700/60 dark:bg-slate-900/30">
            <div className="text-sm font-semibold">
              {t('finance.cash_reconcile', { defaultValue: 'Сверка наличных' })}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {t('finance.cash_reconcile_hint', {
                defaultValue:
                  'Пересчитайте наличные в кассе и сравните с суммой на экране перед закрытием смены.',
              })}
            </div>
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('finance.cash_counted', { defaultValue: 'Фактически в кассе (наличные)' })}
              </label>
              <Input
                type="number"
                value={cashCounted}
                onChange={(e) => setCashCounted(e.target.value)}
                placeholder={String(shiftTotals.cash || 0)}
              />
              {cashCounted.trim() ? (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('finance.diff', { defaultValue: 'Разница' })}
                  </span>
                  <span
                    className={cn(
                      'font-mono font-semibold tabular-nums',
                      Number(cashCounted) - shiftTotals.cash === 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-200',
                    )}
                  >
                    {(Number(cashCounted) - shiftTotals.cash).toLocaleString()}{' '}
                    {t('common.currency')}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {t('finance.close_shift_warning', {
              defaultValue:
                'После закрытия смены данные будут зафиксированы и больше нельзя будет добавлять операции.',
            })}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={() => setCloseShiftOpen(false)} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmCloseShift}
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {loading ? t('common.loading') : t('finance.close_shift')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
