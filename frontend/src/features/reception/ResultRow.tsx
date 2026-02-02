import { useEffect, useRef, useState } from 'react';
import { History as HistoryIcon, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import client from '../../api/client';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { getPrintSettings, printReceipt, saveReceiptForTicket } from '../../utils/print';
import { useToast } from '../../context/ToastContext';
import type { Doctor } from '../../types/doctors';
import type { Patient } from '../../types/patients';

export function ResultRow({
    patient,
    doctors,
    addToQueue,
    onViewHistory,
    onRequestMixedPayment,
    onShiftError,
    requestFocus,
    onFocused,
}: {
    patient: Patient;
    doctors: Doctor[];
    addToQueue: (patientId: number, patientName: string, doctorId: number) => Promise<string>;
    onViewHistory: () => void;
    onRequestMixedPayment: (total: number, onConfirm: (c: number, cd: number, t: number) => void) => void;
    onShiftError: () => void;
    requestFocus?: boolean;
    onFocused?: () => void;
}) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [loading, setLoading] = useState(false);

    // Local state to store splits
    const [mixedSplit, setMixedSplit] = useState({ cash: 0, card: 0, transfer: 0 });

    const selectedDoctor = doctors.find((d) => d.id.toString() === selectedDoctorId);
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
            setSelectedServiceId(best.id != null ? String(best.id) : '');
        } else {
            setSelectedServiceId('');
        }
    }, [selectedDoctorId, selectedDoctor]);

    const handlePaymentMethodChange = (method: string) => {
        setPaymentMethod(method);
        if (method === 'MIXED') {
            const svc = selectedDoctor?.services.find((s) => s.id != null && String(s.id) === selectedServiceId);
            if (svc) {
                onRequestMixedPayment(svc.price, (c, cd, tr) => {
                    setMixedSplit({ cash: c, card: cd, transfer: tr });
                });
            }
        }
    };

    const handlePay = async () => {
        if (!selectedDoctorId || !selectedServiceId) {
            showToast(
                t('reception.select_doctor_service', { defaultValue: 'Выберите врача и услугу' }),
                'warning'
            );
            return;
        }

        if (paymentMethod === 'MIXED') {
            const total = mixedSplit.cash + mixedSplit.card + mixedSplit.transfer;
            const svc = selectedDoctor?.services.find((s) => s.id != null && String(s.id) === selectedServiceId);
            // If total is 0 or mismatch, ask again
            if (svc && (total === 0 || total !== svc.price)) {
                onRequestMixedPayment(svc.price, (c, cd, tr) => {
                    setMixedSplit({ cash: c, card: cd, transfer: tr });
                    // Note: user must click Pay again after confirming modal
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
            const svc = selectedDoctor?.services.find((s) => s.id != null && String(s.id) === selectedServiceId);
            const svcName = svc?.name || t('reception.service', { defaultValue: 'Услуга' });
            const amount = svc?.price || 0;

            const transactionData: any = {
                patient_id: patient.id,
                amount,
                doctor_id: selectedDoctorId,
                payment_method: paymentMethod,
                description: svcName,
            };

            if (paymentMethod === 'MIXED') {
                transactionData.cash_amount = mixedSplit.cash;
                transactionData.card_amount = mixedSplit.card;
                transactionData.transfer_amount = mixedSplit.transfer;
            }

            // Create Transaction
            const txRes = await client.post('/finance/transactions', transactionData);

            // Add to Queue
            const ticket = await addToQueue(patient.id, patient.full_name, Number.parseInt(selectedDoctorId, 10));

            // Print receipt after payment (based on System settings)
            try {
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
                    paymentBreakdown:
                        paymentMethod === 'MIXED'
                            ? { cash: mixedSplit.cash, card: mixedSplit.card, transfer: mixedSplit.transfer }
                            : undefined,
                };
                saveReceiptForTicket(ticket, payload);
                printReceipt(payload, settings);
            } catch {
                // ignore printing errors
            }

            showToast(`${t('reception.receipt_generated')} ${t('reception.ticket')}: ${ticket}`, 'success');
        } catch (e: any) {
            console.error(e);
            if (e?.response?.status === 400 && e?.response?.data?.detail && errorMessageIsShiftRelated(String(e.response.data.detail))) {
                onShiftError();
                return;
            }

            let msg = t('reception.payment_failed');
            if (e?.response?.data?.detail) {
                msg += `: ${e.response.data.detail}`;
            }
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const errorMessageIsShiftRelated = (msg: string) => {
        return msg.toLowerCase().includes('shift') || msg.toLowerCase().includes('active');
    };

    return (
        <tr className={cn('border-t border-border', requestFocus ? 'bg-primary/5' : '')}>
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

