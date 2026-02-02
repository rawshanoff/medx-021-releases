import { useEffect, useRef, useState } from 'react';
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
import type { Patient } from '../types/patients';
import type { QueueItem } from '../types/reception';

export default function Reception() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');
    const [dob, setDob] = useState('');

    const phoneRef = useRef<HTMLInputElement | null>(null);
    const nameRef = useRef<HTMLInputElement | null>(null);
    const surnameRef = useRef<HTMLInputElement | null>(null);
    const dobRef = useRef<HTMLInputElement | null>(null);
    const createBtnRef = useRef<HTMLButtonElement | null>(null);

    const { patients, loading, refresh: refreshPatients, clear: clearPatients } = usePatientsSearch({ phone, name, surname, dob });
    const { doctors } = useDoctors();
    const { queue, refresh: refreshQueue, updateStatus: updateQueueStatusRaw } = useQueue();
    const updateQueueStatus = async (id: number, status: QueueItem['status']) => {
        try {
            await updateQueueStatusRaw(id, status);
        } catch {
            showToast(t('common.error') || 'Ошибка', 'error');
        }
    };
    const [focusPatientId, setFocusPatientId] = useState<number | null>(null);
    const [pendingFocusPatientId, setPendingFocusPatientId] = useState<number | null>(null);

    // History Modal
    const [historyState, setHistoryState] = useState<{
        patient: Patient;
        loading: boolean;
        data: any | null;
        error: string | null;
    } | null>(null);

    // Mixed Payment Logic Lifted Logic
    const [mixedModalState, setMixedModalState] = useState<{
        isOpen: boolean;
        total: number;
        onConfirm: (cash: number, card: number, transfer: number) => void;
    }>({
        isOpen: false,
        total: 0,
        onConfirm: () => { }
    });

    // UX: when Reception is open, typing anywhere should go to phone search.
    useEffect(() => {
        phoneRef.current?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
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
                (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);

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

    useEffect(() => {
        if (pendingFocusPatientId == null) return;
        const found = patients.find((p) => p.id === pendingFocusPatientId);
        if (!found) return;
        setFocusPatientId(pendingFocusPatientId);
        setPendingFocusPatientId(null);
    }, [patients, pendingFocusPatientId]);

    const handleInlineCreate = async () => {
        if (!name && !surname && !phone) {
            showToast(t('reception.fill_required'), 'warning');
            return;
        }

        if (confirm(t('reception.create_new') + "?")) {
            try {
                const fullName = normalizeHumanName((name + " " + surname).trim());
                const created = await client.post('/patients/', {
                    full_name: fullName,
                    phone: phone,
                    birth_date: dobUiToIso(dob) || null
                });
                const newId = Number(created?.data?.id);
                if (Number.isFinite(newId) && newId > 0) {
                    setPendingFocusPatientId(newId);
                }
                showToast(t('reception.patient_created', { defaultValue: 'Пациент создан' }), "success");
                await refreshPatients();
            } catch (e) {
                showToast(t('reception.patient_create_failed', { defaultValue: 'Ошибка создания пациента' }), "error");
            }
        }
    };

    const addToQueue = async (patientId: number, patientName: string, doctorId: number) => {
        try {
            const res = await client.post('/reception/queue', {
                patient_name: patientName,
                patient_id: patientId,
                doctor_id: doctorId,
                status: 'WAITING'
            });
            await refreshQueue();
            return res.data.ticket_number;
        } catch (e) {
            console.error("Failed to add to queue", e);
            return '';
        }
    };

    const openMixedModal = (total: number, onConfirm: (c: number, cd: number, t: number) => void) => {
        setMixedModalState({ isOpen: true, total, onConfirm });
    };


    const [showShiftModal, setShowShiftModal] = useState(false);

    const handleOpenShift = async () => {
        try {
            const cashier = getUser()?.username || 'Admin';
            await client.post('/finance/shifts/open', { cashier_id: cashier });
            setShowShiftModal(false);
            showToast(t('finance.shift_open', { id: 'New' }), 'success');
        } catch (e) {
            showToast(t('finance.shift_open_fail', { defaultValue: 'Не удалось открыть смену' }), "error");
        }
    };

    return (
        <div className="flex h-full flex-col gap-3">
            <h1 className="text-xl font-medium">{t('reception.title')}</h1>

                <div className="min-h-0 flex-1">
                    <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                        {/* LEFT */}
                        <div className="flex min-h-0 flex-col gap-4">
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
                                canCreate={Boolean(phone || name || surname)}
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
                                    } catch (e: any) {
                                        setHistoryState({
                                            patient: p,
                                            loading: false,
                                            data: null,
                                            error:
                                                e?.response?.data?.detail ||
                                                t('reception.history_load_failed', { defaultValue: 'Не удалось загрузить историю' }),
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
                        <QueueSidebar queue={queue} onUpdateStatus={updateQueueStatus} />
                    </div>
                </div>

            {/* History Modal */}
            {historyState && (
                <Modal
                    open={true}
                    title={`${t('reception.history')}: ${historyState.patient.full_name}`}
                    description={`${historyState.patient.phone}${historyState.patient.birth_date ? ` • ${historyState.patient.birth_date}` : ''}`}
                    onClose={() => setHistoryState(null)}
                    width={980}
                >
                    {historyState.loading ? <div className="text-[12px] text-muted-foreground">{t('common.loading')}</div> : null}
                    {historyState.error ? <div className="text-[12px] text-destructive">{historyState.error}</div> : null}

                    {!historyState.loading && !historyState.error ? (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                            <div className="rounded-md border border-border bg-background p-3">
                                <div className="mb-2 text-[13px] font-medium">{t('finance.title', { defaultValue: 'Финансы' })}</div>
                                <div className="grid gap-2">
                                    {(historyState.data?.transactions || []).slice(0, 3).map((tx: any) => (
                                        <div key={`tx-${tx.id}`} className="rounded-md border border-border bg-card p-2">
                                            <div className="flex justify-between gap-2">
                                                <div className="font-medium">{Number(tx.amount || 0).toLocaleString()} {t('common.currency')}</div>
                                                <div className="text-[12px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <div className="text-[12px] text-muted-foreground">{tx.description || ''}</div>
                                        </div>
                                    ))}
                                    {(historyState.data?.transactions || []).length === 0 ? <div className="text-[12px] text-muted-foreground">—</div> : null}
                                </div>
                            </div>

                            <div className="rounded-md border border-border bg-background p-3">
                                <div className="mb-2 text-[13px] font-medium">{t('reception.queue')}</div>
                                <div className="grid gap-2">
                                    {(historyState.data?.queue || []).slice(0, 3).map((qi: any) => (
                                        <div key={`q-${qi.id}`} className="rounded-md border border-border bg-card p-2">
                                            <div className="flex justify-between gap-2">
                                                <div className="font-medium">{qi.ticket_number}</div>
                                                <div className="text-[12px] text-muted-foreground">{new Date(qi.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <div className="text-[12px] text-muted-foreground">{String(qi.status)}</div>
                                        </div>
                                    ))}
                                    {(historyState.data?.queue || []).length === 0 ? <div className="text-[12px] text-muted-foreground">—</div> : null}
                                </div>
                            </div>

                            <div className="rounded-md border border-border bg-background p-3">
                                <div className="mb-2 text-[13px] font-medium">{t('nav.appointments', { defaultValue: 'Записи' })}</div>
                                <div className="grid gap-2">
                                    {(historyState.data?.appointments || []).slice(0, 3).map((a: any) => (
                                        <div key={`a-${a.id}`} className="rounded-md border border-border bg-card p-2">
                                            <div className="flex justify-between gap-2">
                                                <div className="font-medium">{new Date(a.start_time).toLocaleDateString()}</div>
                                                <div className="text-[12px] text-muted-foreground">{String(a.status)}</div>
                                            </div>
                                            <div className="text-[12px] text-muted-foreground">{String(a.doctor_id || '')}</div>
                                        </div>
                                    ))}
                                    {(historyState.data?.appointments || []).length === 0 ? <div className="text-[12px] text-muted-foreground">—</div> : null}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </Modal>
            )}

            {/* Shift Closed Modal */}
            {showShiftModal && (
                <Modal
                    open={true}
                    title={t('finance.no_shift_error', { defaultValue: 'Смена закрыта' })}
                    description={t('finance.open_shift_prompt', { defaultValue: 'Откройте смену, чтобы проводить оплаты.' })}
                    onClose={() => setShowShiftModal(false)}
                    width={520}
                >
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" type="button" onClick={() => setShowShiftModal(false)}>
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
                onClose={() => setMixedModalState(prev => ({ ...prev, isOpen: false }))}
                totalAmount={mixedModalState.total}
                onConfirm={(c, cd, t) => {
                    mixedModalState.onConfirm(c, cd, t);
                    setMixedModalState(prev => ({ ...prev, isOpen: false }));
                }}
            />
        </div>
    );
}
