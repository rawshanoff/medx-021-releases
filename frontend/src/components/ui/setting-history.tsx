import { useState, useEffect } from 'react';
import { History, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './button';
import client from '../../api/client';
import { loggers } from '../../utils/logger';

export interface AuditLog {
  id: number;
  action: 'create' | 'update' | 'delete' | 'rollback';
  setting_key: string;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  details: string | null;
  created_at: string;
}

interface SettingHistoryProps {
  settingKey: string;
  onRollback?: (auditId: number) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: 'Создано',
    update: 'Обновлено',
    delete: 'Удалено',
    rollback: 'Откат',
  };
  return labels[action] || action;
}

function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    create: 'bg-green-100 text-green-800',
    update: 'bg-blue-100 text-blue-800',
    delete: 'bg-red-100 text-red-800',
    rollback: 'bg-yellow-100 text-yellow-800',
  };
  return colors[action] || 'bg-gray-100 text-gray-800';
}

export function SettingHistory({ settingKey, onRollback }: SettingHistoryProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [settingKey]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get(`/system/settings/audit/${settingKey}`);
      setLogs(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      setError('Не удалось загрузить историю');
      loggers.system.error('Error loading history', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (auditId: number, oldValue: Record<string, any> | null) => {
    if (!oldValue) {
      alert('Невозможно откатить: нет предыдущего значения');
      return;
    }

    if (!confirm('Вы уверены? Текущее значение будет перезаписано.')) {
      return;
    }

    try {
      const response = await client.post(`/system/settings/${settingKey}/rollback/${auditId}`);
      setLogs((prev) => [
        {
          id: Math.max(...prev.map((l) => l.id), 0) + 1,
          action: 'rollback',
          setting_key: settingKey,
          old_value: response.data.value,
          new_value: oldValue,
          details: `Rolled back from audit entry #${auditId}`,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      if (onRollback) onRollback(auditId);
    } catch (err: any) {
      alert('Ошибка при откате: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-[13px] text-muted-foreground">Загрузка истории...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3">
        <div className="text-[13px] text-red-800">{error}</div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card/50 p-4 text-center">
        <History className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <div className="text-[13px] text-muted-foreground">Нет записей в истории</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <History className="h-4 w-4" />
        История изменений ({logs.length})
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="rounded-md border border-border bg-card/50 overflow-hidden">
            {/* Header */}
            <button
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-card/80 transition flex items-center justify-between gap-2"
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={`inline-flex items-center justify-center h-6 px-2 rounded text-[11px] font-medium flex-shrink-0 ${getActionColor(
                    log.action,
                  )}`}
                >
                  {getActionLabel(log.action)}
                </span>
                <div className="text-[12px] text-muted-foreground truncate">
                  {formatDate(log.created_at)}
                </div>
              </div>
              {expandedId === log.id ? (
                <ChevronUp className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              )}
            </button>

            {/* Expanded Content */}
            {expandedId === log.id && (
              <div className="border-t border-border px-3 py-2 bg-card/30 space-y-2 text-[12px]">
                {log.details && (
                  <div>
                    <div className="text-muted-foreground mb-1">Описание:</div>
                    <div className="text-foreground">{log.details}</div>
                  </div>
                )}

                {log.old_value && (
                  <div>
                    <div className="text-muted-foreground mb-1">Было:</div>
                    <pre className="bg-black/20 rounded p-2 overflow-x-auto max-w-full text-[11px] whitespace-pre-wrap break-words">
                      {JSON.stringify(log.old_value, null, 2)}
                    </pre>
                  </div>
                )}

                {log.new_value && (
                  <div>
                    <div className="text-muted-foreground mb-1">Стало:</div>
                    <pre className="bg-black/20 rounded p-2 overflow-x-auto max-w-full text-[11px] whitespace-pre-wrap break-words">
                      {JSON.stringify(log.new_value, null, 2)}
                    </pre>
                  </div>
                )}

                {log.old_value && log.action !== 'rollback' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full h-8 text-[12px] gap-1.5 mt-2"
                    onClick={() => handleRollback(log.id, log.old_value)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Откатить на эту версию
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 text-[12px]"
        onClick={() => setExpandedId(null)}
      >
        Свернуть все
      </Button>
    </div>
  );
}
