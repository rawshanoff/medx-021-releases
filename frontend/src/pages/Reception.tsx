import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import client from '../api/client';
import { useTranslation } from 'react-i18next';
import MixedPaymentModal from '../components/MixedPaymentModal';
import { useToast } from '../context/ToastContext';
import { getUser } from '../utils/auth';
import { dobUiToIso, normalizeHumanName } from '../utils/text';
import { Modal } from '../components/ui/modal';
import { Button } from '../components/ui/button';
import { QueueSidebar } from '../features/reception/QueueSidebar';
import { PatientSearch } from '../features/reception/PatientSearch';
import { PatientList } from '../features/reception/PatientList';
import { useDoctors } from '../features/reception/hooks/useDoctors';
import { useQueue } from '../features/reception/hooks/useQueue';
import { usePatientsSearch } from '../features/reception/hooks/usePatients';
import type { Patient, PatientHistoryRead } from '../types/patients';
import type { QueueItem } from '../types/reception';
import { loggers } from '../utils/logger';
import {
  defaultPatientRequiredFields,
  getPatientRequiredFields,
  type PatientRequiredFields,
} from '../utils/patientRequiredFields';
import {
  defaultQuickReceiptConfig,
  getQuickReceiptConfig,
  type QuickReceiptConfig,
} from '../utils/quickReceipts';
import { getPrintSettings, printReceipt, saveReceiptForTicket } from '../utils/print';

