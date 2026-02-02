import { Clock, CheckCircle2, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import {
  getPrintSettings,
  loadReceiptForTicket,
  printQueueTicket,
  printReceipt,
} from '../../utils/print';
import type { QueueItem, QueueStatus } from '../../types/reception';

export function QueueSidebar({
  queue,
  onUpdateStatus,
}: {
  queue: QueueItem[];
  onUpdateStatus: (id: number, status: QueueStatus) => void | Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-muted-foreground" />
          <div className="text-[14px] font-medium">{t('reception.queue')}</div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-[40px] w-[40px]"
          title={t('reception.print', { defaultValue: 'Печать' })}
          onClick={() => {
            const settings = { ...getPrintSettings(), autoPrint: true };
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

      <div className="min-h-0 flex-1 overflow-auto space-y-2">
        {queue.length === 0 ? (
          <div className="rounded-md border border-border bg-background p-3 text-[13px] text-muted-foreground">
            {t('reception.no_queue_today', { defaultValue: 'Очередь на сегодня пустая' })}
          </div>
        ) : null}

        {queue.map((item) => (
          <div
            key={item.id}
            className={cn(
              'rounded-md border border-border p-3',
              item.status === 'WAITING' ? 'bg-secondary/60' : 'bg-background',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{item.ticket_number}</div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[13px] font-medium',
                      item.status === 'WAITING'
                        ? 'bg-primary text-primary-foreground'
                        : item.status === 'COMPLETED'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-destructive text-destructive-foreground',
                    )}
                  >
                    {item.status === 'WAITING'
                      ? t('reception.waiting')
                      : item.status === 'COMPLETED'
                        ? t('reception.completed')
                        : t('common.cancelled') || 'Cancelled'}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[14px]">{item.patient_name}</div>
                <div className="truncate text-[13px] text-muted-foreground">{item.doctor_name}</div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-[40px] w-[40px]"
                title={t('reception.print_ticket', { defaultValue: 'Печать талона' })}
                onClick={() => {
                  const settings = { ...getPrintSettings(), autoPrint: true };
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

            {item.status === 'WAITING' ? (
              <div className="mt-2">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => onUpdateStatus(item.id, 'COMPLETED')}
                  type="button"
                >
                  <CheckCircle2 size={16} />
                  {t('common.done')}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
