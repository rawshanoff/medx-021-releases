import { useEffect, useRef, useState } from 'react';
import { Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import client from '../../api/client';
import { Button } from '../../components/ui/button';
import { getPrintSettings, printReceipt, saveReceiptForTicket } from '../../utils/print';
import { useToast } from '../../context/ToastContext';
import type { Doctor } from '../../types/doctors';
import type { Patient } from '../../types/patients';

type TransactionCreatePayload = {
  patient_id: number;
  amount: number;
  doctor_id: string;
  payment_method: string;
  description: string;
  cash_amount?: number;
  card_amount?: number;
  transfer_amount?: number;
  idempotency_key?: string;
};

export function PaymentCells({
  patient,
  doctors,
  addToQueue,
  onRequestMixedPayment,
  onShiftError,
  requestFocus,
  onFocused,
}: {
  patient: Patient;
  doctors: Doctor[];
  addToQueue: (patientId: number, patientName: string, doctorId: number) => Promise<string>;
  onRequestMixedPayment: (
    total: number,
    onConfirm: (c: number, cd: number, t: number) => void,
  ) => void;
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

  const errorMessageIsShiftRelated = (msg: string) => {
    return msg.toLowerCase().includes('shift') || msg.toLowerCase().includes('active');
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    if (method === 'MIXED') {
      const svc = selectedDoctor?.services.find(
        (s) => s.id != null && String(s.id) === selectedServiceId,
      );
      if (svc) {
        onRequestMixedPayment(svc.price, (c, cd, tr) => {
          setMixedSplit({ cash: c, card: cd, transfer: tr });
        });
      }
    }
  };

  const processPay = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const svc = selectedDoctor?.services.find(
        (s) => s.id != null && String(s.id) === selectedServiceId,
      );
      const svcName = svc?.name || t('reception.service', { defaultValue: 'Услуга' });
      const amount = svc?.price || 0;

      const transactionData: TransactionCreatePayload = {
        patient_id: patient.id,
        amount,
        doctor_id: selectedDoctorId,
        payment_method: paymentMethod,
        description: svcName,
        idempotency_key: crypto.randomUUID(),
      };

      if (paymentMethod === 'MIXED') {
        transactionData.cash_amount = mixedSplit.cash;
        transactionData.card_amount = mixedSplit.card;
        transactionData.transfer_amount = mixedSplit.transfer;
      }

      // Create Transaction
      const txRes = await client.post('/finance/transactions', transactionData);

      // Add to Queue
      const ticket = await addToQueue(
        patient.id,
        patient.full_name,
        Number.parseInt(selectedDoctorId, 10),
      );

      // Print receipt after payment (based on System settings)
      try {
        const loadedSettings = await getPrintSettings();
        const settings = { ...loadedSettings, autoPrint: true };
        const nowIso = new Date().toISOString();
        const payload = {
          receiptNo: String(txRes?.data?.id ?? txRes?.data?.tx_id ?? 'AA-000000'),
          ticket,
          createdAtIso: nowIso,
          patientName: patient.full_name,
          doctorName: selectedDoctor?.full_name,
          doctorRoom: selectedDoctor?.room_number,
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

      showToast(
        `${t('reception.receipt_generated')} ${t('reception.ticket')}: ${ticket}`,
        'success',
      );
    } catch (e: unknown) {
      console.error(e);
      const err = e as { response?: { status?: number; data?: { detail?: unknown } } };
      const detail = err.response?.data?.detail;
      if (
        err.response?.status === 400 &&
        typeof detail === 'string' &&
        errorMessageIsShiftRelated(detail)
      ) {
        onShiftError();
        return;
      }

      let msg = t('reception.payment_failed');
      if (typeof detail === 'string' && detail) {
        msg += `: ${detail}`;
      }
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!selectedDoctorId || !selectedServiceId) {
      showToast(
        t('reception.select_doctor_service', { defaultValue: 'Выберите врача и услугу' }),
        'warning',
      );
      return;
    }

    if (paymentMethod === 'MIXED') {
      const total = mixedSplit.cash + mixedSplit.card + mixedSplit.transfer;
      const svc = selectedDoctor?.services.find(
        (s) => s.id != null && String(s.id) === selectedServiceId,
      );
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

  return (
    <>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-col gap-2">
          <select
            ref={doctorSelectRef}
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="h-[40px] w-full max-w-[240px] rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              className="h-[40px] w-full max-w-[240px] rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {selectedDoctor?.services.length === 0 ? (
                <option value="">{t('doctors.no_services')}</option>
              ) : null}
              {selectedDoctor?.services.map((s) => (
                <option key={String(s.id)} value={String(s.id)}>
                  {s.name} - {s.price.toLocaleString()}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </td>

      <td className="px-3 py-3 align-top">
        <select
          value={paymentMethod}
          onChange={(e) => handlePaymentMethodChange(e.target.value)}
          className="h-[40px] w-full max-w-[200px] rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <option value="CASH">{t('reception.cash')}</option>
          <option value="CARD">{t('reception.card')}</option>
          <option value="TRANSFER">{t('reception.transfer')}</option>
          <option value="MIXED">{t('reception.mixed')}</option>
        </select>
      </td>

      <td className="px-3 py-3 align-top text-right">
        <Button
          onClick={handlePay}
          disabled={loading || !selectedServiceId}
          size="sm"
          type="button"
        >
          <Receipt size={16} />
          {loading ? '…' : t('reception.pay')}
        </Button>
      </td>
    </>
  );
}
