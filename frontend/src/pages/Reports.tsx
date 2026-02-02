import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { FileText, Lock, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/button';

function formatMoney(n: any, currency: string) {
  const v = Number(n || 0);
  return `${v.toLocaleString()} ${currency}`;
}

export default function Reports() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [shift, setShift] = useState<any>(null);
  const [x, setX] = useState<any>(null);
  const [z, setZ] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const currency = t('common.currency');

  const refresh = async () => {
    setLoading(true);
    try {
      const [shiftRes, xRes, zRes] = await Promise.all([
        client.get('/finance/shifts/active').catch(() => ({ data: null })),
        client.get('/finance/reports/X').catch((e) => ({
          data: { error: e?.response?.data?.detail || String(e?.message || e) },
        })),
        client.get('/finance/reports/Z').catch((e) => ({
          data: { error: e?.response?.data?.detail || String(e?.message || e) },
        })),
      ]);
      setShift(shiftRes.data);
      setX(xRes.data);
      setZ(zRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const shiftTotals = useMemo(() => {
    const cash = Number(shift?.total_cash || 0);
    const card = Number(shift?.total_card || 0);
    const transfer = Number(shift?.total_transfer || 0);
    return {
      cash,
      card,
      transfer,
      total: cash + card + transfer,
    };
  }, [shift]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-medium">{t('nav.reports')}</h1>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => {
            refresh().then(() => showToast(t('common.done'), 'success'));
          }}
          disabled={loading}
        >
          <RefreshCw size={16} /> {t('common.refresh', { defaultValue: 'Обновить' })}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4">
        {/* Basic / Free */}
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-muted-foreground" />
              <div className="text-[13px] font-medium">
                {t('reports.basic', { defaultValue: 'Базовые отчёты (бесплатно)' })}
              </div>
            </div>
            <div className="text-[12px] text-muted-foreground">
              {shift
                ? t('finance.shift_open', { id: shift.id })
                : t('finance.shift_closed', { defaultValue: 'Смена закрыта' })}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-[13px] font-medium">
                {t('reports.shift_totals', { defaultValue: 'Касса за смену' })}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {t('reports.by_payment', { defaultValue: 'По типам оплаты' })}
              </div>
              <div className="mt-3 grid gap-2 text-[13px]">
                {[
                  { label: t('finance.cash'), value: shiftTotals.cash },
                  { label: t('finance.card'), value: shiftTotals.card },
                  { label: t('reception.transfer'), value: shiftTotals.transfer },
                ].map((x) => (
                  <div key={x.label} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{x.label}</span>
                    <span className="font-medium">{formatMoney(x.value, currency)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-border pt-2">
                  <span className="font-medium">
                    {t('reports.total', { defaultValue: 'Итого' })}
                  </span>
                  <span className="font-medium">{formatMoney(shiftTotals.total, currency)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-[13px] font-medium">{t('finance.x_report')}</div>
              {x?.error ? (
                <div className="mt-2 text-[12px] text-destructive">{String(x.error)}</div>
              ) : (
                <div className="mt-3 grid gap-2 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t('finance.cash')}</span>
                    <span className="font-medium">{formatMoney(x?.total_cash, currency)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t('finance.card')}</span>
                    <span className="font-medium">{formatMoney(x?.total_card, currency)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-[13px] font-medium">{t('finance.z_report')}</div>
              {z?.error ? (
                <div className="mt-2 text-[12px] text-destructive">{String(z.error)}</div>
              ) : (
                <div className="mt-3 grid gap-2 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t('finance.cash')}</span>
                    <span className="font-medium">{formatMoney(z?.total_cash, currency)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t('finance.card')}</span>
                    <span className="font-medium">{formatMoney(z?.total_card, currency)}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <span className="font-medium">
                      {t('reports.total', { defaultValue: 'Итого' })}
                    </span>
                    <span className="font-medium">{formatMoney(z?.total_income, currency)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pro (Paid) */}
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-muted-foreground" />
              <div className="text-[13px] font-medium">
                {t('reports.pro', { defaultValue: 'Профессиональные отчёты (платно)' })}
              </div>
            </div>
            <div className="text-[12px] text-muted-foreground">
              {t('reports.pro_hint', {
                defaultValue: 'Эти отчёты доступны после активации PRO лицензии.',
              })}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: t('reports.cash_flow_day', { defaultValue: 'Cash Flow за день' }),
                desc: t('reports.cash_flow_day_desc', {
                  defaultValue: 'Поступления/расходы/чистая прибыль по дням',
                }),
              },
              {
                title: t('reports.by_doctor', { defaultValue: 'Отчёт по врачам' }),
                desc: t('reports.by_doctor_desc', { defaultValue: 'Выручка по врачам и услугам' }),
              },
              {
                title: t('reports.by_service', { defaultValue: 'Отчёт по услугам' }),
                desc: t('reports.by_service_desc', {
                  defaultValue: 'ТОП услуг, динамика, средний чек',
                }),
              },
              {
                title: t('reports.debts', { defaultValue: 'Долги и возвраты' }),
                desc: t('reports.debts_desc', {
                  defaultValue: 'Сводка по задолженностям/возвратам',
                }),
              },
            ].map((x) => (
              <div
                key={x.title}
                className="rounded-md border border-border bg-background p-3 opacity-60"
              >
                <div className="text-[13px] font-medium">{x.title}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{x.desc}</div>
                <Button className="mt-2" variant="secondary" size="sm" type="button" disabled>
                  <Lock size={16} /> PRO
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
