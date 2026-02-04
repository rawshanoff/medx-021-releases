import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { History as HistoryIcon, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/modal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import type { DoctorAdmin } from '../types/doctors';
import { loggers } from '../utils/logger';
import { DoctorListItem } from '../features/doctors/DoctorListItem';

interface LogEntry {
  time: string;
  action: string;
  details: string;
}

export default function Doctors() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [doctors, setDoctors] = useState<DoctorAdmin[]>([]);
  const [loading, setLoading] = useState(false);

  // Create Doctor Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocSpec, setNewDocSpec] = useState('');
  const [newDocPrefix, setNewDocPrefix] = useState(''); // Added prefix state
  const [newDocRoom, setNewDocRoom] = useState('');

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const historyPageSize = 10;

  const doctorsSorted = useMemo(() => {
    return [...doctors].sort((a, b) =>
      String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ru'),
    );
  }, [doctors]);

  useEffect(() => {
    fetchDoctors();
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await client.get('/doctors/history');
      setLogs(res.data);
    } catch (e) {
      loggers.doctors.error('Failed to load history', e);
    }
  };

  const addLog = async (_action: string, _details: string) => {
    // Server logs automatically; just refresh
    await fetchHistory();
  };

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const res = await client.get('/doctors/');
      setDoctors(res.data);
    } catch (e) {
      loggers.doctors.error('Failed to load doctors', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDoctor = async () => {
    if (!newDocName) return;
    try {
      const payload: Record<string, unknown> = {
        full_name: newDocName,
        specialty: newDocSpec,
        room_number: newDocRoom.trim() || undefined,
        is_active: true,
        services: [],
      };
      const prefix = String(newDocPrefix || '')
        .trim()
        .toUpperCase();
      if (prefix) payload.queue_prefix = prefix.slice(0, 1);

      await client.post('/doctors/', payload);
      setCreateOpen(false);
      setNewDocName('');
      setNewDocSpec('');
      setNewDocPrefix('');
      setNewDocRoom('');
      fetchDoctors();
      addLog('Create Doctor', `Created ${newDocName} (Prefix: ${newDocPrefix})`);
      showToast(t('doctors.created', { defaultValue: 'Врач создан' }), 'success');
    } catch (e) {
      showToast(t('doctors.create_failed', { defaultValue: 'Не удалось создать врача' }), 'error');
    }
  };

  const handleDeleteDoctor = async (id: number, name: string) => {
    if (!confirm(`${t('common.delete', { defaultValue: 'Удалить' })}?`)) return;
    try {
      await client.delete(`/doctors/${id}`);
      fetchDoctors();
      addLog('Delete Doctor', `Deleted ${name}`);
      showToast(t('doctors.deleted', { defaultValue: 'Врач удалён' }), 'success');
    } catch (e) {
      showToast(t('common.failed', { defaultValue: 'Ошибка' }), 'error');
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
            {t('doctors.title', { defaultValue: 'Врачи' })}
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('doctors.subtitle', { defaultValue: 'Управляйте врачами и их услугами.' })}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-md"
            type="button"
            onClick={() => setHistoryOpen(true)}
            title={t('doctors.history_log', { defaultValue: 'История' })}
          >
            <HistoryIcon size={16} />
          </Button>
          <Button
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            <UserPlus size={14} /> {t('doctors.add_doctor', { defaultValue: 'Добавить врача' })}
          </Button>
        </div>
      </div>

      <Modal
        open={createOpen}
        title={t('doctors.add_doctor', { defaultValue: 'Добавить врача' })}
        description={t('doctors.add_doctor_desc', {
          defaultValue: 'Заполните данные врача и префикс очереди (1 буква).',
        })}
        onClose={() => setCreateOpen(false)}
        width={860}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1.2fr_0.7fr_0.9fr]">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.full_name', { defaultValue: 'ФИО' })}
            </label>
            <Input
              placeholder={`${t('reception.first_name', { defaultValue: 'Имя' })} ${t('reception.last_name', { defaultValue: 'Фамилия' })}`}
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.specialty', { defaultValue: 'Специальность' })}
            </label>
            <Input
              className="text-[13px]"
              placeholder={t('doctors.specialty', { defaultValue: 'Специальность' })}
              value={newDocSpec}
              onChange={(e) => setNewDocSpec(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.prefix', { defaultValue: 'Префикс' })}
            </label>
            <Input
              className="h-10 text-[13px] uppercase"
              placeholder={t('doctors.prefix_placeholder', { defaultValue: 'A' })}
              value={newDocPrefix}
              onChange={(e) => setNewDocPrefix(e.target.value)}
              maxLength={1}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.room_number', { defaultValue: 'Кабинет' })}
            </label>
            <Input
              className="h-10 text-[13px]"
              placeholder={t('doctors.room_number_placeholder', { defaultValue: 'Напр. 3' })}
              value={newDocRoom}
              onChange={(e) => setNewDocRoom(e.target.value)}
              maxLength={32}
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={() => setCreateOpen(false)}
          >
            {t('common.cancel', { defaultValue: 'Отмена' })}
          </Button>
          <Button
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={handleCreateDoctor}
            disabled={!newDocName.trim()}
          >
            {t('common.save', { defaultValue: 'Сохранить' })}
          </Button>
        </div>
      </Modal>

      <div className="min-h-0 flex-1 overflow-auto space-y-3">
        {loading ? (
          <div className="text-[13px] text-muted-foreground">{t('common.loading')}</div>
        ) : null}
        {doctorsSorted.map((doc) => (
          <DoctorListItem
            key={doc.id}
            doctor={doc}
            onRefresh={fetchDoctors}
            onDeleteDoctor={() => handleDeleteDoctor(doc.id, doc.full_name)}
          />
        ))}
      </div>

      <Modal
        open={historyOpen}
        title={t('doctors.history_log', { defaultValue: 'История' })}
        description={t('doctors.history_desc', {
          defaultValue: 'Последние изменения по врачам и услугам.',
        })}
        onClose={() => {
          setHistoryOpen(false);
          setHistoryPage(0);
        }}
        width={920}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={fetchHistory}
          >
            {t('common.refresh', { defaultValue: 'Обновить' })}
          </Button>
        </div>

        <div className="rounded-md border border-border bg-card p-3">
          {logs.length === 0 ? (
            <div className="text-[13px] text-muted-foreground">
              {t('doctors.log_placeholder', { defaultValue: 'Пока нет событий' })}
            </div>
          ) : (
            <div className="grid">
              {logs
                .slice(
                  historyPage * historyPageSize,
                  historyPage * historyPageSize + historyPageSize,
                )
                .map((log, i) => (
                  <div
                    key={`${historyPage}-${i}`}
                    className="border-b border-border py-2 text-[14px] last:border-b-0"
                  >
                    <span className="mr-2 text-[13px] text-muted-foreground">[{log.time}]</span>
                    <span className="font-medium">{log.action}:</span> {log.details}
                  </div>
                ))}
            </div>
          )}
        </div>
        {logs.length > historyPageSize ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="px-3 text-[13px]"
              type="button"
              onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
              disabled={historyPage === 0}
            >
              {t('common.prev', { defaultValue: 'Назад' })}
            </Button>
            <div className="text-[13px] text-muted-foreground">
              {historyPage + 1} / {Math.max(1, Math.ceil(logs.length / historyPageSize))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="px-3 text-[13px]"
              type="button"
              onClick={() =>
                setHistoryPage((p) => Math.min(Math.ceil(logs.length / historyPageSize) - 1, p + 1))
              }
              disabled={historyPage >= Math.ceil(logs.length / historyPageSize) - 1}
            >
              {t('common.next', { defaultValue: 'Вперёд' })}
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
