import { useEffect, useMemo, useRef, useState } from 'react';
import client from '../../api/client';
import { ChevronDown, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import type { DoctorAdmin, Service } from '../../types/doctors';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/cn';

function initials(fullName: string) {
  const s = String(fullName || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

function priorityMeta(priority: number) {
  const p = Number(priority) || 0;
  if (p >= 7) {
    return {
      label: 'High',
      className:
        'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200',
    };
  }
  if (p >= 3) {
    return {
      label: 'Medium',
      className:
        'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
    };
  }
  return {
    label: 'Low',
    className:
      'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-200',
  };
}

export function DoctorListItem({
  doctor,
  onRefresh,
  onDeleteDoctor,
}: {
  doctor: DoctorAdmin;
  onRefresh: () => void;
  onDeleteDoctor: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [maxH, setMaxH] = useState<number>(0);

  // Modals
  const [editDoctorOpen, setEditDoctorOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Doctor edit form
  const [editName, setEditName] = useState(doctor.full_name);
  const [editSpec, setEditSpec] = useState(doctor.specialty || '');
  const [editPrefix, setEditPrefix] = useState(doctor.queue_prefix || '');
  const [editRoom, setEditRoom] = useState(doctor.room_number || '');

  // Service form
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState<string>('1000');
  const [svcPriority, setSvcPriority] = useState<string>('0');

  const currency = t('common.currency', { defaultValue: "so'm" });

  const activeServices = useMemo(() => {
    // Backend should filter out soft-deleted services, but keep UI defensive.
    const list = Array.isArray(doctor.services) ? doctor.services : [];
    return list
      .filter((s) => s && (s as any).deleted_at == null)
      .slice()
      .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  }, [doctor.services]);

  const subtitle = useMemo(() => {
    const spec = String(doctor.specialty || '').trim();
    if (spec) return spec;
    const n = activeServices.length;
    return t('doctors.active_services_count', {
      defaultValue: `${n} активных услуг`,
      count: n as any,
    });
  }, [doctor.specialty, activeServices.length, t]);

  useEffect(() => {
    if (!open) {
      setMaxH(0);
      return;
    }
    const el = bodyRef.current;
    if (!el) return;

    const measure = () => setMaxH(el.scrollHeight);
    measure();

    // Keep height updated when fonts load / content changes.
    if (typeof (window as any).ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, doctor.id, activeServices.length]);

  const openAddService = () => {
    setEditingService(null);
    setSvcName('');
    setSvcPrice('1000');
    setSvcPriority('0');
    setServiceModalOpen(true);
  };

  const openEditService = (svc: Service) => {
    setEditingService(svc);
    setSvcName(String(svc.name || ''));
    setSvcPrice(String(Number(svc.price) || 0));
    setSvcPriority(String(Number(svc.priority) || 0));
    setServiceModalOpen(true);
  };

  const handleSaveDoctor = async () => {
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
        room_number: editRoom.trim() || null,
        queue_prefix: prefix.slice(0, 1),
      });
      setEditDoctorOpen(false);
      onRefresh();
      showToast(t('doctors.updated', { defaultValue: 'Данные врача обновлены' }), 'success');
    } catch (e) {
      showToast(t('doctors.update_failed', { defaultValue: 'Не удалось обновить врача' }), 'error');
    }
  };

  const handleDeleteService = async (svc: Service) => {
    const serviceId = svc.id;
    if (!serviceId) return;
    if (!confirm(`${t('common.delete', { defaultValue: 'Удалить' })}: ${svc.name}?`)) return;
    try {
      await client.delete(`/doctors/services/${serviceId}`);
      onRefresh();
      showToast(t('doctors.service_deleted', { defaultValue: 'Услуга удалена' }), 'success');
    } catch (e) {
      showToast(
        t('doctors.service_delete_failed', { defaultValue: 'Не удалось удалить услугу' }),
        'error',
      );
    }
  };

  const handleSaveService = async () => {
    if (!svcName.trim()) return;
    try {
      if (editingService?.id) {
        await client.put(`/doctors/services/${editingService.id}`, {
          name: svcName,
          price: Number(svcPrice || 0),
          priority: Number(svcPriority || 0),
        });
        showToast(t('doctors.service_updated', { defaultValue: 'Услуга обновлена' }), 'success');
      } else {
        await client.post(`/doctors/${doctor.id}/services`, {
          name: svcName,
          price: Number(svcPrice || 0),
          priority: Number(svcPriority || 0),
        });
        showToast(t('doctors.service_added', { defaultValue: 'Услуга добавлена' }), 'success');
      }
      setServiceModalOpen(false);
      setEditingService(null);
      onRefresh();
    } catch (e) {
      showToast(
        t('doctors.service_save_failed', { defaultValue: 'Не удалось сохранить услугу' }),
        'error',
      );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            {initials(doctor.full_name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
              {doctor.full_name}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="truncate">{subtitle}</span>
              {doctor.room_number ? (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900/30">
                  {t('doctors.room', { defaultValue: 'Каб.' })} {doctor.room_number}
                </span>
              ) : null}
              {doctor.queue_prefix ? (
                <span className="rounded-md border border-blue-600/30 bg-blue-600/10 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                  {doctor.queue_prefix}
                </span>
              ) : null}
            </div>
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-md"
            type="button"
            title={t('common.edit', { defaultValue: 'Редактировать' })}
            onClick={() => setEditDoctorOpen(true)}
          >
            <Pencil size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-md text-destructive hover:text-destructive"
            type="button"
            title={t('common.delete', { defaultValue: 'Удалить' })}
            onClick={onDeleteDoctor}
          >
            <Trash2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-9 w-9 rounded-md transition-transform', open ? 'rotate-180' : '')}
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown size={16} />
          </Button>
        </div>
      </div>

      {/* Body (AnimateHeight via max-height) */}
      <div
        className={cn(
          'overflow-hidden border-t border-slate-200/80 dark:border-slate-700/60',
          'transition-[max-height] duration-300 ease-in-out motion-reduce:transition-none',
        )}
        style={{ maxHeight: open ? maxH : 0 }}
        aria-hidden={!open}
      >
        <div ref={bodyRef} className="p-4">
          <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-slate-900/30">
                <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left">
                  <th>{t('doctors.service_name', { defaultValue: 'Услуга' })}</th>
                  <th className="w-[140px]">
                    {t('doctors.priority', { defaultValue: 'Приоритет' })}
                  </th>
                  <th className="w-[160px] text-right">
                    {t('doctors.price', { defaultValue: 'Цена' })}
                  </th>
                  <th className="w-[96px] text-right">
                    {t('common.actions', { defaultValue: 'Действия' })}
                  </th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-slate-200/80 dark:[&>tr]:border-slate-800">
                {activeServices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-sm text-muted-foreground">
                      {t('doctors.no_services', { defaultValue: 'Нет услуг' })}
                    </td>
                  </tr>
                ) : (
                  activeServices.map((svc) => {
                    const meta = priorityMeta(Number(svc.priority) || 0);
                    return (
                      <tr key={svc.id || svc.name} className="group">
                        <td className="px-3 py-3">
                          <div className="truncate font-medium text-foreground">{svc.name}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                              meta.className,
                            )}
                            title={`${t('doctors.priority', { defaultValue: 'Приоритет' })}: ${svc.priority}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">
                          {Number(svc.price || 0).toLocaleString()} {currency}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-md"
                              type="button"
                              title={t('common.edit', { defaultValue: 'Редактировать' })}
                              onClick={() => openEditService(svc)}
                            >
                              <Pencil size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-md text-destructive hover:text-destructive"
                              type="button"
                              title={t('common.delete', { defaultValue: 'Удалить' })}
                              onClick={() => handleDeleteService(svc)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <Button
              variant="ghost"
              type="button"
              className={cn(
                'w-full justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-transparent text-sm',
                'hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900/30',
              )}
              onClick={openAddService}
            >
              <Plus size={16} /> {t('doctors.add_service', { defaultValue: 'Добавить услугу' })}
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Doctor Modal */}
      <Modal
        open={editDoctorOpen}
        title={t('doctors.edit_doctor', { defaultValue: 'Редактировать врача' })}
        description={t('doctors.edit_doctor_desc', {
          defaultValue: 'Измените ФИО, специальность и префикс очереди.',
        })}
        onClose={() => setEditDoctorOpen(false)}
        width={860}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1.2fr_0.7fr_0.9fr]">
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
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('doctors.room_number', { defaultValue: 'Кабинет' })}
            </label>
            <Input
              className="h-10 text-[13px]"
              value={editRoom}
              onChange={(e) => setEditRoom(e.target.value)}
              maxLength={32}
              placeholder={t('doctors.room_number_placeholder', { defaultValue: 'Напр. 3' })}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={() => setEditDoctorOpen(false)}
          >
            {t('common.cancel', { defaultValue: 'Отмена' })}
          </Button>
          <Button
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={handleSaveDoctor}
            disabled={!editName.trim() || !String(editPrefix || '').trim()}
          >
            {t('common.save', { defaultValue: 'Сохранить' })}
          </Button>
        </div>
      </Modal>

      {/* Add/Edit Service Modal */}
      <Modal
        open={serviceModalOpen}
        title={
          editingService
            ? t('doctors.edit_service', { defaultValue: 'Редактировать услугу' })
            : t('doctors.add_service', { defaultValue: 'Добавить услугу' })
        }
        description={t('doctors.add_service_desc', {
          defaultValue: 'Добавьте услугу и цену для выбранного врача.',
        })}
        onClose={() => {
          setServiceModalOpen(false);
          setEditingService(null);
        }}
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
              onChange={(e) => setSvcPrice(e.target.value)}
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
              onChange={(e) => setSvcPriority(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={() => {
              setServiceModalOpen(false);
              setEditingService(null);
            }}
          >
            {t('common.cancel', { defaultValue: 'Отмена' })}
          </Button>
          <Button
            size="sm"
            className="px-3 text-[13px]"
            type="button"
            onClick={handleSaveService}
            disabled={!svcName.trim()}
          >
            <Save size={14} /> {t('common.save', { defaultValue: 'Сохранить' })}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
