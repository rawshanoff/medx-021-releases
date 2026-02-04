import type { Dispatch, SetStateAction } from 'react';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../lib/cn';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { DiffViewer } from '../../../components/settings/DiffViewer';
import { SectionHeader } from '../SectionHeader';

type AuditRow = {
  id: number;
  user_id: number;
  user?: { id: number; username: string; full_name?: string | null } | null;
  action: string;
  setting_key: string;
  old_value: any;
  new_value: any;
  details?: string | null;
  created_at?: string | null;
};

type Me = { full_name?: string | null; username?: string | null } | null;

function formatDateTime(v?: string | null) {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

function actionLabel(tr: (k: string, def: string) => string, action: string) {
  switch (action) {
    case 'create':
      return tr('system.audit_action.create', 'Создание');
    case 'update':
      return tr('system.audit_action.update', 'Изменение');
    case 'delete':
      return tr('system.audit_action.delete', 'Удаление');
    case 'rollback':
      return tr('system.audit_action.rollback', 'Откат');
    default:
      return action;
  }
}

export function HistoryPane({
  tr,
  auditKey,
  setAuditKey,
  auditKeys,
  auditRows,
  auditBusy,
  fetchAudit,
  rollbackAudit,
  me,
}: {
  tr: (key: string, defaultValue: string) => string;
  auditKey: string;
  setAuditKey: Dispatch<SetStateAction<string>>;
  auditKeys: string[];
  auditRows: AuditRow[];
  auditBusy: boolean;
  fetchAudit: () => void;
  rollbackAudit: (auditId: number) => void;
  me: Me;
}) {
  const navigate = useNavigate();

  return (
    <div className="grid gap-6">
      <SectionHeader
        title={tr('system.audit_log', 'История изменений')}
        subtitle={tr('system.audit_log_desc', 'Кто и когда менял настройки')}
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={fetchAudit}
              disabled={auditBusy}
            >
              <RefreshCw size={14} className={auditBusy ? 'animate-spin' : ''} />{' '}
              {tr('common.refresh', 'Обновить')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => navigate(`/system/audit?key=${encodeURIComponent(auditKey)}`)}
            >
              {tr('system.open_full_page', 'Открыть страницу')}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{tr('system.audit_scope', 'Раздел')}</CardTitle>
          <CardDescription>
            {tr('system.audit_scope_desc', 'Выберите раздел и посмотрите хронологию изменений.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <select
            className={cn(
              'h-10 rounded-md border border-border bg-background px-3 text-sm shadow-none outline-none',
              'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500',
            )}
            value={auditKey}
            onChange={(e) => setAuditKey(e.target.value)}
          >
            {auditKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <Button variant="secondary" type="button" onClick={fetchAudit} disabled={auditBusy}>
            {tr('common.load', 'Загрузить')}
          </Button>
          <div className="text-sm text-muted-foreground">
            {tr('system.me', 'Пользователь')}:{' '}
            <span className="font-medium text-foreground">
              {me?.full_name || me?.username || '—'}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {auditRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {auditBusy
              ? tr('common.loading', 'Загрузка…')
              : tr('system.audit_empty', 'История пуста')}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800">
            <div className="grid grid-cols-[180px_1fr_160px_120px] gap-3 border-b border-slate-200/80 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-slate-700/60">
              <div>{tr('system.date', 'Дата')}</div>
              <div>{tr('system.user', 'Пользователь')}</div>
              <div>{tr('system.action', 'Действие')}</div>
              <div className="text-right">{tr('common.actions', 'Действия')}</div>
            </div>

            <ul className="divide-y divide-slate-200/80 dark:divide-slate-700/60">
              {auditRows.map((row) => (
                <li key={row.id} className="px-4 py-4">
                  <div className="grid grid-cols-[180px_1fr_160px_120px] items-start gap-3">
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {row.user?.full_name ||
                          row.user?.username ||
                          me?.full_name ||
                          me?.username ||
                          '—'}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900/30">
                          {row.setting_key}
                        </span>
                        <span>#{row.id}</span>
                        {row.details ? <span className="truncate">{row.details}</span> : null}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{actionLabel(tr, row.action)}</div>
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => rollbackAudit(row.id)}
                      >
                        {tr('system.rollback', 'Откатить')}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <DiffViewer oldValue={row.old_value} newValue={row.new_value} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
