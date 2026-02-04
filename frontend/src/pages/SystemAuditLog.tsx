import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { Button } from '../components/ui/button';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { DiffViewer } from '../components/settings/DiffViewer';

type AuditRow = {
  id: number;
  user_id: number;
  user?: { id: number; username: string; full_name?: string | null } | null;
  action: string;
  setting_key: string;
  old_value?: unknown;
  new_value?: unknown;
  details?: string | null;
  created_at?: string | null;
};

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

function actionLabel(action: string) {
  switch (action) {
    case 'create':
      return 'Создание';
    case 'update':
      return 'Изменение';
    case 'delete':
      return 'Удаление';
    case 'rollback':
      return 'Откат';
    default:
      return action;
  }
}

export default function SystemAuditLogPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const settingKey = params.get('key') || 'print_config';
  const limit = Number(params.get('limit') || 50);

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [availableKeys, setAvailableKeys] = useState<string[]>(['print_config']);

  const keys = useMemo(
    () =>
      availableKeys.map((k) => ({
        key: k,
        label:
          k === 'print_config'
            ? t('system.receipt_settings', { defaultValue: 'Настройки чека' })
            : k,
      })),
    [availableKeys, t],
  );

  const loadKeys = async () => {
    try {
      const res = await client.get('/system/settings/keys');
      const k = Array.isArray(res.data) ? (res.data as string[]) : [];
      setAvailableKeys(k.length ? k : ['print_config']);
    } catch {
      setAvailableKeys(['print_config']);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get(
        `/system/settings/audit/${encodeURIComponent(settingKey)}?limit=${limit}`,
      );
      setRows(res.data || []);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || t('common.error', { defaultValue: 'Ошибка' });
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const rollback = async (auditId: number) => {
    setBusyId(auditId);
    try {
      await client.post(`/system/settings/${encodeURIComponent(settingKey)}/rollback/${auditId}`);
      showToast(t('common.saved', { defaultValue: 'Сохранено' }), 'success');
      await refresh();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || t('common.error', { defaultValue: 'Ошибка' });
      showToast(String(msg), 'error');
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    loadKeys();
    refresh();
  }, [settingKey, limit]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={() => navigate('/system')}>
            {t('common.back', { defaultValue: 'Назад' })}
          </Button>

          <select
            value={settingKey}
            onChange={(e) => {
              params.set('key', e.target.value);
              setParams(params, { replace: true });
            }}
            className="h-10 rounded-md border border-border bg-background px-2.5 text-[13px]"
          >
            {keys.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <Button variant="secondary" size="sm" type="button" disabled={loading} onClick={refresh}>
          {t('common.refresh', { defaultValue: 'Обновить' })}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-border bg-card p-3 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-card">
        <div className="divide-y divide-border">
          {rows.length === 0 ? (
            <div className="p-4 text-[13px] text-muted-foreground">
              {loading
                ? t('common.loading', { defaultValue: 'Загрузка…' })
                : t('common.empty', { defaultValue: 'Пусто' })}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-[180px_1fr_160px_120px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div>{t('system.date', { defaultValue: 'Дата' })}</div>
                <div>{t('system.user', { defaultValue: 'Пользователь' })}</div>
                <div>{t('system.action', { defaultValue: 'Действие' })}</div>
                <div className="text-right">
                  {t('common.actions', { defaultValue: 'Действия' })}
                </div>
              </div>
              {rows.map((r) => (
                <div key={r.id} className="p-4">
                  <div className="grid grid-cols-[180px_1fr_160px_120px] items-start gap-3">
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(r.created_at)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {r.user?.full_name || r.user?.username || '—'}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-md border border-border bg-background px-2 py-0.5">
                          {r.setting_key}
                        </span>
                        <span>#{r.id}</span>
                        {r.details ? <span className="truncate">{r.details}</span> : null}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{actionLabel(r.action)}</div>
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => rollback(r.id)}
                      >
                        {t('system.rollback', { defaultValue: 'Откатить' })}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <DiffViewer oldValue={r.old_value} newValue={r.new_value} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
