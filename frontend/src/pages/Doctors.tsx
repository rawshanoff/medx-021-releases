import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { History as HistoryIcon, Plus, Save, Trash2, User, UserPlus, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/modal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import type { DoctorAdmin } from '../types/doctors';

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
      console.error('Failed to load history', e);
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
      console.error(e);
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
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="px-3 text-[13px]"
          type="button"
          onClick={() => setHistoryOpen(true)}
        >
          <HistoryIcon size={14} /> {t('doctors.history_log', { defaultValue: 'История' })}
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

      <Modal
        open={createOpen}
        title={t('doctors.add_doctor', { defaultValue: 'Добавить врача' })}
        description={t('doctors.add_doctor_desc', {
          defaultValue: 'Заполните данные врача и префикс очереди (1 буква).',
        })}
        onClose={() => setCreateOpen(false)}
        width={860}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1.2fr_0.7fr]">
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

      <div className="min-h-0 flex-1 overflow-auto space-y-2">
        {loading ? (
          <div className="text-[13px] text-muted-foreground">{t('common.loading')}</div>
        ) : null}
        {doctorsSorted.map((doc) => (
          <DoctorCard
            key={doc.id}
            doctor={doc}
            onUpdate={fetchDoctors}
            onDelete={() => handleDeleteDoctor(doc.id, doc.full_name)}
            addLog={addLog}
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

function DoctorCard({
  doctor,
  onUpdate,
  onDelete,
  addLog,
}: {
  doctor: DoctorAdmin;
  onUpdate: () => void;
  onDelete: () => void;
  addLog: (a: string, d: string) => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const currency = t('common.currency');

  // Service Management State
  const [addSvcOpen, setAddSvcOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [servicesPage, setServicesPage] = useState(0);
  const servicesPageSize = 6;
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState(1000);
  const [svcPriority, setSvcPriority] = useState(0);

  // Edit Doctor Modal
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(doctor.full_name);
  const [editSpec, setEditSpec] = useState(doctor.specialty);
  const [editPrefix, setEditPrefix] = useState(doctor.queue_prefix || '');

  const handleAddService = async () => {
    if (!svcName) return;
    try {
      await client.post(`/doctors/${doctor.id}/services`, {
        name: svcName,
        price: Number(svcPrice),
        priority: Number(svcPriority),
      });
      setAddSvcOpen(false);
      setSvcName('');
      onUpdate();
      addLog('Add Service', `Added ${svcName} to ${doctor.full_name}`);
      showToast(t('doctors.service_added', { defaultValue: 'Услуга добавлена' }), 'success');
    } catch (e) {
      showToast(
        t('doctors.service_add_failed', { defaultValue: 'Не удалось добавить услугу' }),
        'error',
      );
    }
  };

  const handleDeleteService = async (serviceId: number, serviceName: string) => {
    if (!confirm(`${t('common.delete', { defaultValue: 'Удалить' })}: ${serviceName}?`)) return;
    try {
      await client.delete(`/doctors/services/${serviceId}`);
      onUpdate();
      await addLog('Delete Service', `Deleted ${serviceName}`);
      showToast(t('doctors.service_deleted', { defaultValue: 'Услуга удалена' }), 'success');
    } catch (e) {
      showToast(
        t('doctors.service_delete_failed', { defaultValue: 'Не удалось удалить услугу' }),
        'error',
      );
    }
  };

  const handleUpdateDoctor = async () => {
    try {
      const prefix = String(editPrefix || '')
        .trim()
        .toUpperCase();
      if (!prefix) {
        showToast(
          t('doctors.prefix_required', { defaultValue: 'Префикс очереди обязателен (1 буква)' }),
          'warning',
        );
        return;
      }
      await client.put(`/doctors/${doctor.id}`, {
        full_name: editName,
        specialty: editSpec,
        queue_prefix: prefix.slice(0, 1),
      });
      setEditOpen(false);
      onUpdate();
      addLog('Update Doctor', `Updated ${doctor.full_name} -> ${editName}`);
      showToast(t('doctors.updated', { defaultValue: 'Данные врача обновлены' }), 'success');
    } catch (e) {
      showToast(t('doctors.update_failed', { defaultValue: 'Не удалось обновить врача' }), 'error');
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-secondary/60 text-muted-foreground">
            <User size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="max-w-[520px] truncate text-[15px] font-medium leading-[20px]">
                {doctor.full_name}
              </div>
              <span className="rounded-sm bg-primary px-2 py-0.5 text-[13px] font-medium text-primary-foreground">
                {doctor.queue_prefix}
              </span>
            </div>
            <div className="mt-0.5 text-[13px] text-muted-foreground">{doctor.specialty}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            type="button"
            title={t('common.edit', { defaultValue: 'Редактировать' })}
            onClick={() => setEditOpen(true)}
          >
            <Pencil size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            type="button"
            title={t('common.delete', { defaultValue: 'Удалить' })}
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className="mt-2 border-t border-border pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[14px] font-medium">{t('doctors.services_pricing')}</div>
          <div className="flex flex-wrap gap-2">
            {doctor.services.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="px-3 text-[13px]"
                type="button"
                onClick={() => {
                  setServicesOpen(true);
                  setServicesPage(0);
                }}
              >
                {t('doctors.all_services', { defaultValue: 'Все услуги' })} (
                {doctor.services.length})
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              className="px-3 text-[13px]"
              type="button"
              onClick={() => setAddSvcOpen(true)}
            >
              <Plus size={14} /> {t('doctors.add_service', { defaultValue: 'Добавить услугу' })}
            </Button>
          </div>
        </div>

        <div className="mt-2 grid gap-2">
          {doctor.services.length === 0 ? (
            <div className="text-[13px] italic text-muted-foreground">
              {t('doctors.no_services', { defaultValue: 'Нет услуг' })}
            </div>
          ) : (
            doctor.services
              .slice()
              .sort((a, b) => b.priority - a.priority)
              .slice(0, 3)
              .map((svc) => (
                <div
                  key={svc.id || svc.name}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{svc.name}</div>
                    <div className="text-[13px] text-muted-foreground">
                      {t('doctors.priority', { defaultValue: 'Приоритет' })}:{' '}
                      <span className="font-medium text-foreground">{svc.priority}</span>
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-[14px] font-semibold">
                    {svc.price.toLocaleString()} {currency}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <Modal
        open={servicesOpen}
        title={t('doctors.services_pricing', { defaultValue: 'Услуги и цены' })}
        description={t('doctors.services_desc', {
          defaultValue: 'Список услуг врача (постранично, без скролла).',
        })}
        onClose={() => setServicesOpen(false)}
        width={920}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[14px] font-medium">{doctor.full_name}</div>
          <Button
            variant="secondary"
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={() => setAddSvcOpen(true)}
          >
            <Plus size={14} /> {t('doctors.add_service', { defaultValue: 'Добавить услугу' })}
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-[14px]">
            <thead className="bg-secondary text-[13px] text-muted-foreground">
              <tr className="h-12 [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-medium">
                <th>{t('doctors.service_name', { defaultValue: 'Услуга' })}</th>
                <th className="w-[120px]">
                  {t('doctors.priority', { defaultValue: 'Приоритет' })}
                </th>
                <th className="w-[160px] text-right">
                  {t('doctors.price', { defaultValue: 'Цена' })}
                </th>
                <th className="w-[90px] text-right">
                  {t('common.actions', { defaultValue: 'Действия' })}
                </th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-border">
              {doctor.services
                .slice()
                .sort((a, b) => b.priority - a.priority)
                .slice(
                  servicesPage * servicesPageSize,
                  servicesPage * servicesPageSize + servicesPageSize,
                )
                .map((svc) => (
                  <tr key={svc.id} className="h-12 [&>td]:px-3 [&>td]:py-2.5">
                    <td className="truncate">{svc.name}</td>
                    <td className="font-medium">{svc.priority}</td>
                    <td className="text-right font-medium">
                      {svc.price.toLocaleString()} {currency}
                    </td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12"
                        type="button"
                        title={t('common.delete', { defaultValue: 'Удалить' })}
                        onClick={() => handleDeleteService(svc.id!, svc.name)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {doctor.services.length > servicesPageSize ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="px-3 text-[13px]"
              type="button"
              onClick={() => setServicesPage((p) => Math.max(0, p - 1))}
              disabled={servicesPage === 0}
            >
              {t('common.prev', { defaultValue: 'Назад' })}
            </Button>
            <div className="text-[13px] text-muted-foreground">
              {servicesPage + 1} /{' '}
              {Math.max(1, Math.ceil(doctor.services.length / servicesPageSize))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="px-3 text-[13px]"
              type="button"
              onClick={() =>
                setServicesPage((p) =>
                  Math.min(Math.ceil(doctor.services.length / servicesPageSize) - 1, p + 1),
                )
              }
              disabled={servicesPage >= Math.ceil(doctor.services.length / servicesPageSize) - 1}
            >
              {t('common.next', { defaultValue: 'Вперёд' })}
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={editOpen}
        title={t('doctors.edit_doctor', { defaultValue: 'Редактировать врача' })}
        description={t('doctors.edit_doctor_desc', {
          defaultValue: 'Измените ФИО, специальность и префикс очереди.',
        })}
        onClose={() => setEditOpen(false)}
        width={860}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1.2fr_0.7fr]">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.full_name', { defaultValue: 'ФИО' })}
            </label>
            <Input
              className="text-[13px]"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.specialty', { defaultValue: 'Специальность' })}
            </label>
            <Input
              className="text-[13px]"
              value={editSpec}
              onChange={(e) => setEditSpec(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.prefix', { defaultValue: 'Префикс' })}
            </label>
            <Input
              className="h-10 text-[13px] uppercase"
              value={editPrefix}
              onChange={(e) => setEditPrefix(e.target.value)}
              maxLength={1}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={() => setEditOpen(false)}
          >
            {t('common.cancel', { defaultValue: 'Отмена' })}
          </Button>
          <Button
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={handleUpdateDoctor}
            disabled={!editName.trim() || !String(editPrefix || '').trim()}
          >
            {t('common.save', { defaultValue: 'Сохранить' })}
          </Button>
        </div>
      </Modal>

      <Modal
        open={addSvcOpen}
        title={t('doctors.add_service', { defaultValue: 'Добавить услугу' })}
        description={t('doctors.add_service_desc', {
          defaultValue: 'Добавьте услугу и цену для выбранного врача.',
        })}
        onClose={() => setAddSvcOpen(false)}
        width={860}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.service_name', { defaultValue: 'Услуга' })}
            </label>
            <Input
              className="text-[13px]"
              placeholder={t('doctors.service_name', { defaultValue: 'Услуга' })}
              value={svcName}
              onChange={(e) => setSvcName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.price', { defaultValue: 'Цена' })}
            </label>
            <Input
              className="text-[13px]"
              type="number"
              placeholder="1000"
              value={svcPrice}
              onChange={(e) => setSvcPrice(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.priority', { defaultValue: 'Приоритет' })}
            </label>
            <Input
              className="text-[13px]"
              type="number"
              placeholder="0"
              value={svcPriority}
              onChange={(e) => setSvcPriority(Math.max(0, Number(e.target.value)))}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={() => setAddSvcOpen(false)}
          >
            {t('common.cancel', { defaultValue: 'Отмена' })}
          </Button>
          <Button
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={handleAddService}
            disabled={!svcName.trim()}
          >
            <Save size={14} /> {t('common.save', { defaultValue: 'Сохранить' })}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
