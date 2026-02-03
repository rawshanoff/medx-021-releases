import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import {
  Banknote,
  CreditCard,
  FileText,
  Lock,
  TrendingDown,
  Unlock,
  RefreshCw,
  CheckCircle,
  Clock,
  User,
} from 'lucide-react';
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
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

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
      console.error('Failed to check active shift', e);
      setShift(null);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const res = await client.get('/finance/recent-transactions?limit=5');
      setRecentTransactions(res.data || []);
    } catch (e) {
      showToast('Не удалось загрузить транзакции', 'error');
      console.error('Failed to fetch recent transactions', e);
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

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Status Bar */}
      <div
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border',
          shift
            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
            : 'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800',
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              shift ? 'bg-green-500 animate-pulse' : 'bg-gray-400',
            )}
          />
          <div>
            <div className="text-sm font-medium">
              {shift ? t('finance.shift_open', { id: shift.id }) : t('finance.shift_closed')}
            </div>
            {shift && (
              <div className="text-xs text-muted-foreground">
                {new Date(shift.opened_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!shift ? (
            <Button
              size="sm"
              onClick={handleOpenShift}
              disabled={loading}
              className="h-8 px-3 text-xs"
            >
              <Unlock size={14} />
              {t('finance.open_shift')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCloseShift}
              disabled={loading}
              className="h-8 px-3 text-xs"
            >
              <Lock size={14} />
              {t('finance.close_shift')}
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto">
        {/* Summary Cards */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {t('finance.cash_flow', { defaultValue: 'Касса / Cash Flow' })}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkActiveShift}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('finance.cash'), value: shiftTotals.cash, color: 'text-green-600' },
              { label: t('finance.card'), value: shiftTotals.card, color: 'text-blue-600' },
              {
                label: t('reception.transfer'),
                value: shiftTotals.transfer,
                color: 'text-orange-600',
              },
              {
                label: t('reports.total', { defaultValue: 'Итого' }),
                value: shiftTotals.total,
                color: 'text-gray-900 dark:text-white',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-background rounded-lg border p-4 hover:shadow-sm transition-shadow"
              >
                <div className="text-sm font-medium text-muted-foreground mb-1">{item.label}</div>
                <div className={cn('text-2xl font-bold', item.color)}>
                  {Number(item.value || 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t('common.currency')}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction Feed */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-lg font-semibold mb-4">
            {t('finance.recent_transactions', { defaultValue: 'Последние операции' })}
          </h3>

          {recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-background rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {tx.amount > 0 ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <TrendingDown size={16} className="text-red-500" />
                      )}
                      <div className="text-sm">
                        <div className="font-medium">{tx.amount > 0 ? 'Приход' : 'Расход'}</div>
                        <div className="text-muted-foreground text-xs">
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={cn(
                        'font-semibold',
                        tx.amount > 0 ? 'text-green-600' : 'text-red-600',
                      )}
                    >
                      {tx.amount > 0 ? '+' : ''}
                      {Math.abs(tx.amount).toLocaleString()} {t('common.currency')}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <User size={12} />
                      {tx.created_by || 'System'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock size={48} className="mx-auto mb-2 opacity-50" />
              <div>{t('finance.no_transactions', { defaultValue: 'Нет операций' })}</div>
            </div>
          )}
        </div>

        {/* Actions - адаптивные кнопки */}
        <div className="flex flex-col sm:flex-row gap-4 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => setExpenseOpen(true)}
            disabled={!shift}
            className="flex items-center gap-2 h-12 px-6 w-full sm:w-auto"
          >
            <TrendingDown size={18} />
            <span>{t('finance.new_transaction', { defaultValue: 'Новый расход' })}</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/reports')}
            className="flex items-center gap-2 h-12 px-6 w-full sm:w-auto"
          >
            <FileText size={18} />
            <span>{t('nav.reports')}</span>
          </Button>

          <Button
            variant="outline"
            disabled
            className="flex items-center gap-2 h-12 px-6 w-full sm:w-auto opacity-60"
          >
            <Lock size={18} />
            <span>PRO</span>
          </Button>
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
            <div className="grid grid-cols-2 gap-3">
              {(['CASH', 'CARD'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    'p-4 border-2 rounded-lg transition-all hover:border-gray-400 flex flex-col items-center gap-2',
                    paymentMethod === method
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                      : 'border-gray-300',
                  )}
                >
                  {method === 'CASH' ? <Banknote size={20} /> : <CreditCard size={20} />}
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
              <div className="text-sm text-muted-foreground mb-1">Предпросмотр:</div>
              <div className="font-medium text-red-600">
                -{Number(amount).toFixed(2)} {t('common.currency')} •{' '}
                {paymentMethod === 'CASH' ? 'наличными' : 'картой'}
              </div>
              <div className="text-sm text-muted-foreground">{description || 'Без описания'}</div>
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
                <span className="font-medium">
                  {shiftTotals.cash.toLocaleString()} {t('common.currency')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('finance.card')}:</span>
                <span className="font-medium">
                  {shiftTotals.card.toLocaleString()} {t('common.currency')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('reception.transfer')}:</span>
                <span className="font-medium">
                  {shiftTotals.transfer.toLocaleString()} {t('common.currency')}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>{t('reports.total')}:</span>
                <span>
                  {shiftTotals.total.toLocaleString()} {t('common.currency')}
                </span>
              </div>
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
