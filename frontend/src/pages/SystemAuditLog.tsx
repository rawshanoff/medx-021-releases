import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { Button } from '../components/ui/button';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';

type AuditRow = {
  id: number;
  action: string;
  setting_key: string;
  old_value?: unknown;
  new_value?: unknown;
  details?: string | null;
  created_at?: string | null;
};

function formatJson(v: unknown): string {
  if (v == null) return '';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
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

  const keys = useMemo(
    () => [
      {
        key: 'print_config',
        label: t('system.receipt_settings', { defaultValue: 'Настройки чека' }),
      },
    ],
    [t],
  );

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
            rows.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[13px] font-medium">
                    #{r.id} • {r.action} • {r.created_at || ''}
                  </div>
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

                {r.details ? (
                  <div className="mt-2 text-[13px] text-muted-foreground">{r.details}</div>
                ) : null}

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-[12px] font-medium text-muted-foreground">
                      {t('system.old_value', { defaultValue: 'Было' })}
                    </div>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-background p-2 text-[12px]">
                      {formatJson(r.old_value)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-muted-foreground">
                      {t('system.new_value', { defaultValue: 'Стало' })}
                    </div>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-background p-2 text-[12px]">
                      {formatJson(r.new_value)}
                    </pre>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