export default function Reception() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [dob, setDob] = useState('');
  const [requiredFields, setRequiredFields] = useState<PatientRequiredFields>(
    defaultPatientRequiredFields,
  );
  const [receiptRange, setReceiptRange] = useState<'shift' | 'today' | '2days'>('today');
  const [quickConfig, setQuickConfig] = useState<QuickReceiptConfig>(defaultQuickReceiptConfig);

  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const surnameRef = useRef<HTMLInputElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);

  const {
    patients,
    loading,
    refresh: refreshPatients,
    clear: clearPatients,
  } = usePatientsSearch({ phone, name, surname, dob });
  const { doctors } = useDoctors();
  const {
    queue,
    refresh: refreshQueue,
    updateStatus: updateQueueStatusRaw,
  } = useQueue(receiptRange);
  const updateQueueStatus = async (id: number, status: QueueItem['status']) => {
    try {
      await updateQueueStatusRaw(id, status);
    } catch {
      showToast(t('common.error') || 'Ошибка', 'error');
    }
  };
  const [focusPatientId, setFocusPatientId] = useState<number | null>(null);

  // History Modal
  const [historyState, setHistoryState] = useState<{
    patient: Patient;
    loading: boolean;
    data: PatientHistoryRead | null;
    error: string | null;
  } | null>(null);
  const [refundBusyTxId, setRefundBusyTxId] = useState<number | null>(null);

  // UI confirm modals (avoid native `confirm()` in Electron: it can break window focus)
  const [createConfirm, setCreateConfirm] = useState<{
    open: boolean;
    payload: { full_name: string; phone: string; birth_date: string | null };
  } | null>(null);

  const getErrorDetail = (err: unknown): string | null => {
    if (!axios.isAxiosError(err)) return null;
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    return typeof detail === 'string' ? detail : null;
  };

  // Mixed Payment Logic Lifted Logic
  const [mixedModalState, setMixedModalState] = useState<{
    isOpen: boolean;
    total: number;
    onConfirm: (cash: number, card: number, transfer: number) => void | Promise<void>;
    onCancel: () => void;
    initialSplit?: { cash?: number; card?: number; transfer?: number };
    readOnly?: boolean;
    title?: string;
    confirmLabel?: string;
    description?: string;
    infoText?: string;
  }>({
    isOpen: false,
    total: 0,
    onConfirm: () => {},
    onCancel: () => {},
  });

  const [showShiftModal, setShowShiftModal] = useState(false);

  const anyModalOpenRef = useRef(false);
  useEffect(() => {
    anyModalOpenRef.current = Boolean(historyState) || mixedModalState.isOpen || showShiftModal;
  }, [historyState, mixedModalState.isOpen, showShiftModal]);

  // UX: when Reception is open, typing anywhere should go to phone search.
  useEffect(() => {
    phoneRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If any modal is open, let the modal handle Esc.
        if (anyModalOpenRef.current) return;
        e.preventDefault();
        setPhone('');
        setName('');
        setSurname('');
        setDob('');
        clearPatients();
        phoneRef.current?.focus();
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const isTypingInField =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable);

      // If not typing in any input, redirect printable keys to phone input
      if (!isTypingInField) {
        const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        const isBackspace = e.key === 'Backspace';
        if (isPrintable || isBackspace) {
          e.preventDefault();
          phoneRef.current?.focus();
          if (isBackspace) {
            setPhone((p) => p.slice(0, -1));
          } else {
            setPhone((p) => (p + e.key).slice(0, 32));
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Queue: refresh on mount and when returning to the tab.
  useEffect(() => {
    refreshQueue().catch(() => {});
  }, [refreshQueue]);

  useEffect(() => {
    refreshQueue().catch(() => {});
  }, [receiptRange, refreshQueue]);

  useEffect(() => {
    getPatientRequiredFields()
      .then(setRequiredFields)
      .catch(() => setRequiredFields(defaultPatientRequiredFields));
  }, []);

  useEffect(() => {
    getQuickReceiptConfig()
      .then(setQuickConfig)
      .catch(() => setQuickConfig(defaultQuickReceiptConfig));
  }, []);

  useEffect(() => {
    const onFocus = () => refreshQueue().catch(() => {});
    const onVis = () => {
      if (!document.hidden) onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshQueue]);

  const handleInlineCreate = async () => {
    const isPhoneOk = !requiredFields.phone || Boolean(String(phone || '').trim());
    const isNameOk = !requiredFields.firstName || Boolean(String(name || '').trim());
    const isSurnameOk = !requiredFields.lastName || Boolean(String(surname || '').trim());
    const isDobOk = !requiredFields.birthDate || Boolean(String(dob || '').trim());
    if (!isPhoneOk || !isNameOk || !isSurnameOk || !isDobOk) {
      showToast(t('reception.fill_required'), 'warning');
      return;
    }

    const fullName = normalizeHumanName((name + ' ' + surname).trim());
    setCreateConfirm({
      open: true,
      payload: {
        full_name: fullName,
        phone: phone,
        birth_date: dobUiToIso(dob) || null,
      },
    });
  };

  const errorMessageIsShiftRelated = useCallback((msg: string) => {
    return msg.toLowerCase().includes('shift') || msg.toLowerCase().includes('active');
  }, []);

  const createQuickPatient = useCallback(async () => {
    const seed = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const digits = seed.slice(-9).padStart(9, '0');
    const phone = `+998${digits}`;
    const res = await client.post('/patients/', {
      full_name: t('reception.quick_patient_name', { defaultValue: 'Пациент' }),
      phone,
      birth_date: null,
    });
    return res.data as Patient;
  }, [t]);

  const runQuickReceipt = useCallback(
    async (binding: {
      doctorId: number | null;
      serviceId: number | null;
      paymentMethod: 'CASH' | 'CARD' | 'TRANSFER';
    }) => {
      if (!binding.doctorId || !binding.serviceId) return;
      try {
        const doctor = doctors.find((d) => d.id === binding.doctorId);
        const service = doctor?.services?.find((s) => s.id === binding.serviceId);
        if (!doctor || !service) return;

        const patient = await createQuickPatient();
        const transactionData = {
          patient_id: patient.id,
          amount: service.price,
          doctor_id: String(doctor.id),
          payment_method: binding.paymentMethod,
          description: service.name,
          idempotency_key: crypto.randomUUID(),
        };

        const txRes = await client.post('/finance/transactions', transactionData);

        const ticket = await addToQueue(patient.id, patient.full_name, Number(doctor.id));

        try {
          const loadedSettings = await getPrintSettings();
          const settings = { ...loadedSettings, autoPrint: true };
          const nowIso = new Date().toISOString();
          const payload = {
            receiptNo: String(txRes?.data?.id ?? txRes?.data?.tx_id ?? 'AA-000000'),
            ticket,
            createdAtIso: nowIso,
            patientName: patient.full_name,
            doctorName: doctor.full_name,
            doctorRoom: doctor.room_number ?? undefined,
            serviceName: service.name,
            amount: service.price,
            currency: t('common.currency'),
            paymentMethod: binding.paymentMethod,
          };
          saveReceiptForTicket(ticket, payload);
          printReceipt(payload, settings);
        } catch {
          // ignore printing errors
        }
      } catch (e: any) {
        const detail = e?.response?.data?.detail;
        if (typeof detail === 'string' && errorMessageIsShiftRelated(detail)) {
          setShowShiftModal(true);
          return;
        }
        showToast(t('common.error', { defaultValue: 'Ошибка' }), 'error');
      }
    },
    [addToQueue, createQuickPatient, doctors, errorMessageIsShiftRelated, showToast, t],
  );

  const quickBindingsByDoctor = useMemo(() => {
    const groups = new Map<number, typeof quickConfig.bindings>();
    for (const b of quickConfig.bindings) {
      if (!b.doctorId) continue;
      const list = groups.get(b.doctorId) || [];
      list.push(b);
      groups.set(b.doctorId, list);
    }
    return groups;
  }, [quickConfig.bindings]);

  async function addToQueue(patientId: number, patientName: string, doctorId: number) {
    try {
      const payload = {
        patient_name: patientName,
        patient_id: patientId,
        doctor_id: doctorId,
        status: 'WAITING',
      };
      const res = await client.post('/reception/queue', payload);
      await refreshQueue();
      showToast(`Добавлен в очередь: ${res.data.ticket_number}`, 'success');
      return res.data.ticket_number;
    } catch (e) {
      const errorMsg =
        getErrorDetail(e) ||
        t('reception.queue_add_failed', { defaultValue: 'Не удалось добавить в очередь' });
      showToast(errorMsg, 'error');
      loggers.reception.error('Failed to add to queue', e);
      return '';
    }
  }

  useEffect(() => {
    if (!quickConfig.enabled || quickConfig.bindings.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const match = quickConfig.bindings.find((b) => b.hotkey === e.key);
      if (!match) return;
      e.preventDefault();
      void runQuickReceipt(match);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickConfig, runQuickReceipt]);

  const openMixedModal = (
    total: number,
    onConfirm: (c: number, cd: number, t: number) => void | Promise<void>,
    onCancel: () => void,
  ) => {
    setMixedModalState({
      isOpen: true,
      total,
      onConfirm,
      onCancel,
      initialSplit: undefined,
      readOnly: false,
      title: undefined,
      confirmLabel: undefined,
      description: undefined,
    });
  };

  const handleOpenShift = async () => {
    try {
      const cashier = getUser()?.username || 'Admin';
      await client.post('/finance/shifts/open', { cashier_id: cashier });
      setShowShiftModal(false);
      showToast(t('finance.shift_open', { id: 'New' }), 'success');
    } catch (e) {
      showToast(
        t('finance.shift_open_fail', { defaultValue: 'Не удалось открыть смену' }),
        'error',
      );
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="min-h-0 flex-1">
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_340px] gap-3">
          {/* LEFT */}
          <div className="flex min-h-0 flex-col gap-3">
            {quickConfig.enabled ? (
              <div className="rounded-md border border-slate-200 bg-card p-3 dark:border-slate-800">
                <div className="mb-2 text-sm font-semibold">
                  {t('reception.quick_receipts', { defaultValue: 'Быстрые чеки' })}
                </div>
                <div className="grid gap-3">
                  {Array.from(quickBindingsByDoctor.entries()).map(([doctorId, bindings]) => {
                    const doctor = doctors.find((d) => d.id === doctorId);
                    if (!doctor) return null;
                    return (
                      <div
                        key={doctorId}
                        className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-slate-900/30"
                      >
                        <div className="mb-2 text-sm font-semibold">{doctor.full_name}</div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {bindings.map((b) => {
                            const service = doctor.services?.find((s) => s.id === b.serviceId);
                            const label =
                              service?.name || t('reception.service', { defaultValue: 'Услуга' });
                            const paymentLabel =
                              b.paymentMethod === 'CARD'
                                ? t('reception.card', { defaultValue: 'Карта' })
                                : b.paymentMethod === 'TRANSFER'
                                  ? t('reception.transfer', { defaultValue: 'Перевод' })
                                  : t('reception.cash', { defaultValue: 'Наличные' });
                            const colorClass =
                              b.paymentMethod === 'CARD'
                                ? '!bg-blue-600 hover:!bg-blue-500'
                                : b.paymentMethod === 'TRANSFER'
                                  ? '!bg-violet-600 hover:!bg-violet-500'
                                  : '!bg-emerald-600 hover:!bg-emerald-500';
                            return (
                              <Button
                                key={b.id}
                                type="button"
                                variant="ghost"
                                className={`h-12 justify-between px-3 text-sm !text-white ${colorClass}`}
                                onClick={() => runQuickReceipt(b)}
                              >
                                <span className="truncate">{label}</span>
                                <span className="text-xs opacity-90">
                                  {paymentLabel} • {b.hotkey}
                                </span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Search */}
            <PatientSearch
              phone={phone}
              setPhone={setPhone}
              name={name}
              setName={setName}
              surname={surname}
              setSurname={setSurname}
              dob={dob}
              setDob={setDob}
              phoneRef={phoneRef}
              nameRef={nameRef}
              surnameRef={surnameRef}
              dobRef={dobRef}
              createBtnRef={createBtnRef}
              canCreate={
                (!requiredFields.phone || Boolean(String(phone || '').trim())) &&
                (!requiredFields.firstName || Boolean(String(name || '').trim())) &&
                (!requiredFields.lastName || Boolean(String(surname || '').trim())) &&
                (!requiredFields.birthDate || Boolean(String(dob || '').trim()))
              }
              onCreate={handleInlineCreate}
              onFocusFirstResult={() => {
                if (patients.length > 0) setFocusPatientId(patients[0].id);
              }}
            />

            {/* Results */}
            <PatientList
              patients={patients}
              loading={loading}
              hasSearch={Boolean(phone || name || surname || dob)}
              doctors={doctors}
              addToQueue={addToQueue}
              onViewHistory={async (p) => {
                setHistoryState({ patient: p, loading: true, data: null, error: null });
                try {
                  const res = await client.get(`/patients/${p.id}/history`);
                  setHistoryState({ patient: p, loading: false, data: res.data, error: null });
                } catch (e: unknown) {
                  setHistoryState({
                    patient: p,
                    loading: false,
                    data: null,
                    error:
                      getErrorDetail(e) ||
                      t('reception.history_load_failed', {
                        defaultValue: 'Не удалось загрузить историю',
                      }),
                  });
                }
              }}
              onRequestMixedPayment={openMixedModal}
              onShiftError={() => setShowShiftModal(true)}
              focusPatientId={focusPatientId}
              clearFocus={() => setFocusPatientId(null)}
            />
          </div>

          {/* RIGHT (Queue) */}
          <QueueSidebar
            queue={queue}
            onUpdateStatus={updateQueueStatus}
            receiptRange={receiptRange}
            onReceiptRangeChange={setReceiptRange}
          />
        </div>
      </div>

      {/* History Right Sheet */}
      {historyState
        ? createPortal(
            <div
              className="fixed z-[9999] flex p-0 bg-black/40 backdrop-blur-sm"
              style={{ top: 0, right: 0, bottom: 0, left: 0 }}
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setHistoryState(null);
              }}
            >
              <div
                className="ml-auto flex h-full w-[min(420px,100vw)] flex-col border-l border-slate-200 bg-card shadow-2xl dark:border-slate-800"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {t('reception.history', { defaultValue: 'История' })}:{' '}
                      {historyState.patient.full_name}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {historyState.patient.phone}
                      {historyState.patient.birth_date
                        ? ` • ${historyState.patient.birth_date}`
                        : ''}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-md"
                    type="button"
                    aria-label={t('common.close', { defaultValue: 'Закрыть' })}
                    onClick={() => setHistoryState(null)}
                  >
                    ×
                  </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {historyState.loading ? (
                    <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
                  ) : null}
                  {historyState.error ? (
                    <div className="text-sm text-destructive">{historyState.error}</div>
                  ) : null}

                  {!historyState.loading && !historyState.error ? (
                    <div className="space-y-3">
                      {(historyState.data?.transactions ?? []).length === 0 ? (
                        <div className="text-sm text-muted-foreground">—</div>
                      ) : null}

                      {(historyState.data?.transactions ?? []).map((tx) => {
                        const txTime = new Date(tx.created_at).getTime();
                        const relatedQueueItem = historyState.data?.queue?.find((qi) => {
                          const qiTime = new Date(qi.created_at).getTime();
                          const timeDiff = Math.abs(txTime - qiTime);
                          return qi.status === 'WAITING' && timeDiff < 5 * 60 * 1000;
                        });
                        const refundTx = historyState.data?.transactions?.find(
                          (t) => t.related_transaction_id === tx.id,
                        );
                        const isRefunded = Boolean(refundTx);
                        const canShowRefundButton = tx.amount > 0 && relatedQueueItem != null;
                        const totalAbs = Math.abs(Number(tx.amount || 0));
                        const split =
                          tx.payment_method === 'MIXED'
                            ? {
                                cash: Math.abs(Number(tx.cash_amount || 0)),
                                card: Math.abs(Number(tx.card_amount || 0)),
                                transfer: Math.abs(Number(tx.transfer_amount || 0)),
                              }
                            : tx.payment_method === 'CARD'
                              ? { card: totalAbs }
                              : tx.payment_method === 'TRANSFER'
                                ? { transfer: totalAbs }
                                : { cash: totalAbs };
                        const paymentMethodLabel =
                          tx.payment_method === 'MIXED'
                            ? t('reception.mixed', { defaultValue: 'Смешанная' })
                            : tx.payment_method === 'CARD'
                              ? t('reception.card', { defaultValue: 'Карта' })
                              : tx.payment_method === 'TRANSFER'
                                ? t('reception.transfer', { defaultValue: 'Перевод' })
                                : t('reception.cash', { defaultValue: 'Наличные' });
                        const paymentDetails =
                          tx.payment_method === 'MIXED'
                            ? `${paymentMethodLabel} (${t('reception.cash')}: ${split.cash?.toLocaleString()} ${t('common.currency')}, ${t('reception.card')}: ${split.card?.toLocaleString()} ${t('common.currency')}, ${t('reception.transfer')}: ${split.transfer?.toLocaleString()} ${t('common.currency')})`
                            : paymentMethodLabel;

                        return (
                          <div
                            key={`tx-${tx.id}`}
                            className="rounded-md border border-slate-200 bg-background/40 p-4 dark:border-slate-800"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs text-muted-foreground">
                                {new Date(tx.created_at).toLocaleDateString()}
                              </div>
                              <div className="text-sm font-semibold">
                                {Number(tx.amount || 0).toLocaleString()} {t('common.currency')}
                              </div>
                            </div>
                            <div className="mt-1 text-sm">{tx.description || ''}</div>

                            {canShowRefundButton ? (
                              <div className="mt-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-full rounded-md px-3 text-xs shadow-none hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                                  disabled={refundBusyTxId === tx.id || isRefunded}
                                  onClick={() => {
                                    if (refundBusyTxId || isRefunded) return;
                                    setMixedModalState({
                                      isOpen: true,
                                      total: totalAbs,
                                      initialSplit: split,
                                      readOnly: true,
                                      title: t('reception.refund', { defaultValue: 'Возврат' }),
                                      confirmLabel: t('reception.refund', {
                                        defaultValue: 'Возврат',
                                      }),
                                      description: `${t('reception.total_amount')}: ${totalAbs.toLocaleString()} ${t('common.currency')}`,
                                      infoText: `${t('reception.payment')}: ${paymentDetails}`,
                                      onCancel: () => {},
                                      onConfirm: async () => {
                                        if (refundBusyTxId) return;
                                        setRefundBusyTxId(tx.id);
                                        try {
                                          await client.post(`/finance/refund/${tx.id}`, {
                                            reason: tx.description || 'No reason provided',
                                          });
                                          if (relatedQueueItem) {
                                            await client.patch(
                                              `/reception/queue/${relatedQueueItem.id}`,
                                              {
                                                status: 'REFUNDED',
                                              },
                                            );
                                          }
                                          await refreshQueue();
                                          const res = await client.get(
                                            `/patients/${historyState.patient.id}/history`,
                                          );
                                          setHistoryState((prev) =>
                                            prev ? { ...prev, data: res.data } : prev,
                                          );
                                          showToast(t('reception.refund_success'), 'success');
                                        } catch {
                                          showToast(t('reception.refund_failed'), 'error');
                                        } finally {
                                          setRefundBusyTxId(null);
                                        }
                                      },
                                    });
                                  }}
                                  type="button"
                                >
                                  {refundBusyTxId === tx.id
                                    ? '…'
                                    : isRefunded
                                      ? t('reception.refunded', { defaultValue: 'Refunded' })
                                      : t('reception.refund')}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Shift Closed Modal */}
      {showShiftModal && (
        <Modal
          open={true}
          title={t('finance.no_shift_error', { defaultValue: 'Смена закрыта' })}
          description={t('finance.open_shift_prompt', {
            defaultValue: 'Откройте смену, чтобы проводить оплаты.',
          })}
          onClose={() => setShowShiftModal(false)}
          width={520}
        >
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setShowShiftModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="default" size="sm" type="button" onClick={handleOpenShift}>
              {t('finance.open_shift')}
            </Button>
          </div>
        </Modal>
      )}

      {/* Mixed Payment Modal */}
      <MixedPaymentModal
        isOpen={mixedModalState.isOpen}
        onClose={() => {
          try {
            mixedModalState.onCancel();
          } catch {}
          setMixedModalState((prev) => ({ ...prev, isOpen: false }));
        }}
        totalAmount={mixedModalState.total}
        onConfirm={async (c, cd, t) => {
          await mixedModalState.onConfirm(c, cd, t);
          setMixedModalState((prev) => ({ ...prev, isOpen: false }));
        }}
      />

      {/* Create patient confirm (replaces native confirm) */}
      {createConfirm?.open ? (
        <Modal
          open={true}
          title={t('reception.create_new', { defaultValue: 'Создать пациента' })}
          description={t('reception.create_new') + '?'}
          onClose={() => setCreateConfirm(null)}
          width={520}
        >
          <div className="text-[13px] text-muted-foreground">
            {createConfirm.payload.full_name || '—'} • {createConfirm.payload.phone || '—'}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setCreateConfirm(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="default"
              size="sm"
              type="button"
              onClick={async () => {
                try {
                  const created = await client.post('/patients/', createConfirm.payload);
                  const newId = Number(created?.data?.id);
                  if (Number.isFinite(newId) && newId > 0) setFocusPatientId(newId);
                  showToast(
                    t('reception.patient_created', { defaultValue: 'Пациент создан' }),
                    'success',
                  );
                  await refreshPatients();
                  setCreateConfirm(null);
                  // Ensure typing continues smoothly
                  phoneRef.current?.focus();
                } catch (e) {
                  showToast(
                    t('reception.patient_create_failed', {
                      defaultValue: 'Ошибка создания пациента',
                    }),
                    'error',
                  );
                }
              }}
            >
              {t('common.confirm', { defaultValue: 'Да' })}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
