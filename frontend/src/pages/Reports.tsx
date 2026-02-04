import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/button';
import { ReportsGrid } from '../features/reports/ReportsGrid';
import { Modal } from '../components/ui/modal';
import { buildCashReportHtml } from '../features/reports/reportHtml';
import { getCachedPrintSettings } from '../utils/print';

export default function Reports() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [shift, setShift] = useState<any>(null);
  const [x, setX] = useState<any>(null);
  const [z, setZ] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportSubtitle, setReportSubtitle] = useState<string | undefined>(undefined);
  const [reportShiftId, setReportShiftId] = useState<number | string | null>(null);
  const [reportCashier, setReportCashier] = useState<string | null>(null);
  const [reportTotals, setReportTotals] = useState<{
    cash: number;
    card: number;
    transfer: number;
    total: number;
  }>({
    cash: 0,
    card: 0,
    transfer: 0,
    total: 0,
  });

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

  const openReport = (payload: {
    title: string;
    subtitle?: string;
    shiftId?: number | string | null;
    cashier?: string | null;
    totals: { cash: number; card: number; transfer: number; total: number };
  }) => {
    setReportTitle(payload.title);
    setReportSubtitle(payload.subtitle);
    setReportShiftId(payload.shiftId ?? null);
    setReportCashier(payload.cashier ?? null);
    setReportTotals(payload.totals);
    setReportOpen(true);
  };

  const handlePrint = async () => {
    const ps = getCachedPrintSettings();
    const html = buildCashReportHtml({
      title: reportTitle,
      subtitle: reportSubtitle,
      shiftId: reportShiftId,
      cashier: reportCashier,
      totals: reportTotals,
      currency,
      paperSize: ps.paperSize,
      receiptWidthMode: ps.receiptWidthMode,
      labels: {
        shift: t('reports.shift_label', { defaultValue: 'Смена' }),
        cashier: t('reports.cashier_label', { defaultValue: 'Кассир' }),
        cash: t('reports.cash_label', { defaultValue: 'Наличные' }),
        card: t('reports.card_label', { defaultValue: 'Карта' }),
        transfer: t('reports.transfer_label', { defaultValue: 'Перевод' }),
        total: t('reports.total_label', { defaultValue: 'Итого' }),
        footer: t('reports.footer_label', { defaultValue: 'MedX' }),
      },
    });

    const api: any = (window as any).medx;
    if (api?.printHtml) {
      if (!ps.preferredPrinterDeviceName) {
        showToast(
          t('system.select_device_name_first', {
            defaultValue: 'Сначала выберите deviceName принтера в Настройках принтера',
          }),
          'warning',
        );
        return;
      }
      try {
        const res = await api.printHtml({
          html,
          deviceName: ps.preferredPrinterDeviceName,
          silent: true,
          paperSize: ps.paperSize,
          scaleFactor: Number.isFinite(Number(ps.silentScalePercent))
            ? Number(ps.silentScalePercent)
            : 100,
          mode: ps.silentPrintMode || 'html',
        });
        if (res?.ok)
          showToast(t('reports.sent_to_print', { defaultValue: 'Отправлено в печать' }), 'success');
        else showToast(t('reports.print_failed', { defaultValue: 'Печать не удалась' }), 'error');
      } catch (e: any) {
        showToast(
          String(e?.message || t('reports.print_failed', { defaultValue: 'Печать не удалась' })),
          'error',
        );
      }
      return;
    }

    // Browser fallback: open window and print
    try {
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) throw new Error('popup blocked');
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      showToast(t('reports.print_dialog_opened', { defaultValue: 'Открыт диалог печати' }), 'info');
    } catch {
      showToast(t('reports.print_failed', { defaultValue: 'Печать не удалась' }), 'error');
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          className="h-10 px-3 text-[13px]"
          type="button"
          onClick={() => {
            refresh().then(() => showToast(t('common.done'), 'success'));
          }}
          disabled={loading}
        >
          <RefreshCw size={16} /> {t('common.refresh', { defaultValue: 'Обновить' })}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <ReportsGrid
          basicTitle={t('reports.basic', { defaultValue: 'Отчёты кассы' })}
          basicSubtitle={
            shift
              ? t('reports.shift_opened', {
                  id: shift.id,
                  defaultValue: `Смена #${shift.id} (Открыта)`,
                })
              : t('reports.shift_waiting', { defaultValue: 'Ожидаем начало смены' })
          }
          cards={[
            {
              key: 'totals',
              title: t('reports.shift_totals', { defaultValue: 'Касса за смену' }),
              description: t('reports.by_payment', { defaultValue: 'Сводка по типам оплаты' }),
              status: shift
                ? { tone: 'success', label: t('reports.ready', { defaultValue: 'Готово' }) }
                : {
                    tone: 'muted',
                    label: t('reports.waiting_shift', { defaultValue: 'Ожидаем смену' }),
                  },
              footerValue: `${shiftTotals.total.toLocaleString()} ${currency}`,
              actionLabel: t('reports.print_or_view', { defaultValue: 'Печать / Просмотр' }),
              actionDisabled: !shift,
              onAction: () => {
                if (!shift) return;
                openReport({
                  title: t('reports.shift_totals', { defaultValue: 'Касса за смену' }),
                  subtitle: t('reports.by_payment', { defaultValue: 'По типам оплаты' }),
                  shiftId: shift.id,
                  cashier: shift.cashier_id || null,
                  totals: shiftTotals,
                });
              },
            },
            {
              key: 'x',
              title: t('finance.x_report', { defaultValue: 'X‑отчёт' }),
              description: t('reports.x_desc', {
                defaultValue: 'Промежуточный отчёт по текущей смене.',
              }),
              status: x?.error
                ? {
                    tone: 'muted',
                    label: t('reports.waiting_shift', { defaultValue: 'Ожидаем смену' }),
                  }
                : {
                    tone: 'success',
                    label: t('reports.ready_to_print', { defaultValue: 'Готово к печати' }),
                  },
              footerValue: x?.error
                ? undefined
                : `${Number(x?.total_cash || 0).toLocaleString()} ${currency}`,
              actionLabel: t('reports.print_or_view', { defaultValue: 'Печать / Просмотр' }),
              actionDisabled: Boolean(x?.error),
              onAction: () => {
                if (x?.error) return;
                openReport({
                  title: t('finance.x_report', { defaultValue: 'X‑отчёт' }),
                  subtitle: x?.generated_at ? new Date(x.generated_at).toLocaleString() : undefined,
                  shiftId: x?.shift_id ?? shift?.id ?? null,
                  cashier: x?.cashier ?? shift?.cashier_id ?? null,
                  totals: {
                    cash: Number(x?.total_cash || 0),
                    card: Number(x?.total_card || 0),
                    transfer: Number(x?.total_transfer || 0),
                    total:
                      Number(x?.total_cash || 0) +
                      Number(x?.total_card || 0) +
                      Number(x?.total_transfer || 0),
                  },
                });
              },
            },
            {
              key: 'z',
              title: t('finance.z_report', { defaultValue: 'Z‑отчёт' }),
              description: t('reports.z_desc', {
                defaultValue: 'Отчёт по последней закрытой смене.',
              }),
              status: z?.error
                ? {
                    tone: 'muted',
                    label: t('reports.no_closed_shifts', { defaultValue: 'Нет закрытых смен' }),
                  }
                : {
                    tone: 'success',
                    label: t('reports.ready_to_print', { defaultValue: 'Готово к печати' }),
                  },
              footerValue: z?.error
                ? undefined
                : `${Number(z?.total_income || 0).toLocaleString()} ${currency}`,
              actionLabel: t('reports.print_or_view', { defaultValue: 'Печать / Просмотр' }),
              actionDisabled: Boolean(z?.error),
              onAction: () => {
                if (z?.error) return;
                openReport({
                  title: t('finance.z_report', { defaultValue: 'Z‑отчёт' }),
                  subtitle: z?.closed_at ? new Date(z.closed_at).toLocaleString() : undefined,
                  shiftId: z?.shift_id ?? null,
                  cashier: null,
                  totals: {
                    cash: Number(z?.total_cash || 0),
                    card: Number(z?.total_card || 0),
                    transfer: Number(z?.total_transfer || 0),
                    total: Number(z?.total_income || 0),
                  },
                });
              },
            },
          ]}
          proTitle={t('reports.pro', { defaultValue: 'PRO аналитика' })}
          proSubtitle={t('reports.pro_hint', {
            defaultValue: 'Доступно после активации PRO лицензии.',
          })}
          proCards={[
            {
              key: 'cash-flow',
              title: t('reports.cash_flow_day', { defaultValue: 'Cash Flow за день' }),
              description: t('reports.cash_flow_day_desc', {
                defaultValue: 'Поступления/расходы/прибыль по дням',
              }),
            },
            {
              key: 'by-doctor',
              title: t('reports.by_doctor', { defaultValue: 'Отчёт по врачам' }),
              description: t('reports.by_doctor_desc', {
                defaultValue: 'Выручка по врачам и услугам',
              }),
            },
            {
              key: 'by-service',
              title: t('reports.by_service', { defaultValue: 'Отчёт по услугам' }),
              description: t('reports.by_service_desc', {
                defaultValue: 'ТОП услуг, динамика, средний чек',
              }),
            },
          ]}
          proLocked={true}
        />
      </div>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={reportTitle || t('reports.view', { defaultValue: 'Отчёт' })}
        description={reportSubtitle}
        width={560}
      >
        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-700/60 dark:bg-slate-900/30">
          <div className="grid gap-2 text-sm">
            {reportShiftId != null ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {t('reports.shift_label', { defaultValue: 'Смена' })}
                </span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  #{reportShiftId}
                </span>
              </div>
            ) : null}
            {reportCashier ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {t('reports.cashier_label', { defaultValue: 'Кассир' })}
                </span>
                <span className="font-medium text-foreground">{reportCashier}</span>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {t('reports.cash_label', { defaultValue: 'Наличные' })}
              </span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {reportTotals.cash.toLocaleString()} {currency}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {t('reports.card_label', { defaultValue: 'Карта' })}
              </span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {reportTotals.card.toLocaleString()} {currency}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {t('reports.transfer_label', { defaultValue: 'Перевод' })}
              </span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {reportTotals.transfer.toLocaleString()} {currency}
              </span>
            </div>
            <div className="mt-2 border-t border-slate-200/80 pt-2 dark:border-slate-700/60">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {t('reports.total_label', { defaultValue: 'Итого' })}
                </span>
                <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                  {reportTotals.total.toLocaleString()} {currency}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            type="button"
            className="flex-1"
            onClick={() => setReportOpen(false)}
          >
            {t('common.close', { defaultValue: 'Закрыть' })}
          </Button>
          <Button type="button" className="flex-1" onClick={handlePrint}>
            {t('reports.print', { defaultValue: 'Печать' })}
          </Button>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          {t('reports.print_hint', {
            defaultValue:
              'Перед печатью убедитесь, что выбран printer deviceName в настройках принтера.',
          })}
        </div>
      </Modal>
    </div>
  );
}
