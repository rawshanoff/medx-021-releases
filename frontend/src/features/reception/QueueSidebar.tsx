import { useMemo } from 'react';
import { Clock, CheckCircle2, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  getPrintSettings,
  loadReceiptForTicket,
  printQueueTicket,
  printReceipt,
} from '../../utils/print';
import type { QueueItem, QueueStatus } from '../../types/reception';

function statusBadge(status: QueueStatus, label: string) {
  if (status === 'COMPLETED') {
    return (
      <Badge
        variant="outline"
        className="h-5 rounded-md border-emerald-500/30 bg-emerald-500/15 px-2 text-[11px] text-emerald-300 dark:text-emerald-200"
      >
        {label}
      </Badge>
    );
  }
  if (status === 'WAITING') {
    return (
      <Badge
        variant="outline"
        className="h-5 rounded-md border-yellow-500/30 bg-yellow-500/15 px-2 text-[11px] text-yellow-300 dark:text-yellow-200"
      >
        {label}
      </Badge>
    );
  }
  if (status === 'REFUNDED') {
    return (
      <Badge
        variant="outline"
        className="h-5 rounded-md border-amber-500/30 bg-amber-500/15 px-2 text-[11px] text-amber-300 dark:text-amber-200"
      >
        {label}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="h-5 rounded-md border-slate-500/30 bg-slate-500/10 px-2 text-[11px] text-slate-200"
    >
      {label}
    </Badge>
  );
}

export function QueueSidebar({
  queue,
  onUpdateStatus,
  receiptRange,
  onReceiptRangeChange,
}: {
  queue: QueueItem[];
  onUpdateStatus: (id: number, status: QueueStatus) => void | Promise<void>;
  receiptRange: 'shift' | 'today' | '2days';
  onReceiptRangeChange: (next: 'shift' | 'today' | '2days') => void;
}) {
  const { t } = useTranslation();

  const filteredQueue = useMemo(() => {
    if (queue.length === 0) return queue;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    const shiftStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    const start =
      receiptRange === '2days'
        ? startOfYesterday
        : receiptRange === 'shift'
          ? shiftStart
          : startOfToday;

    return queue.filter((item) => {
      if (!item.created_at) return true;
      const created = new Date(item.created_at);
      if (Number.isNaN(created.getTime())) return true;
      return created >= start;
    });
  }, [queue, receiptRange]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-card p-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-muted-foreground" />
          <div className="text-sm font-medium">{t('reception.queue')}</div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500"
            value={receiptRange}
            onChange={(e) => onReceiptRangeChange(e.target.value as any)}
          >
            <option value="shift">
              {t('reception.receipts_shift', { defaultValue: 'За смену' })}
            </option>
            <option value="today">
              {t('reception.receipts_today', { defaultValue: 'За сегодня' })}
            </option>
            <option value="2days">
              {t('reception.receipts_last_2_days', { defaultValue: 'Последние 2 дня' })}
            </option>
          </select>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title={t('reception.print', { defaultValue: 'Печать' })}
            onClick={async () => {
              const loadedSettings = await getPrintSettings();
              const settings = { ...loadedSettings, autoPrint: true };
              const first = queue.find((q) => q.status === 'WAITING') || queue[0];
              if (!first) return;
              const cached = loadReceiptForTicket(first.ticket_number);
              if (cached) {
                printReceipt(cached, settings);
              } else {
                printQueueTicket(
                  {
                    ticket_number: first.ticket_number,
                    patient_name: first.patient_name,
                    doctor_name: first.doctor_name,
                    created_at: first.created_at,
                  },
                  settings,
                );
              }
            }}
            disabled={queue.length === 0}
            type="button"
          >
            <Printer size={16} />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-md border border-slate-200 bg-background/40 dark:border-slate-800 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filteredQueue.length === 0 ? (
          <div className="p-2 text-xs text-muted-foreground">
            {t('reception.no_queue_today', { defaultValue: 'Очередь на сегодня пустая' })}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredQueue.map((item) => {
              const label =
                item.status === 'WAITING'
                  ? t('reception.waiting', { defaultValue: 'Waiting' })
                  : item.status === 'COMPLETED'
                    ? t('reception.completed', { defaultValue: 'Tayyor' })
                    : item.status === 'REFUNDED'
                      ? t('reception.refunded', { defaultValue: 'Refunded' })
                      : t('common.cancelled', { defaultValue: 'Cancelled' });

              return (
                <li key={item.id} className="p-2.5 transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] text-muted-foreground">
                          {item.ticket_number}
                        </div>
                        {statusBadge(item.status, label)}
                      </div>
                      <div className="mt-1 truncate text-sm font-medium">{item.patient_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {item.doctor_name}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {item.status === 'WAITING' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-md px-2.5 text-xs shadow-none"
                          onClick={() => onUpdateStatus(item.id, 'COMPLETED')}
                          type="button"
                          title={t('common.done')}
                        >
                          <CheckCircle2 size={16} />
                        </Button>
                      ) : null}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={t('reception.print_ticket', { defaultValue: 'Печать талона' })}
                        onClick={async () => {
                          const loadedSettings = await getPrintSettings();
                          const settings = { ...loadedSettings, autoPrint: true };
                          const cached = loadReceiptForTicket(item.ticket_number);
                          if (cached) {
                            printReceipt(cached, settings);
                            return;
                          }
                          printQueueTicket(
                            {
                              ticket_number: item.ticket_number,
                              patient_name: item.patient_name,
                              doctor_name: item.doctor_name,
                              created_at: item.created_at,
                            },
                            settings,
                          );
                        }}
                        type="button"
                      >
                        <Printer size={16} />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
