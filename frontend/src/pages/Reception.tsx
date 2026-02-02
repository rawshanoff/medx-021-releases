import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { Receipt, History as HistoryIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MixedPaymentModal from '../components/MixedPaymentModal';
import { useToast } from '../context/ToastContext';
import { getUser } from '../utils/auth';
import { dobUiToIso, normalizeHumanName } from '../utils/text';
import { getPrintSettings, printReceipt, saveReceiptForTicket } from '../utils/print';
import { Modal } from '../components/ui/modal';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/cn';
import { QueueSidebar } from '../features/reception/QueueSidebar';
import { PatientSearch } from '../features/reception/PatientSearch';
import { useDoctors } from '../features/reception/hooks/useDoctors';
import { useQueue } from '../features/reception/hooks/useQueue';
import { usePatientsSearch } from '../features/reception/hooks/usePatients';
import type { Doctor, Patient, QueueItem } from '../types/reception';

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
                            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-card">
                                <div className="h-full overflow-auto">
                                    <table className="w-full text-[13px]">
                                        <thead className="sticky top-0 z-10 bg-secondary text-[12px] text-muted-foreground">
                                            <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-medium">
                                                <th>{t('nav.patients')}</th>
                                                <th>{t('reception.dob')}</th>
                                                <th>{t('reception.phone')}</th>
                                                <th>{t('nav.doctors')}</th>
                                                <th>{t('reception.payment')}</th>
                                                <th className="text-right">{t('common.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="[&>tr]:border-t [&>tr]:border-border">
                                            {loading ? (
                                                <>
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <tr key={`sk-${i}`} className="[&>td]:px-2 [&>td]:py-2">
                                                            <td colSpan={6}>
                                                                <Skeleton className="h-6 w-full" />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </>
                                            ) : null}

                                            {!loading && patients.length === 0 && (phone || name || surname || dob) ? (
                                                <tr>
                                                    <td colSpan={6} className="p-5 text-center text-muted-foreground">
                                                        {t('reception.no_results')}
                                                    </td>
                                                </tr>
                                            ) : null}

                                            {!loading && patients.length === 0 && !(phone || name || surname || dob) ? (
                                                <tr>
                                                    <td colSpan={6} className="p-5 text-center text-muted-foreground">
                                                        {t('reception.search_placeholder')}
                                                    </td>
                                                </tr>
                                            ) : null}

                                            {patients.map((p) => (
                                                <ResultRow
                                                    key={p.id}
                                                    patient={p}
                                                    doctors={doctors}
                                                    addToQueue={addToQueue}
                                                    onViewHistory={async () => {
                                                        setHistoryState({ patient: p, loading: true, data: null, error: null });
                                                        try {
                                                            const res = await client.get(`/patients/${p.id}/history`);
                                                            setHistoryState({ patient: p, loading: false, data: res.data, error: null });
                                                        } catch (e: any) {
                                                            setHistoryState({
                                                                patient: p,
                                                                loading: false,
                                                                data: null,
                                                                error: e?.response?.data?.detail || t('reception.history_load_failed', { defaultValue: 'Не удалось загрузить историю' }),
                                                            });
                                                        }
                                                    }}
                                                    onRequestMixedPayment={openMixedModal}
                                                    onShiftError={() => setShowShiftModal(true)}
                                                    requestFocus={focusPatientId === p.id}
                                                    onFocused={() => setFocusPatientId(null)}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT (Queue) */}
                        <QueueSidebar queue={queue} onUpdateStatus={updateQueueStatus} />
                    </div>
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

function ResultRow({ patient, doctors, addToQueue, onViewHistory, onRequestMixedPayment, onShiftError, requestFocus, onFocused }: {
    patient: Patient,
    doctors: Doctor[],
    addToQueue: (patientId: number, patientName: string, d: number) => Promise<string>,
    onViewHistory: () => void,
    onRequestMixedPayment: (total: number, onConfirm: (c: number, cd: number, t: number) => void) => void,
    onShiftError: () => void,
    requestFocus?: boolean,
    onFocused?: () => void
}) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [loading, setLoading] = useState(false);

    // Local state to store splits
    const [mixedSplit, setMixedSplit] = useState({ cash: 0, card: 0, transfer: 0 });

    const selectedDoctor = doctors.find(d => d.id.toString() === selectedDoctorId);
    const doctorSelectRef = useRef<HTMLSelectElement | null>(null);

    useEffect(() => {
        if (!requestFocus) return;
        setTimeout(() => {
            doctorSelectRef.current?.focus();
            onFocused?.();
        }, 0);
    }, [requestFocus, onFocused]);

    useEffect(() => {
        if (selectedDoctor && selectedDoctor.services.length > 0) {
            const sorted = [...selectedDoctor.services].sort((a, b) => b.priority - a.priority);
            const best = sorted[0];
            setSelectedServiceId(best.id.toString());
        } else {
            setSelectedServiceId('');
        }
    }, [selectedDoctorId, selectedDoctor]);

    const handlePaymentMethodChange = (method: string) => {
        setPaymentMethod(method);
        if (method === 'MIXED') {
            const svc = selectedDoctor?.services.find(s => s.id.toString() === selectedServiceId);
            if (svc) {
                onRequestMixedPayment(svc.price, (c, cd, t) => {
                    setMixedSplit({ cash: c, card: cd, transfer: t });
                });
            }
        }
    };

    const handlePay = async () => {
        if (!selectedDoctorId || !selectedServiceId) {
            showToast(t('reception.select_doctor_service', { defaultValue: 'Выберите врача и услугу' }), 'warning');
            return;
        }

        if (paymentMethod === 'MIXED') {
            const total = mixedSplit.cash + mixedSplit.card + mixedSplit.transfer;
            const svc = selectedDoctor?.services.find(s => s.id.toString() === selectedServiceId);
            // If total is 0 or mismatch, ask again
            if (svc && (total === 0 || total !== svc.price)) {
                onRequestMixedPayment(svc.price, (c, cd, t) => {
                    setMixedSplit({ cash: c, card: cd, transfer: t });
                    // Note: User must click Pay again after confirming modal
                });
                return;
            }
        }

        await processPay();
    };

    const processPay = async () => {
        if (loading) return;
        setLoading(true);

        try {
            const svc = selectedDoctor?.services.find(s => s.id.toString() === selectedServiceId);
            const svcName = svc?.name || t('reception.service', { defaultValue: 'Услуга' });
            const amount = svc?.price || 0;

            const transactionData: any = {
                patient_id: patient.id,
                amount: amount,
                doctor_id: selectedDoctorId,
                payment_method: paymentMethod,
                description: svcName
            };

            if (paymentMethod === 'MIXED') {
                transactionData.cash_amount = mixedSplit.cash;
                transactionData.card_amount = mixedSplit.card;
                transactionData.transfer_amount = mixedSplit.transfer;
            }

            // Create Transaction
            const txRes = await client.post('/finance/transactions', transactionData);

            // Add to Queue
            const ticket = await addToQueue(patient.id, patient.full_name, parseInt(selectedDoctorId));

            // Print receipt after payment (based on System settings)
            try {
                // In desktop workflow we want silent printing on payment
                const settings = { ...getPrintSettings(), autoPrint: true };
                const nowIso = new Date().toISOString();
                const payload = {
                    receiptNo: String(txRes?.data?.id ?? txRes?.data?.tx_id ?? 'AA-000000'),
                    ticket,
                    createdAtIso: nowIso,
                    patientName: patient.full_name,
                    serviceName: svcName,
                    amount,
                    currency: t('common.currency'),
                    paymentMethod,
                    paymentBreakdown: paymentMethod === 'MIXED' ? { cash: mixedSplit.cash, card: mixedSplit.card, transfer: mixedSplit.transfer } : undefined,
                };
                saveReceiptForTicket(ticket, payload);
                printReceipt(payload, settings);
            } catch {
                // ignore printing errors
            }

            showToast(`${t('reception.receipt_generated')} ${t('reception.ticket')}: ${ticket}`, 'success');
        } catch (e: any) {
            console.error(e);
            if (e.response && e.response.status === 400 && e.response.data.detail && errorMessageIsShiftRelated(e.response.data.detail)) {
                onShiftError();
                return;
            }

            let msg = t('reception.payment_failed');
            if (e.response && e.response.data && e.response.data.detail) {
                msg += `: ${e.response.data.detail}`;
            }
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const errorMessageIsShiftRelated = (msg: string) => {
        return msg.toLowerCase().includes('shift') || msg.toLowerCase().includes('active');
    }

    return (
        <tr className={cn("border-t border-border", requestFocus ? "bg-primary/5" : "")}>
            <td className="px-2 py-1.5 align-top">
                <div className="font-medium">{patient.full_name}</div>
                <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={onViewHistory}
                    className="mt-1 h-6 justify-start gap-1 px-2 text-[12px] text-primary hover:text-primary"
                >
                    <HistoryIcon size={14} />
                    {t('reception.history')}
                </Button>
            </td>

            <td className="px-2 py-1.5 align-top text-muted-foreground">{patient.birth_date || '—'}</td>
            <td className="px-2 py-1.5 align-top">{patient.phone}</td>

            <td className="px-2 py-1.5 align-top">
                <div className="flex flex-col gap-2">
                    <select
                        ref={doctorSelectRef}
                        value={selectedDoctorId}
                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                        className="h-8 w-full max-w-[240px] rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <option value="">{t('reception.select_doctor')}</option>
                        {doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.full_name}
                            </option>
                        ))}
                    </select>

                    {selectedDoctorId ? (
                        <select
                            value={selectedServiceId}
                            onChange={(e) => setSelectedServiceId(e.target.value)}
                            className="h-8 w-full max-w-[240px] rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            {selectedDoctor?.services.length === 0 ? <option value="">{t('doctors.no_services')}</option> : null}
                            {selectedDoctor?.services.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} - {s.price.toLocaleString()}
                                </option>
                            ))}
                        </select>
                    ) : null}
                </div>
            </td>

            <td className="px-2 py-1.5 align-top">
                <select
                    value={paymentMethod}
                    onChange={(e) => handlePaymentMethodChange(e.target.value)}
                    className="h-8 w-full max-w-[200px] rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <option value="CASH">{t('reception.cash')}</option>
                    <option value="CARD">{t('reception.card')}</option>
                    <option value="TRANSFER">{t('reception.transfer')}</option>
                    <option value="MIXED">{t('reception.mixed')}</option>
                </select>
            </td>

            <td className="px-2 py-1.5 align-top text-right">
                <Button onClick={handlePay} disabled={loading || !selectedServiceId} size="sm" type="button">
                    <Receipt size={16} />
                    {loading ? '…' : t('reception.pay')}
                </Button>
            </td>
        </tr>
    );
}
